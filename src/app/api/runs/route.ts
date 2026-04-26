import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  runs,
  artifacts as artifactsTable,
  contentDocuments as contentDocumentsTable,
  metrics as metricsTable,
  findings as findingsTable,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { putBlob } from "@/lib/blob-put";
import {
  parseReportForIngest,
  parseSkillParserOverride,
  type SkillParserConfig,
  type AuxiliaryIngestConfigs,
} from "@/lib/parsers";
import { ensureExecutiveSummaryWithNextSteps } from "@/lib/parsers/executive-summary";
import {
  parseTopRecommendationsPayload,
} from "@/lib/top-recommendations";
import {
  buildSyntheticBundleReport,
  manifestFileForPath,
  parseContentBundleForIngest,
  parseContentBundleManifestJson,
  type ContentBundleManifest,
} from "@/lib/parsers/content-bundle";
import { parseRunDetailContract } from "@/lib/run-detail-contract";
import {
  mergeSuiteFieldsIntoRawMetadata,
  parseSuiteFieldsFromFormData,
} from "@/lib/suite-metadata";
import { skillFamilyForSkillType } from "@/lib/skills/catalog";
import { mergeFindingsWithTopRecommendations } from "@/lib/parsers/findings-from-top-recommendations";

/** Ingest can upload many blobs; keep below your Vercel plan’s function max. */
export const maxDuration = 300;

function isBlobLike(
  v: unknown
): v is Blob & { readonly name?: string } {
  return typeof Blob !== "undefined" && v instanceof Blob;
}

/**
 * List recent runs for the project tied to the API key (inverse of POST ingest).
 * Query: ?skillType=optional&limit=1-100 (default 30)
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "x-api-key header is required" },
        { status: 401 }
      );
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, apiKey))
      .limit(1);

    if (!project) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const skillType = searchParams.get("skillType");
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "30", 10) || 30)
    );

    const rows = await db
      .select()
      .from(runs)
      .where(
        skillType?.trim()
          ? and(eq(runs.projectId, project.id), eq(runs.skillType, skillType.trim()))
          : eq(runs.projectId, project.id)
      )
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      runs: rows.map((r) => ({
        id: r.id,
        skillType: r.skillType,
        status: r.status,
        createdAt: r.createdAt,
        executiveSummaryPreview: r.executiveSummary
          ? r.executiveSummary.slice(0, 500)
          : null,
        hubPath: `/runs/${r.id}`,
      })),
    });
  } catch (e) {
    console.error("[GET /api/runs]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseOptionalRunDetailContract(input: FormDataEntryValue | null) {
  if (!input) return null;

  let raw: unknown;
  if (typeof input === "string") {
    if (!input.trim()) return null;
    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error("runDetailContract must be valid JSON");
    }
  } else if (isBlobLike(input)) {
    throw new Error("runDetailContract must be sent as JSON string field");
  } else {
    throw new Error("runDetailContract must be valid JSON");
  }

  const parsed = parseRunDetailContract(raw);
  if (!parsed) {
    throw new Error("runDetailContract must match contract v1.0");
  }
  return parsed;
}

function parseOptionalTopRecommendations(input: FormDataEntryValue | null) {
  if (!input) return null;

  if (typeof input !== "string") {
    throw new Error("topRecommendations must be sent as JSON string field");
  }
  if (!input.trim()) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error("topRecommendations must be valid JSON");
  }

  const parsed = parseTopRecommendationsPayload(raw);
  if (!parsed) {
    throw new Error("topRecommendations must match payload v1.0");
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  try {
    const requestStartedAt = Date.now();
    const formData = await req.formData();
    console.info(
      JSON.stringify({
        tag: "hub_ingest_timing",
        phase: "POST:/api/runs",
        step: "req.formData()",
        elapsedMs: Date.now() - requestStartedAt,
      })
    );

    const apiKey = req.headers.get("x-api-key") ?? formData.get("apiKey");
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "x-api-key header or apiKey field is required" },
        { status: 401 }
      );
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, apiKey))
      .limit(1);
    console.info(
      JSON.stringify({
        tag: "hub_ingest_timing",
        phase: "POST:/api/runs",
        step: "project lookup",
        elapsedMs: Date.now() - requestStartedAt,
        ok: Boolean(project),
      })
    );

    if (!project) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    const skillType = formData.get("skillType") as string;
    if (!skillType) {
      return NextResponse.json(
        { error: "skillType is required" },
        { status: 400 }
      );
    }
    console.info(
      JSON.stringify({
        tag: "hub_ingest_timing",
        phase: "POST:/api/runs",
        step: "skillType resolved",
        elapsedMs: Date.now() - requestStartedAt,
        skillType,
      })
    );

    const artifactTypeRaw = formData.get("artifactType");
    const isContentBundle =
      typeof artifactTypeRaw === "string" &&
      artifactTypeRaw.trim().toLowerCase() === "content-bundle";

    const skillParserConfig = project.skillParserConfig as SkillParserConfig | null;

    let suiteFields: ReturnType<typeof parseSuiteFieldsFromFormData>;
    try {
      suiteFields = parseSuiteFieldsFromFormData(formData);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.info(
      JSON.stringify({
        tag: "hub_ingest_timing",
        phase: "POST:/api/runs",
        step: "suite fields parsed",
        elapsedMs: Date.now() - requestStartedAt,
        suiteRunId: suiteFields.suiteRunId ?? null,
      })
    );

    let providedRunDetailContract: ReturnType<typeof parseOptionalRunDetailContract> =
      null;
    try {
      providedRunDetailContract = parseOptionalRunDetailContract(
        formData.get("runDetailContract")
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    let providedTopRecommendations: ReturnType<typeof parseOptionalTopRecommendations> =
      null;
    try {
      providedTopRecommendations = parseOptionalTopRecommendations(
        formData.get("topRecommendations")
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const overrideRaw = formData.get("skillParserOverride");
    let override: ReturnType<typeof parseSkillParserOverride> | undefined;
    if (typeof overrideRaw === "string" && overrideRaw.trim()) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(overrideRaw);
      } catch {
        return NextResponse.json(
          { error: "skillParserOverride must be valid JSON" },
          { status: 400 }
        );
      }
      try {
        override = parseSkillParserOverride(parsedJson);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if (isContentBundle) {
      return await ingestContentBundle({
        formData,
        project,
        skillType,
        skillParserConfig,
        override,
        providedRunDetailContract,
        providedTopRecommendations,
        suiteFields,
      });
    }

    return await ingestReportArtifact({
      formData,
      project,
      skillType,
      skillParserConfig,
      override,
      providedRunDetailContract,
      providedTopRecommendations,
      suiteFields,
    });
  } catch (e) {
    console.error("[POST /api/runs]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Optional `config:roadmap.json` / `config:backlog.json` for strategy report parsing. */
