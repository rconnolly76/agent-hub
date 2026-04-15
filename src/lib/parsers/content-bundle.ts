import type { ParseResult } from "./ux-journey-reviewer";
import { parseReportForIngest } from "./ingest";
import type { SkillParserConfig, SkillParserEntry } from "./types";
import {
  buildRunDetailContractFromBundleManifest,
  buildRunDetailContractFromReport,
} from "@/lib/run-detail-contract";

/** Minimal manifest shape from generative skills (_manifest.json). */
export interface ContentBundleManifest {
  skillType?: string;
  mode?: string;
  generatedAt?: string;
  summary: string;
  files: { path: string; title: string; category?: string; description?: string }[];
  auditReport?: string;
}

export function parseContentBundleManifestJson(text: string): ContentBundleManifest {
  const data = JSON.parse(text) as unknown;
  if (typeof data !== "object" || data === null || !("summary" in data)) {
    throw new Error("manifest must be a JSON object with a summary field");
  }
  const m = data as ContentBundleManifest;
  if (typeof m.summary !== "string") {
    throw new Error("manifest.summary must be a string");
  }
  if (!Array.isArray(m.files)) {
    throw new Error("manifest.files must be an array");
  }
  return m;
}

export function buildSyntheticBundleReport(manifest: ContentBundleManifest): string {
  const title = manifest.skillType ?? "Content bundle";
  const lines: string[] = [
    `# ${title}`,
    "",
    manifest.summary,
    "",
    "## Bundle contents",
    "",
  ];
  for (const f of manifest.files) {
    lines.push(`- **${f.title}** — \`${f.path}\`${f.description ? ` — ${f.description}` : ""}`);
  }
  if (manifest.mode) {
    lines.push("", `*Mode: ${manifest.mode}*`);
  }
  return lines.join("\n");
}

/**
 * Combines manifest summary with optional audit markdown parsing for metrics/findings.
 */
export function parseContentBundleForIngest(
  manifest: ContentBundleManifest,
  auditMarkdown: string | null,
  options: {
    skillType: string;
    skillParserConfig?: SkillParserConfig | null;
    override?: SkillParserEntry | null;
  }
): ParseResult {
  const { skillType, skillParserConfig, override } = options;
  const effectiveSkill = manifest.skillType?.trim() || skillType;

  const base: ParseResult = {
    executiveSummary: manifest.summary,
    metrics: [],
    findings: [],
    runDetail: buildRunDetailContractFromBundleManifest(manifest),
  };

  if (!auditMarkdown?.trim()) {
    return base;
  }

  const auditParsed = parseReportForIngest(auditMarkdown, {
    skillType: effectiveSkill,
    skillParserConfig,
    override,
  });

  return {
    executiveSummary: base.executiveSummary || auditParsed.executiveSummary,
    metrics: auditParsed.metrics,
    findings: auditParsed.findings,
    runDetail:
      auditParsed.runDetail ??
      (auditMarkdown
        ? buildRunDetailContractFromReport({
            markdown: auditMarkdown,
            artifactKind: "content-bundle",
            findings: auditParsed.findings,
          })
        : base.runDetail) ??
      undefined,
  };
}
