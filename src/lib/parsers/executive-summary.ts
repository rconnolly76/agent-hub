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
