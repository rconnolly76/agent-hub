import { parseFeatureRoadmapReport } from "./feature-roadmap";
import { parseProductBacklogReport } from "./product-backlog";
import {
  parseJourneyReviewerReport,
  type ParseResult,
} from "./ux-journey-reviewer";

export type { ParseResult };

const parsers: Record<string, (markdown: string) => ParseResult> = {
  "ux-journey-reviewer": parseJourneyReviewerReport,
  "product-backlog": parseProductBacklogReport,
  "feature-roadmap": parseFeatureRoadmapReport,
};

export function getParser(
  skillType: string
): ((markdown: string) => ParseResult) | null {
  return parsers[skillType] ?? null;
}

export function getRegisteredParserIds(): string[] {
  return Object.keys(parsers);
}
