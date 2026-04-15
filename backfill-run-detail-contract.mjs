#!/usr/bin/env node

import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    limit: (() => {
      const idx = argv.indexOf("--limit");
      if (idx === -1) return null;
      const value = Number(argv[idx + 1]);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
    })(),
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function splitByH2(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) {
        sections.push({
          title: current.title,
          body: current.lines.join("\n"),
        });
      }
      current = {
        title: h2[1].replace(/[*_`~\[\]]/g, "").trim(),
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }

  if (current) {
    sections.push({
      title: current.title,
      body: current.lines.join("\n"),
    });
  }

  return sections;
}

function findingMatchesSection(finding, sectionTitle) {
  const bag = `${finding.category ?? ""} ${finding.title ?? ""} ${
    finding.description ?? ""
  }`.toLowerCase();
  const tokens = sectionTitle
    .toLowerCase()
    .split(/[\s/:-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
  return tokens.some((token) => bag.includes(token));
}

function buildContractFromReport(markdown, artifactKind, findings) {
  const sections = splitByH2(markdown);
  if (sections.length === 0) return null;

  return {
    version: "1.0",
    artifactKind,
    sections: sections.map((section) => {
      const body = section.body.toLowerCase();
      let criticalCount = (body.match(/\bcritical\b|🔴|\bc\d+\./g) || []).length;
      let warningCount = (body.match(/\bwarning\b|🟡|\bw\d+\./g) || []).length;
      const healthyCount =
        (body.match(/\bpassing\b|\bhealthy\b|🟢|\bg\d+\./g) || []).length;
      let findingCount = 0;

      for (const finding of findings) {
        if (!findingMatchesSection(finding, section.title)) continue;
        findingCount += 1;
        const severity = (finding.severity ?? "").toLowerCase();
        if (severity === "critical") criticalCount += 1;
        if (severity === "warning") warningCount += 1;
      }

      const level =
        criticalCount > 0
          ? "critical"
          : warningCount > 0
            ? "watch"
            : healthyCount > 0
              ? "healthy"
              : "info";

      const summary =
        level === "critical"
          ? `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"}`
          : level === "watch"
            ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
            : level === "healthy"
              ? "No critical or warning indicators"
              : "Informational section";

      return {
        id: slugify(section.title),
        title: section.title,
        level,
        summary,
        criticalCount,
        warningCount,
        findingCount,
      };
    }),
  };
}

function buildContractFromManifest(manifest) {
  const sections = new Map();
  for (const file of manifest.files ?? []) {
    const category = (file.category ?? "Content").trim() || "Content";
    const id = slugify(category);
    const existing = sections.get(id);
    if (existing) {
      existing.findingCount += 1;
    } else {
      sections.set(id, {
        id,
        title: category,
        level: "healthy",
        summary: "Generated content bundle section",
        findingCount: 1,
      });
    }
  }

  return {
    version: "1.0",
    artifactKind: "content-bundle",
    sections: Array.from(sections.values()),
  };
}

async function main() {
  const { dryRun, force, limit } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(url);
  const maybeLimit = limit ? `limit ${limit}` : "";
  const runs = await sql.query(
    `select id, raw_metadata from runs order by created_at desc ${maybeLimit}`
  );

  let updated = 0;
  let skippedHasContract = 0;
  let skippedNoData = 0;
  let failures = 0;

  for (const run of runs) {
    try {
      const raw = run.raw_metadata ?? {};
      if (!force && raw && raw.runDetailContract) {
        skippedHasContract += 1;
        continue;
      }

      const findings = await sql`
        select severity, title, description, category
        from findings
        where run_id = ${run.id}
      `;

      let contract = null;
      const artifactType = raw?.artifactType ?? "report";

      const reportArtifact = await sql`
        select blob_url, filename
        from artifacts
        where run_id = ${run.id}
          and role = 'report'
        order by created_at desc
        limit 1
      `;

      if (reportArtifact.length > 0) {
        const reportUrl = reportArtifact[0].blob_url;
        if (reportUrl) {
          const res = await fetch(reportUrl);
          if (res.ok) {
            const markdown = await res.text();
            contract = buildContractFromReport(
              markdown,
              artifactType === "content-bundle" ? "content-bundle" : "report",
              findings
            );
          }
        }
      }

      if (!contract && artifactType === "content-bundle" && raw?.manifest) {
        contract = buildContractFromManifest(raw.manifest);
      }

      if (!contract) {
        skippedNoData += 1;
        continue;
      }

      const nextRaw = {
        ...(raw ?? {}),
        runDetailContract: contract,
      };

      if (!dryRun) {
        await sql`
          update runs
          set raw_metadata = ${JSON.stringify(nextRaw)}::jsonb
          where id = ${run.id}
        `;
      }
      updated += 1;
    } catch (error) {
      failures += 1;
      console.warn(`Failed run ${run.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("");
  console.log("Run detail contract backfill complete");
  console.log(`- processed: ${runs.length}`);
  console.log(`- updated: ${updated}${dryRun ? " (dry-run)" : ""}`);
  console.log(`- skipped (already had contract): ${skippedHasContract}`);
  console.log(`- skipped (insufficient source data): ${skippedNoData}`);
  console.log(`- failures: ${failures}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
