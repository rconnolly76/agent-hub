export interface ParsedMetric {
  key: string;
  value: number;
  unit?: string;
}

export interface ParsedFinding {
  severity: string;
  title: string;
  description: string;
  category: string;
  recommendation: {
    what?: string;
    why?: string;
    type?: string;
    owner?: string;
    effort?: string;
    doneWhen?: string;
  };
}

export interface ParseResult {
  executiveSummary: string;
  metrics: ParsedMetric[];
  findings: ParsedFinding[];
}

export function parseJourneyReviewerReport(markdown: string): ParseResult {
  return {
    executiveSummary: extractExecutiveSummary(markdown),
    metrics: extractMetrics(markdown),
    findings: extractFindings(markdown),
  };
}

function extractExecutiveSummary(md: string): string {
  const match = md.match(
    /## Executive Summary\s*\n([\s\S]*?)(?=\n---|\n## )/
  );
  return match?.[1]?.trim() ?? "";
}

function extractMetrics(md: string): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];

  const stepsMatch = md.match(
    /\*\*Steps completed:\*\*\s*(\d+)\s*\/\s*(\d+)/
  );
  if (stepsMatch) {
    metrics.push(
      { key: "steps_completed", value: parseInt(stepsMatch[1]) },
      { key: "steps_total", value: parseInt(stepsMatch[2]) }
    );
  }

  const journeysMatch = md.match(/across (\d+) journeys/);
  if (journeysMatch) {
    metrics.push({
      key: "journeys_total",
      value: parseInt(journeysMatch[1]),
    });
  }

  const timelineSection = md.match(
    /## Journey Timeline\s*\n([\s\S]*?)(?=\n---|\n## )/
  );
  if (timelineSection) {
    const rows = timelineSection[1];
    const passed = (rows.match(/✅/g) || []).length;
    const warned = (rows.match(/⚠️/g) || []).length;
    const failed = (rows.match(/❌/g) || []).length;
    metrics.push(
      { key: "steps_passed", value: passed },
      { key: "steps_warning", value: warned },
      { key: "steps_failed", value: failed }
    );
  }

  const criticalSection = md.match(/### 🔴 Critical Issues\s*\n([\s\S]*?)(?=\n### 🟡|\n---)/);
  const criticalCount = criticalSection
    ? (criticalSection[1].match(/\*\*C\d+\./g) || []).length
    : 0;

  const warningSection = md.match(/### 🟡 Warnings\s*\n([\s\S]*?)(?=\n### 🟢|\n---)/);
  const warningCount = warningSection
    ? (warningSection[1].match(/\*\*W\d+\./g) || []).length
    : 0;

  const passingSection = md.match(/### 🟢 Passing Observations[^\n]*\n([\s\S]*?)(?=\n---)/);
  const passingCount = passingSection
    ? (passingSection[1].match(/\*\*G\d+\./g) || []).length
    : 0;

  metrics.push(
    { key: "severity_critical", value: criticalCount },
    { key: "severity_warning", value: warningCount },
    { key: "severity_passing", value: passingCount }
  );

  const heuristicMatch = md.match(
    /(\d+)\s*(?:of|\/)\s*(\d+)\s*heuristic cells?\s*evaluated\s*\((\d+)%?\)/
  );
  if (heuristicMatch) {
    metrics.push({
      key: "heuristic_coverage",
      value: parseInt(heuristicMatch[3]),
      unit: "%",
    });
  }

  const synthesizedCount = (
    md.match(/### Synthesized Finding #\d+/g) || []
  ).length;
  metrics.push({ key: "synthesized_findings", value: synthesizedCount });

  const recommendationsSection = md.match(/## Recommendations\s*\n([\s\S]*?)(?=\n## |$)/);
  if (recommendationsSection) {
    const recCount = (recommendationsSection[1].match(/\*\*R\d+\./g) || []).length;
    metrics.push({ key: "recommendations_count", value: recCount });
  }

  return metrics;
}

function extractFindings(md: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const recSection = md.match(/## Recommendations\s*\n([\s\S]*?)(?=\n## |$)/);
  if (!recSection) return findings;

  const text = recSection[1];
  const blocks = text.split(/(?=\*\*R\d+\.)/);

  for (const block of blocks) {
    const titleMatch = block.match(/\*\*R\d+\.\s*(.+?)\*\*/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();

    const severityMatch = block.match(/### (🔴[^\n]*|🟡[^\n]*|🔵[^\n]*|⚪[^\n]*|🔍[^\n]*)/);
    let severity = "info";
    const fullSeverity = findPrecedingSeverityHeader(text, block);
    if (fullSeverity.includes("🔴") || fullSeverity.includes("Fix immediately"))
      severity = "critical";
    else if (fullSeverity.includes("🟡") || fullSeverity.includes("Fix soon"))
      severity = "warning";
    else if (fullSeverity.includes("🔵") || fullSeverity.includes("Next sprint"))
      severity = "info";
    else if (fullSeverity.includes("⚪") || fullSeverity.includes("Backlog"))
      severity = "low";
    else if (fullSeverity.includes("🔍") || fullSeverity.includes("Investigate"))
      severity = "investigate";

    const whatMatch = block.match(/- \*\*What:\*\*\s*([\s\S]*?)(?=\n- \*\*|$)/);
    const whyMatch = block.match(/- \*\*Why[^*]*\*\*\s*([\s\S]*?)(?=\n- \*\*|$)/);
    const typeMatch = block.match(/- \*\*Type:\*\*\s*([\s\S]*?)(?=\n- \*\*|$)/);
    const ownerMatch = block.match(/- \*\*Owner:\*\*\s*([\s\S]*?)(?=\n- \*\*|$)/);
    const effortMatch = block.match(/- \*\*Effort:\*\*\s*([\s\S]*?)(?=\n- \*\*|$)/);
    const doneMatch = block.match(/- \*\*Done-when:\*\*\s*([\s\S]*?)(?=\n\n|\n- \*\*|$)/);

    findings.push({
      severity,
      title,
      description: whatMatch?.[1]?.trim() ?? "",
      category: typeMatch?.[1]?.trim() ?? "fix",
      recommendation: {
        what: whatMatch?.[1]?.trim(),
        why: whyMatch?.[1]?.trim(),
        type: typeMatch?.[1]?.trim(),
        owner: ownerMatch?.[1]?.trim(),
        effort: effortMatch?.[1]?.trim(),
        doneWhen: doneMatch?.[1]?.trim(),
      },
    });
  }

  return findings;
}

function findPrecedingSeverityHeader(
  fullText: string,
  block: string
): string {
  const blockIndex = fullText.indexOf(block);
  const before = fullText.substring(0, blockIndex);
  const headers = before.match(/### [^\n]+/g);
  return headers?.[headers.length - 1] ?? "";
}
