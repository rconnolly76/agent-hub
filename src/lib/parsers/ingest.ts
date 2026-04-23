import { extractExecutiveSummarySection } from "./executive-summary";
import { getParser } from "./registry";
import type { ParseResult } from "./ux-journey-reviewer";
import { buildRunDetailContractFromReport } from "@/lib/run-detail-contract";
import {
  GENERIC_PARSER_ID,
  type SkillParserConfig,
  type SkillParserEntry,
} from "./types";
import { parseFeatureRoadmapReport } from "./feature-roadmap";
import { parseProductBacklogReport } from "./product-backlog";

const DEFAULT_FALLBACK_MAX = 100_000;

export function parseGenericReport(
  markdown: string,
  executiveSummaryFallbackMaxChars = DEFAULT_FALLBACK_MAX
): ParseResult {
  return {
    executiveSummary:
      extractExecutiveSummarySection(markdown) ||
      markdown.slice(0, executiveSummaryFallbackMaxChars),
    metrics: [],
    findings: [],
    runDetail:
      buildRunDetailContractFromReport({
        markdown,
        artifactKind: "report",
        findings: [],
      }) ?? undefined,
  };
}

function mergeEntry(
  project: SkillParserConfig | null | undefined,
  skillType: string,
  override?: SkillParserEntry | null
): SkillParserEntry {
  const base = project?.[skillType] ?? {};
  return { ...base, ...override };
}

function resolveParserId(skillType: string, entry: SkillParserEntry): string {
  const raw = entry.parserId?.trim();
  if (!raw || raw.toLowerCase() === "default") return skillType;
  if (raw.toLowerCase() === "generic") return GENERIC_PARSER_ID;
  return raw;
}

export type AuxiliaryIngestConfigs = {
  /** Parsed `config:roadmap.json` from multipart ingest (optional). */
  roadmapJson?: unknown;
  /** Parsed `config:backlog.json` from multipart ingest (optional). */
  backlogJson?: unknown;
};

/**
 * Runs the appropriate parser for an ingested report using project config and optional per-run override.
 * Strategy skills accept optional structured JSON (uploaded as `config:roadmap.json` / `config:backlog.json`)
 * to enrich narrative fields such as `userOutcome` on ingest.
 */
export function parseReportForIngest(
  reportMarkdown: string,
  options: {
    skillType: string;
    skillParserConfig?: SkillParserConfig | null;
    override?: SkillParserEntry | null;
    auxiliaryConfigs?: AuxiliaryIngestConfigs | null;
  }
): ParseResult {
  const { skillType, skillParserConfig, override, auxiliaryConfigs } = options;
  const entry = mergeEntry(skillParserConfig ?? null, skillType, override ?? undefined);
  const effectiveId = resolveParserId(skillType, entry);
  const maxFb =
    entry.executiveSummaryFallbackMaxChars ?? DEFAULT_FALLBACK_MAX;

  if (effectiveId === GENERIC_PARSER_ID) {
    return parseGenericReport(reportMarkdown, maxFb);
  }

  if (effectiveId === "feature-roadmap") {
    return parseFeatureRoadmapReport(
      reportMarkdown,
      auxiliaryConfigs?.roadmapJson
    );
  }

  if (effectiveId === "product-backlog") {
    return parseProductBacklogReport(
      reportMarkdown,
      auxiliaryConfigs?.backlogJson
    );
  }

  const parser = getParser(effectiveId);
  if (parser) {
    return parser(reportMarkdown);
  }

  return parseGenericReport(reportMarkdown, maxFb);
}
