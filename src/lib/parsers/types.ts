/**
 * Per–skill-type ingest settings stored on a project (`projects.skill_parser_config`).
 * Keys are the same strings sent as `skillType` when POSTing `/api/runs`.
 */
export interface SkillParserEntry {
  /**
   * Registry id of the parser implementation (e.g. `ux-journey-reviewer`).
   * Omit or use `"default"` to use the ingest `skillType` as the parser id.
   * Use `"generic"` for markdown executive-summary extraction only (no metrics/findings).
   */
  parserId?: string | null;
  /** Max characters when falling back to a raw report slice (generic parser). */
  executiveSummaryFallbackMaxChars?: number;
}

export type SkillParserConfig = Record<string, SkillParserEntry>;

/** Internal sentinel — not a user-facing skill type. */
export const GENERIC_PARSER_ID = "__generic__";
