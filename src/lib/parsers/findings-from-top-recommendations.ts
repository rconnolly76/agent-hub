import type { TopRecommendationsPayloadV1 } from "@/lib/top-recommendations";
import type { ParsedFinding } from "./ux-journey-reviewer";

function normalizeFindingTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function priorityToFallbackSeverity(priority: string): string {
  switch (priority) {
    case "P1":
      return "critical";
    case "P2":
      return "warning";
    case "P3":
      return "info";
    case "P4":
    case "P5":
      return "low";
    default:
      return "info";
  }
}

/**
 * Maps a structured top-5 JSON sidecar into Hub `findings` rows so evaluative runs
 * show triage counts when the markdown shape does not match a registered parser
 * (e.g. `## Top 5 Recommendations` + `**P1.**` instead of `## Recommendations` + `**R1.**`).
 */
export function topRecommendationsToFindings(
  payload: TopRecommendationsPayloadV1
): ParsedFinding[] {
  const out: ParsedFinding[] = [];
  for (const rec of payload.recommendations ?? []) {
    const title = rec.title?.trim();
    if (!title) continue;
    const severity =
      rec.severity ?? priorityToFallbackSeverity(rec.priority);

    const descriptionParts = [rec.action?.trim() ?? ""];
    if (rec.rationale?.trim()) {
      descriptionParts.push(rec.rationale.trim());
    }
    const description = descriptionParts.filter(Boolean).join("\n\n");

    out.push({
      severity,
      title,
      description,
      category: "recommendation",
      recommendation: {
        what: rec.action,
        why: rec.rationale,
        effort: rec.effort,
        doneWhen: rec.successMetric,
      },
    });
  }
  return out;
}

/**
 * Prefer markdown-derived findings when titles overlap; append sidecar-only rows so pushes
 * that include `_top-5-recommendations.json` still populate `findings` when the report uses
 * non-R section headings.
 */
export function mergeFindingsWithTopRecommendations(
  markdownFindings: ParsedFinding[],
  topRecommendations: TopRecommendationsPayloadV1 | null | undefined
): ParsedFinding[] {
  if (!topRecommendations?.recommendations?.length) {
    return markdownFindings;
  }

  const fromSidecar = topRecommendationsToFindings(topRecommendations);
  if (markdownFindings.length === 0) {
    return fromSidecar;
  }

  const seen = new Set(
    markdownFindings.map((f) => normalizeFindingTitle(f.title))
  );
  const out = [...markdownFindings];
  for (const f of fromSidecar) {
    const key = normalizeFindingTitle(f.title);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}
