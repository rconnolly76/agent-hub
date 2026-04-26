/**
 * Extracts the "## Executive Summary" section body (common across skill reports).
 * Stops at the next horizontal rule or H2.
 */
export function extractExecutiveSummarySection(markdown: string): string {
  const match = markdown.match(
    /## Executive Summary\s*\n([\s\S]*?)(?=\n---|\n## )/
  );
  return match?.[1]?.trim() ?? "";
}

interface NextStepFinding {
  severity?: string;
  title?: string;
  category?: string;
  recommendation?: {
    what?: string;
    why?: string;
    owner?: string;
    effort?: string;
  };
}

interface NextStepMetric {
  key: string;
  value: number;
}

interface EnsureSummaryOptions {
  skillType: string;
  findings: NextStepFinding[];
  metrics: NextStepMetric[];
  topRecommendations?: Array<{
    title: string;
    action: string;
    rationale?: string;
  }>;
}

const NEXT_STEPS_HEADER = "### Recommended Next Steps (Prioritized)";

function normalizeWhitespace(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function severityRank(severity?: string): number {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    case "investigate":
      return 2;
    case "info":
      return 3;
    case "low":
      return 4;
    default:
      return 5;
  }
}

function fallbackStepByPriority(
  priority: number,
  opts: EnsureSummaryOptions
): string {
  const critical =
    opts.metrics.find((m) => m.key === "severity_critical")?.value ?? 0;
  const warning = opts.metrics.find((m) => m.key === "severity_warning")?.value ?? 0;
  const heuristic =
    opts.metrics.find((m) => m.key === "heuristic_coverage")?.value ?? null;

  if (priority === 1 && critical > 0) {
    return `Address the ${critical} critical issue${critical === 1 ? "" : "s"} first; validate fixes with a focused rerun of \`${opts.skillType}\`.`;
  }
  if (priority === 2 && warning > 0) {
    return `Triage warning-level findings into quick wins vs deeper work and schedule the highest-risk warnings for this sprint.`;
  }
  if (priority === 3 && typeof heuristic === "number" && heuristic < 100) {
    return `Increase coverage depth from ${heuristic}% toward full scope by adding missing checks and edge-case validation.`;
  }
  if (priority === 4) {
    return "Convert accepted findings into tracked tickets with clear owners, effort estimates, and done-when criteria.";
  }
  return "Re-run the skill after changes and compare trendlines (critical/warning counts and summary score) to confirm improvement.";
}

function buildPrioritizedNextSteps(opts: EnsureSummaryOptions): string[] {
  const seen = new Set<string>();
  const steps: string[] = [];

  for (const recommendation of opts.topRecommendations ?? []) {
    if (!recommendation?.action?.trim()) continue;
    const line = recommendation.rationale?.trim()
      ? `${recommendation.action.trim()} (${recommendation.rationale.trim()})`
      : recommendation.action.trim();
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    steps.push(normalized);
    if (steps.length === 5) return steps;
  }

  const orderedFindings = [...opts.findings].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );

  for (const finding of orderedFindings) {
    const recommendationWhat = finding.recommendation?.what?.trim();
    const title = finding.title?.trim();
    const category = finding.category?.trim();
    const base =
      recommendationWhat ||
      (title ? `Resolve: ${title}` : category ? `Improve ${category}` : "");
    if (!base) continue;

    const withContext = finding.recommendation?.why
      ? `${base} (${finding.recommendation.why.trim()})`
      : base;
    const normalized = withContext.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    steps.push(normalized);
    if (steps.length === 5) break;
  }

  let priority = steps.length + 1;
  // Safety: ensure we never spin forever if fallbacks collide with existing steps.
  // (e.g. if a recommendation matches a fallback verbatim, priority>=5 repeats the same fallback.)
  let guard = 0;
  while (steps.length < 5 && guard < 25) {
    const fallbackBase = fallbackStepByPriority(priority, opts).trim();
    let candidate = fallbackBase;
    let key = candidate.toLowerCase();

    // If the fallback is already present, generate a unique-but-equivalent variant.
    // This preserves the "5 steps" contract without risking an infinite loop.
    let bump = 0;
    while (seen.has(key) && bump < 5) {
      bump += 1;
      candidate = `${fallbackBase} (alt ${priority}.${bump})`;
      key = candidate.toLowerCase();
    }

    if (!seen.has(key)) {
      seen.add(key);
      steps.push(candidate);
    }

    priority += 1;
    guard += 1;
  }

  return steps.slice(0, 5);
}

/**
 * Ensures executive summary always includes 5 prioritized next steps.
 * Existing summary prose is preserved; previously appended next-step block is replaced.
 */
export function ensureExecutiveSummaryWithNextSteps(
  executiveSummary: string,
  options: EnsureSummaryOptions
): string {
  if (!options.topRecommendations || options.topRecommendations.length === 0) {
    return executiveSummary.trim();
  }

  const summary = executiveSummary.trim();
  const existingIndex = summary.indexOf(NEXT_STEPS_HEADER);
  const baseSummary =
    existingIndex >= 0 ? summary.slice(0, existingIndex).trimEnd() : summary;

  const steps = buildPrioritizedNextSteps(options);
  const nextStepsBlock = [
    NEXT_STEPS_HEADER,
    "",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");

  if (!baseSummary) return nextStepsBlock;
  return normalizeWhitespace(`${baseSummary}\n\n${nextStepsBlock}`);
}
