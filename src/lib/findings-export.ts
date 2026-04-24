import type { ParsedFinding } from "./parsers/ux-journey-reviewer";

const STRATEGY_SKILLS = new Set([
  "product-marketer",
  "product-docs-author",
  "market-research",
  "product-opportunity-analysis",
  "feature-roadmap",
  "product-backlog",
]);

export function defaultFacetForSkill(
  skillType: string
): "health" | "strategy" {
  return STRATEGY_SKILLS.has(skillType) ? "strategy" : "health";
}

/**
 * Optional structured findings list sent as multipart `findingsExport` (JSON string).
 * Aligns with skills `_shared` findings-export contract; v1.0.
 */
export interface FindingsExportV1 {
  version: "1.0";
  findings: Array<{
    runFindingId?: string;
    severity: string;
    title: string;
    category?: string;
    description?: string;
    facet?: "health" | "strategy";
    affectedFiles?: string[];
  }>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseFindingsExportPayload(
  raw: unknown
): FindingsExportV1 | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== "1.0") return null;
  if (!Array.isArray(raw.findings)) return null;
  const findings = raw.findings
    .filter(isRecord)
    .map((f) => {
      const facet: "health" | "strategy" | undefined =
        f.facet === "health" || f.facet === "strategy" ? f.facet : undefined;
      return {
        runFindingId:
          typeof f.runFindingId === "string" ? f.runFindingId : undefined,
        severity: typeof f.severity === "string" ? f.severity : "info",
        title: typeof f.title === "string" ? f.title : "",
        category: typeof f.category === "string" ? f.category : undefined,
        description:
          typeof f.description === "string" ? f.description : undefined,
        facet,
        affectedFiles: Array.isArray(f.affectedFiles)
          ? f.affectedFiles.filter((x): x is string => typeof x === "string")
          : undefined,
      };
    })
    .filter((f) => f.title.trim().length > 0);
  if (findings.length === 0) return null;
  return { version: "1.0", findings };
}

/**
 * Index-align: enrich parsed markdown findings with run ids / facets from export.
 * If export is longer, append rows; if shorter, only the first n are enriched.
 */
export function mergeFindingsWithExport(
  fromMarkdown: ParsedFinding[],
  exportPayload: FindingsExportV1 | null
): ParsedFinding[] {
  if (!exportPayload) return fromMarkdown;
  const ex = exportPayload.findings;
  if (ex.length === 0) return fromMarkdown;

  if (fromMarkdown.length === 0) {
    return ex.map(
      (row): ParsedFinding => ({
        severity: row.severity,
        title: row.title,
        description: row.description ?? "",
        category: row.category ?? "general",
        runFindingId: row.runFindingId,
        facet: row.facet,
        affectedFiles: row.affectedFiles,
        recommendation: {},
      })
    );
  }

  const out: ParsedFinding[] = fromMarkdown.map((f, i) => {
    const e = ex[i];
    if (!e) return f;
    return {
      ...f,
      runFindingId: e.runFindingId ?? f.runFindingId,
      severity: e.severity || f.severity,
      title: e.title || f.title,
      category: e.category ?? f.category,
      description: e.description ?? f.description,
      facet: e.facet ?? f.facet,
      affectedFiles: e.affectedFiles ?? f.affectedFiles,
    };
  });
  for (let i = fromMarkdown.length; i < ex.length; i++) {
    const e = ex[i];
    out.push({
      severity: e.severity,
      title: e.title,
      description: e.description ?? "",
      category: e.category ?? "general",
      runFindingId: e.runFindingId,
      facet: e.facet,
      affectedFiles: e.affectedFiles,
      recommendation: {},
    });
  }
  return out;
}
