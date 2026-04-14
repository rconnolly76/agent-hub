import {
  parseJourneyReviewerReport,
  type ParseResult,
} from "./ux-journey-reviewer";

export type { ParseResult };

const parsers: Record<string, (markdown: string) => ParseResult> = {
  "ux-journey-reviewer": parseJourneyReviewerReport,
};

export function getParser(
  skillType: string
): ((markdown: string) => ParseResult) | null {
  return parsers[skillType] ?? null;
}

export function getSupportedSkillTypes(): string[] {
  return Object.keys(parsers);
}