async function extractAuxiliaryStrategyConfigs(
  formData: FormData
): Promise<AuxiliaryIngestConfigs | null> {
  const out: AuxiliaryIngestConfigs = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("config:") || !isBlobLike(value)) continue;
    const name = key.slice("config:".length).trim();
    const base =
      name.includes("/") ? (name.split("/").pop() ?? name) : name;
    if (base !== "roadmap.json" && base !== "backlog.json") continue;
    try {
      const text = await value.text();
      const parsed = JSON.parse(text) as unknown;
      if (base === "roadmap.json") out.roadmapJson = parsed;
      if (base === "backlog.json") out.backlogJson = parsed;
    } catch {
      /* optional attachment — ignore invalid JSON */
    }
  }
  return Object.keys(out).length ? out : null;
}

async function ingestReportArtifact(opts: {
  formData: FormData;
  project: typeof projects.$inferSelect;
  skillType: string;
  skillParserConfig: SkillParserConfig | null;
  override: ReturnType<typeof parseSkillParserOverride> | undefined;
  providedRunDetailContract: ReturnType<typeof parseOptionalRunDetailContract>;
  providedTopRecommendations: ReturnType<typeof parseOptionalTopRecommendations>;
  suiteFields: ReturnType<typeof parseSuiteFieldsFromFormData>;
}) {
  const ingestStartedAt = Date.now();
  const timing = (step: string, extra?: Record<string, unknown>) => {
    console.info(
      JSON.stringify({
        tag: "hub_ingest_timing",
        phase: "ingestReportArtifact",
        step,
        elapsedMs: Date.now() - ingestStartedAt,
        ...extra,
      })
    );
  };
  const {
    formData,
    project,
    skillType,
    skillParserConfig,
    override,
    providedRunDetailContract,
    providedTopRecommendations,
    suiteFields,
  } = opts;
  timing("start", { skillType, suiteRunId: suiteFields.suiteRunId ?? null });

  const catalogFamily = skillFamilyForSkillType(skillType);

  const reportFile = formData.get("report");
  if (!reportFile || !isBlobLike(reportFile)) {
    return NextResponse.json(
      { error: "report file is required" },
      { status: 400 }
    );
  }

  const reportMarkdown = await reportFile.text();
  timing("reportFile.text()", { bytes: reportMarkdown.length });
  const reportFilename =
    reportFile instanceof File ? reportFile.name : "report.md";

  const auxiliaryConfigs = await extractAuxiliaryStrategyConfigs(formData);
  timing("auxiliary configs extracted", {
    hasAuxiliaryConfigs: Boolean(auxiliaryConfigs),
  });

  const parsed = parseReportForIngest(reportMarkdown, {
    skillType,
    skillParserConfig,
    override,
    auxiliaryConfigs,
  });
  timing("parseReportForIngest()", {
    metrics: parsed.metrics.length,
    findings: parsed.findings.length,
  });
  const topRecommendations = providedTopRecommendations;
  const findingsForRun = mergeFindingsWithTopRecommendations(
    parsed.findings,
    topRecommendations
  );
  timing("mergeFindingsWithTopRecommendations()", {
    findings: findingsForRun.length,
    hasTopRecommendations: Boolean(topRecommendations),
  });
  timing("before ensureExecutiveSummaryWithNextSteps()", {
    willEnsure: Boolean(topRecommendations),
  });
  const executiveSummary = topRecommendations
    ? ensureExecutiveSummaryWithNextSteps(parsed.executiveSummary, {
        skillType,
        findings: findingsForRun,
        metrics: parsed.metrics,
        topRecommendations: topRecommendations.recommendations,
      })
    : parsed.executiveSummary;
  timing("after ensureExecutiveSummaryWithNextSteps()", {
    executiveSummaryBytes: executiveSummary.length,
  });

  timing("before putBlob(report)");
  const reportBlob = await putBlob(
    `${project.name}/${skillType}/report-${Date.now()}.md`,
    reportMarkdown,
    { access: "public", contentType: "text/markdown", addRandomSuffix: true }
  );
  timing("putBlob(report)");

  const baseMeta = {
    artifactType: "report" as const,
    runDetailContract: providedRunDetailContract ?? parsed.runDetail ?? null,
    topRecommendations: topRecommendations ?? null,
  };
  const [run] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      skillType,
      status: "completed",
      executiveSummary,
      rawMetadata: mergeSuiteFieldsIntoRawMetadata(
        baseMeta as Record<string, unknown>,
        suiteFields,
        catalogFamily
      ),
    })
    .returning();
  timing("db.insert(runs)");

  await db.insert(artifactsTable).values({
    runId: run.id,
    filename: reportFilename,
    mimeType: "text/markdown",
    blobUrl: reportBlob.url,
    role: "report",
  });
  timing("db.insert(artifacts:report)");

  if (parsed.metrics.length > 0) {
    await db.insert(metricsTable).values(
      parsed.metrics.map((m) => ({
        runId: run.id,
        key: m.key,
        value: m.value,
        unit: m.unit ?? null,
      }))
    );
    timing("db.insert(metrics)", { metrics: parsed.metrics.length });
  }

  if (findingsForRun.length > 0) {
    await db.insert(findingsTable).values(
      findingsForRun.map((f) => ({
        runId: run.id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        category: f.category,
        recommendation: f.recommendation,
      }))
    );
    timing("db.insert(findings)", { findings: findingsForRun.length });
  }

  const uploadedScreenshots: string[] = [];
  const entries = Array.from(formData.entries());
  const artifactTasks: Promise<void>[] = [];
  for (const [key, value] of entries) {
    if (key.startsWith("screenshot:") && isBlobLike(value)) {
      const filename =
        value instanceof File ? value.name : key.slice("screenshot:".length);
      artifactTasks.push(
        (async () => {
          const blob = await putBlob(
            `${project.name}/${skillType}/screenshots/${filename}`,
            value,
            {
              access: "public",
              contentType: value.type || "image/png",
              addRandomSuffix: true,
            }
          );

          await db.insert(artifactsTable).values({
            runId: run.id,
            filename,
            mimeType: value.type || "image/png",
            blobUrl: blob.url,
            role: "screenshot",
          });
          uploadedScreenshots.push(filename);
        })()
      );
    }

    if (key.startsWith("config:") && isBlobLike(value)) {
      const filename =
        value instanceof File ? value.name : key.slice("config:".length);
      artifactTasks.push(
        (async () => {
          const configContent = await value.text();
          const blob = await putBlob(
            `${project.name}/${skillType}/configs/${filename}`,
            configContent,
            {
              access: "public",
              contentType: "application/json",
              addRandomSuffix: true,
            }
          );

          await db.insert(artifactsTable).values({
            runId: run.id,
            filename,
            mimeType: "application/json",
            blobUrl: blob.url,
            role: "config",
          });
        })()
      );
    }

    if (key === "journeyMap" && isBlobLike(value)) {
      const filename = value instanceof File ? value.name : "journey-map.md";
      const journeyMapStamp = Date.now();
      artifactTasks.push(
        (async () => {
          const mapContent = await value.text();
          const blob = await putBlob(
            `${project.name}/${skillType}/journey-map-${journeyMapStamp}.md`,
            mapContent,
            { access: "public", contentType: "text/markdown", addRandomSuffix: true }
          );

          await db.insert(artifactsTable).values({
            runId: run.id,
            filename,
            mimeType: "text/markdown",
            blobUrl: blob.url,
            role: "journey-map",
          });
        })()
      );
    }
  }
  await Promise.all(artifactTasks);
  timing("Promise.all(artifactTasks)", { artifacts: artifactTasks.length });

  return NextResponse.json(
    {
      id: run.id,
      projectId: project.id,
      skillType,
      artifactType: "report",
      metrics: parsed.metrics.length,
      findings: findingsForRun.length,
      screenshots: uploadedScreenshots.length,
      url: `/runs/${run.id}`,
    },
    { status: 201 }
  );
}

