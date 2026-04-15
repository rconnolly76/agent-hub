export type RecommendationPriority = "P1" | "P2" | "P3" | "P4" | "P5";

export interface TopRecommendation {
  priority: RecommendationPriority;
  title: string;
  action: string;
  rationale?: string;
  severity?: "critical" | "warning" | "info" | "low" | "investigate";
}

export interface TopRecommendationsPayloadV1 {
  version: "1.0";
  skillType?: string;
  generatedAt?: string;
  recommendations: TopRecommendation[];
}

const PRIORITIES: RecommendationPriority[] = ["P1", "P2", "P3", "P4", "P5"];

function parsePriority(input: unknown): RecommendationPriority | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  return PRIORITIES.includes(normalized as RecommendationPriority)
    ? (normalized as RecommendationPriority)
    : null;
}

export function parseTopRecommendationsPayload(
  raw: unknown
): TopRecommendationsPayloadV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (payload.version !== "1.0") return null;
  if (!Array.isArray(payload.recommendations)) return null;

  const recommendations: TopRecommendation[] = [];
  for (const rec of payload.recommendations) {
    if (!rec || typeof rec !== "object") continue;
    const obj = rec as Record<string, unknown>;
    const priority = parsePriority(obj.priority);
    const title =
      typeof obj.title === "string" ? obj.title.trim() : "";
    const action =
      typeof obj.action === "string" ? obj.action.trim() : "";
    if (!priority || !title || !action) continue;

    const severityCandidate =
      typeof obj.severity === "string" ? obj.severity.toLowerCase() : undefined;
    const severity =
      severityCandidate &&
      ["critical", "warning", "info", "low", "investigate"].includes(
        severityCandidate
      )
        ? (severityCandidate as TopRecommendation["severity"])
        : undefined;

    recommendations.push({
      priority,
      title,
      action,
      rationale:
        typeof obj.rationale === "string" ? obj.rationale.trim() : undefined,
      severity,
    });
  }

  if (recommendations.length === 0) return null;
  recommendations.sort(
    (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
  );

  return {
    version: "1.0",
    skillType:
      typeof payload.skillType === "string" ? payload.skillType : undefined,
    generatedAt:
      typeof payload.generatedAt === "string" ? payload.generatedAt : undefined,
    recommendations: recommendations.slice(0, 5),
  };
}

export function buildTopRecommendationsFromFindings(params: {
  skillType: string;
  findings: Array<{
    severity?: string;
    title?: string;
    category?: string;
    recommendation?: {
      what?: string;
      why?: string;
    };
  }>;
  metrics: Array<{ key: string; value: number }>;
}): TopRecommendationsPayloadV1 {
  const sorted = [...params.findings].sort((a, b) => {
    const rank = (s?: string) => {
      switch ((s ?? "").toLowerCase()) {
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
    };
    return rank(a.severity) - rank(b.severity);
  });

  const recommendations: TopRecommendation[] = [];
  const seen = new Set<string>();
  for (const finding of sorted) {
    const title = finding.title?.trim();
    const action = finding.recommendation?.what?.trim();
    if (!title && !action) continue;
    const normalizedTitle = (title || action || "").toLowerCase();
    if (seen.has(normalizedTitle)) continue;
    seen.add(normalizedTitle);
    recommendations.push({
      priority: PRIORITIES[Math.min(recommendations.length, 4)],
      title: title || `Improve ${finding.category || "quality signal"}`,
      action: action || `Address "${title}" and verify by rerunning the skill.`,
      rationale: finding.recommendation?.why?.trim(),
      severity: finding.severity
        ? (finding.severity.toLowerCase() as TopRecommendation["severity"])
        : undefined,
    });
    if (recommendations.length === 5) break;
  }

  const critical =
    params.metrics.find((m) => m.key === "severity_critical")?.value ?? 0;
  const warning =
    params.metrics.find((m) => m.key === "severity_warning")?.value ?? 0;

  while (recommendations.length < 5) {
    const idx = recommendations.length;
    const priority = PRIORITIES[idx];
    const fallback =
      idx === 0 && critical > 0
        ? {
            title: "Resolve critical issues first",
            action: `Fix ${critical} critical issue${critical === 1 ? "" : "s"} and validate immediately.`,
            rationale: "Critical findings pose the highest risk to user trust and release quality.",
            severity: "critical" as const,
          }
        : idx <= 1 && warning > 0
          ? {
              title: "Burn down warning backlog",
              action: "Prioritize warning-level issues by impact and close highest-risk items this sprint.",
              rationale: "Warnings often become critical regressions if left unresolved.",
              severity: "warning" as const,
            }
          : idx === 3
            ? {
                title: "Convert findings into owned tasks",
                action: "Create tickets with owners, effort, and done-when criteria for the top recommendations.",
                rationale: "Ownership and measurable completion criteria improve execution quality.",
              }
            : {
                title: "Re-run and verify trend improvement",
                action: `Re-run \`${params.skillType}\` after changes and confirm critical/warning metrics improve.`,
                rationale: "Closed-loop validation prevents regressions and confirms impact.",
              };

    recommendations.push({
      priority,
      ...fallback,
    });
  }

  return {
    version: "1.0",
    skillType: params.skillType,
    generatedAt: new Date().toISOString(),
    recommendations: recommendations.slice(0, 5),
  };
}
