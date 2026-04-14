import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  runs,
  artifacts as artifactsTable,
  metrics as metricsTable,
  findings as findingsTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { getParser } from "@/lib/parsers";

export async function POST(req: NextRequest) {
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

  const reportFile = formData.get("report") as File | null;
  if (!reportFile) {
    return NextResponse.json(
      { error: "report file is required" },
      { status: 400 }
    );
  }

  const reportMarkdown = await reportFile.text();

  const parser = getParser(skillType);
  const parsed = parser
    ? parser(reportMarkdown)
    : {
        executiveSummary: reportMarkdown.slice(0, 500),
        metrics: [],
        findings: [],
      };

  const reportBlob = await put(
    `${project.name}/${skillType}/report-${Date.now()}.md`,
    reportMarkdown,
    { access: "public", contentType: "text/markdown" }
  );

  const [run] = await db
    .insert(runs)
    .values({
      projectId: project.id,
      skillType,
      status: "completed",
      executiveSummary: parsed.executiveSummary,
    })
    .returning();

  await db.insert(artifactsTable).values({
    runId: run.id,
    filename: reportFile.name || "report.md",
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
    if (key.startsWith("screenshot:") && value instanceof File) {
      const blob = await put(
        `${project.name}/${skillType}/screenshots/${value.name}`,
        value,
        { access: "public", contentType: value.type || "image/png" }
      );

      await db.insert(artifactsTable).values({
        runId: run.id,
        filename: value.name,
        mimeType: value.type || "image/png",
        blobUrl: blob.url,
        role: "screenshot",
      });

      uploadedScreenshots.push(value.name);
    }

    if (key.startsWith("config:") && value instanceof File) {
      const configContent = await value.text();
      const blob = await put(
        `${project.name}/${skillType}/configs/${value.name}`,
        configContent,
        { access: "public", contentType: "application/json" }
      );

      await db.insert(artifactsTable).values({
        runId: run.id,
        filename: value.name,
        mimeType: "application/json",
        blobUrl: blob.url,
        role: "config",
      });
    }

    if (key === "journeyMap" && value instanceof File) {
      const mapContent = await value.text();
      const blob = await put(
        `${project.name}/${skillType}/journey-map-${Date.now()}.md`,
        mapContent,
        { access: "public", contentType: "text/markdown" }
      );

      await db.insert(artifactsTable).values({
        runId: run.id,
        filename: value.name,
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
      metrics: parsed.metrics.length,
      findings: parsed.findings.length,
      screenshots: uploadedScreenshots.length,
      url: `/runs/${run.id}`,
    },
    { status: 201 }
  );
}