async function ingestContentBundle(opts: {
  formData: FormData;
  project: typeof projects.$inferSelect;
  skillType: string;
  skillParserConfig: SkillParserConfig | null;
  override: ReturnType<typeof parseSkillParserOverride> | undefined;
  providedRunDetailContract: ReturnType<typeof parseOptionalRunDetailContract>;
  providedTopRecommendations: ReturnType<typeof parseOptionalTopRecommendations>;
  suiteFields: ReturnType<typeof parseSuiteFieldsFromFormData>;
}) {
  const {
    formData,
    project,
    skillType,
    skillParserConfig,
    override,
    providedRunDetailContract,
    providedTopRecommendations,
    suiteFields,
  } = opts;

  const catalogFamily = skillFamilyForSkillType(skillType);

  const manifestFile = formData.get("manifest");
  if (!manifestFile || !isBlobLike(manifestFile)) {
    return NextResponse.json(
      { error: "manifest file is required for content-bundle ingest" },
      { status: 400 }
    );
  }

  let manifest: ContentBundleManifest;
  try {
    const text = await manifestFile.text();
    manifest = parseContentBundleManifestJson(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Invalid manifest: ${message}` },
      { status: 400 }
    );
  }

  const auditField = formData.get("auditReport");
  let auditMarkdown: string | null = null;
  let auditFilename = "audit-report.md";
  if (auditField && isBlobLike(auditField)) {
    auditMarkdown = await auditField.text();
    auditFilename =
      auditField instanceof File ? auditField.name : auditFilename;
  }

  const parsed = parseContentBundleForIngest(manifest, auditMarkdown, {
    skillType,
    skillParserConfig,
    override,
  });
  const effectiveSkillType = manifest.skillType?.trim() || skillType;
  const reportBody =
    auditMarkdown?.trim() ? auditMarkdown : buildSyntheticBundleReport(manifest);
  const reportName = auditMarkdown?.trim() ? auditFilename : "bundle-overview.md";
  const topRecommendations = providedTopRecommendations;
  const findingsForBundle = mergeFindingsWithTopRecommendations(
    parsed.findings,
    topRecommendations
  );
  const executiveSummary = topRecommendations
    ? ensureExecutiveSummaryWithNextSteps(parsed.executiveSummary, {
        skillType: effectiveSkillType,
        findings: findingsForBundle,
        metrics: parsed.metrics,
        topRecommendations: topRecommendations.recommendations,
      })
    : parsed.executiveSummary;

  const manifestBlob = await putBlob(
    `${project.name}/${skillType}/bundle/manifest-${Date.now()}.json`,
    JSON.stringify(manifest, null, 2),
    { access: "public", contentType: "application/json", addRandomSuffix: true }
  );

  const baseMetaBundle = {
    artifactType: "content-bundle" as const,
    manifest,
    mode: manifest.mode ?? null,
    runDetailContract: providedRunDetailContract ?? parsed.runDetail ?? null,
    topRecommendations: topRecommendations ?? null,
  };
  const [run] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      skillType,
      status: "completed",
      executiveSummary,
      rawMetadata: mergeSuiteFieldsIntoRawMetadata(
        baseMetaBundle as Record<string, unknown>,
        suiteFields,
        catalogFamily
      ),
    })
    .returning();

  await db.insert(artifactsTable).values({
    runId: run.id,
    filename: "_manifest.json",
    mimeType: "application/json",
    blobUrl: manifestBlob.url,
    role: "manifest",
  });

  const reportBlob = await putBlob(
    `${project.name}/${skillType}/report-${Date.now()}.md`,
    reportBody,
    { access: "public", contentType: "text/markdown", addRandomSuffix: true }
  );

  await db.insert(artifactsTable).values({
    runId: run.id,
    filename: reportName,
    mimeType: "text/markdown",
    blobUrl: reportBlob.url,
    role: "report",
  });

  const contentFiles: string[] = [];
  const entries = Array.from(formData.entries());
  for (const [key, value] of entries) {
    if (!key.startsWith("content:") || !isBlobLike(value)) continue;
    const relPath = key.slice("content:".length);
    if (!relPath) continue;

    const mime = value.type || "text/markdown";
    const isMarkdown =
      relPath.toLowerCase().endsWith(".md") ||
      mime.includes("markdown") ||
      mime.startsWith("text/");

    let uploadBody: Buffer | string;
    let bodyMarkdown: string | null = null;
    if (isMarkdown) {
      bodyMarkdown = await value.text();
      uploadBody = bodyMarkdown;
    } else {
      uploadBody = Buffer.from(await value.arrayBuffer());
    }

    const blob = await putBlob(
      `${project.name}/${skillType}/bundle/${relPath.replace(/^\//, "")}`,
      uploadBody,
      { access: "public", contentType: mime, addRandomSuffix: true }
    );

    const [artifactRow] = await db
      .insert(artifactsTable)
      .values({
        runId: run.id,
        filename: relPath,
        mimeType: mime,
        blobUrl: blob.url,
        role: "content",
      })
      .returning({ id: artifactsTable.id });

    if (bodyMarkdown !== null) {
      const meta = manifestFileForPath(manifest, relPath);
      await db.insert(contentDocumentsTable).values({
        projectId: project.id,
        runId: run.id,
        artifactId: artifactRow.id,
        ingestSkillType: skillType,
        manifestSkillType: effectiveSkillType,
        relativePath: relPath,
        title: meta?.title ?? relPath,
        category: meta?.category ?? null,
        description: meta?.description ?? null,
        bodyMarkdown,
        blobUrl: blob.url,
        mimeType: mime,
      });
    }

    contentFiles.push(relPath);
  }

  if (contentFiles.length === 0) {
    return NextResponse.json(
      {
        error:
          "content-bundle ingest requires at least one field like content:path/to/file.md",
      },
      { status: 400 }
    );
  }

  if (parsed.metrics.length > 0) {
    await db.insert(metricsTable).values(
      parsed.metrics.map((m) => ({
        runId: run.id,
        key: m.key,
        value: m.value,
        unit: m.unit ?? null,
      }))
    );
  }

  if (findingsForBundle.length > 0) {
    await db.insert(findingsTable).values(
      findingsForBundle.map((f) => ({
        runId: run.id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        category: f.category,
        recommendation: f.recommendation,
      }))
    );
  }

  return NextResponse.json(
    {
      id: run.id,
      projectId: project.id,
      skillType,
      artifactType: "content-bundle",
      metrics: parsed.metrics.length,
      findings: findingsForBundle.length,
      contentFiles: contentFiles.length,
      url: `/runs/${run.id}`,
    },
    { status: 201 }
  );
}
