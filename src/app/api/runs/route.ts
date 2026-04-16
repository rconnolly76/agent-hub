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
import { eq } from "drizzle-orm";
import { putBlob } from "@/lib/blob-put";
import {
  parseReportForIngest,
  parseSkillParserOverride,
  type SkillParserConfig,
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

/** Ingest can upload many blobs; keep below your Vercel plan’s function max. */
export const maxDuration = 300;

function isBlobLike(
  v: unknown
): v is Blob & { readonly name?: string } {
  return typeof Blob !== "undefined" && v instanceof Blob;
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
    const formData = await req.formData();

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

    const artifactTypeRaw = formData.get("artifactType");
    const isContentBundle =
      typeof artifactTypeRaw === "string" &&
      artifactTypeRaw.trim().toLowerCase() === "content-bundle";

    const skillParserConfig = project.skillParserConfig as SkillParserConfig | null;
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
      return ingestContentBundle({
        formData,
        project,
        skillType,
        skillParserConfig,
        override,
        providedRunDetailContract,
        providedTopRecommendations,
      });
    }

    return ingestReportArtifact({
      formData,
      project,
      skillType,
      skillParserConfig,
      override,
      providedRunDetailContract,
      providedTopRecommendations,
    });
  } catch (e) {
    console.error("[POST /api/runs]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ingestReportArtifact(opts: {
  formData: FormData;
  project: typeof projects.$inferSelect;
  skillType: string;
  skillParserConfig: SkillParserConfig | null;
  override: ReturnType<typeof parseSkillParserOverride> | undefined;
  providedRunDetailContract: ReturnType<typeof parseOptionalRunDetailContract>;
  providedTopRecommendations: ReturnType<typeof parseOptionalTopRecommendations>;
}) {
  const {
    formData,
    project,
    skillType,
    skillParserConfig,
    override,
    providedRunDetailContract,
    providedTopRecommendations,
  } = opts;

  const reportFile = formData.get("report");
  if (!reportFile || !isBlobLike(reportFile)) {
    return NextResponse.json(
      { error: "report file is required" },
      { status: 400 }
    );
  }

  const reportMarkdown = await reportFile.text();
  const reportFilename =
    reportFile instanceof File ? reportFile.name : "report.md";

  const parsed = parseReportForIngest(reportMarkdown, {
    skillType,
    skillParserConfig,
    override,
  });
  const topRecommendations = providedTopRecommendations;
  const executiveSummary = topRecommendations
    ? ensureExecutiveSummaryWithNextSteps(parsed.executiveSummary, {
        skillType,
        findings: parsed.findings,
        metrics: parsed.metrics,
        topRecommendations: topRecommendations.recommendations,
      })
    : parsed.executiveSummary;

  const reportBlob = await putBlob(
    `${project.name}/${skillType}/report-${Date.now()}.md`,
    reportMarkdown,
    { access: "public", contentType: "text/markdown", addRandomSuffix: true }
  );

  const [run] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      skillType,
      status: "completed",
      executiveSummary,
      rawMetadata: {
        artifactType: "report" as const,
        runDetailContract: providedRunDetailContract ?? parsed.runDetail ?? null,
        topRecommendations: topRecommendations ?? null,
      },
    })
    .returning();

  await db.insert(artifactsTable).values({
    runId: run.id,
    filename: reportFilename,
    mimeType: "text/markdown",
    blobUrl: reportBlob.url,
    role: "report",
  });

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

  if (parsed.findings.length > 0) {
    await db.insert(findingsTable).values(
      parsed.findings.map((f) => ({
        runId: run.id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        category: f.category,
        recommendation: f.recommendation,
      }))
    );
  }

  const uploadedScreenshots: string[] = [];
  const entries = Array.from(formData.entries());
  for (const [key, value] of entries) {
    if (key.startsWith("screenshot:") && isBlobLike(value)) {
      const filename =
        value instanceof File ? value.name : key.slice("screenshot:".length);
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
    }

    if (key.startsWith("config:") && isBlobLike(value)) {
      const filename =
        value instanceof File ? value.name : key.slice("config:".length);
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
    }

    if (key === "journeyMap" && isBlobLike(value)) {
      const filename = value instanceof File ? value.name : "journey-map.md";
      const mapContent = await value.text();
      const blob = await putBlob(
        `${project.name}/${skillType}/journey-map-${Date.now()}.md`,
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
    }
  }

  return NextResponse.json(
    {
      id: run.id,
      projectId: project.id,
      skillType,
      artifactType: "report",
      metrics: parsed.metrics.length,
      findings: parsed.findings.length,
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
}) {
  const {
    formData,
    project,
    skillType,
    skillParserConfig,
    override,
    providedRunDetailContract,
    providedTopRecommendations,
  } = opts;

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
  const executiveSummary = topRecommendations
    ? ensureExecutiveSummaryWithNextSteps(parsed.executiveSummary, {
        skillType: effectiveSkillType,
        findings: parsed.findings,
        metrics: parsed.metrics,
        topRecommendations: topRecommendations.recommendations,
      })
    : parsed.executiveSummary;

  const manifestBlob = await putBlob(
    `${project.name}/${skillType}/bundle/manifest-${Date.now()}.json`,
    JSON.stringify(manifest, null, 2),
    { access: "public", contentType: "application/json", addRandomSuffix: true }
  );

  const [run] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      skillType,
      status: "completed",
      executiveSummary,
      rawMetadata: {
        artifactType: "content-bundle" as const,
        manifest,
        mode: manifest.mode ?? null,
        runDetailContract: providedRunDetailContract ?? parsed.runDetail ?? null,
        topRecommendations: topRecommendations ?? null,
      },
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

  if (parsed.findings.length > 0) {
    await db.insert(findingsTable).values(
      parsed.findings.map((f) => ({
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
      findings: parsed.findings.length,
      contentFiles: contentFiles.length,
      url: `/runs/${run.id}`,
    },
    { status: 201 }
  );
}
