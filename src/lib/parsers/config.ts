import type { SkillParserConfig, SkillParserEntry } from "./types";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validates and normalizes client-provided `skillParserConfig` for project registration/updates.
 */
export function parseSkillParserConfig(input: unknown): SkillParserConfig | undefined {
  if (input == null || input === "") return undefined;
  if (!isPlainObject(input)) {
    throw new Error("skillParserConfig must be a JSON object");
  }
  const out: SkillParserConfig = {};
  for (const [skillType, raw] of Object.entries(input)) {
    const key = skillType.trim();
    if (!key) continue;
    if (raw == null) continue;
    if (!isPlainObject(raw)) {
      throw new Error(`skillParserConfig["${skillType}"] must be an object`);
    }
    const entry: SkillParserEntry = {};
    if ("parserId" in raw && raw.parserId != null) {
      if (typeof raw.parserId !== "string") {
        throw new Error(`skillParserConfig["${skillType}"].parserId must be a string`);
      }
      entry.parserId = raw.parserId.trim() || null;
    }
    if (
      "executiveSummaryFallbackMaxChars" in raw &&
      raw.executiveSummaryFallbackMaxChars != null
    ) {
      const n = Number(raw.executiveSummaryFallbackMaxChars);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
        throw new Error(
          `skillParserConfig["${skillType}"].executiveSummaryFallbackMaxChars must be between 0 and 10000000`
        );
      }
      entry.executiveSummaryFallbackMaxChars = Math.floor(n);
    }
    out[key] = entry;
  }
  return out;
}

/** Validates a single ingest override object (same shape as one entry in skillParserConfig). */
export function parseSkillParserOverride(input: unknown): SkillParserEntry | undefined {
  if (input == null || input === "") return undefined;
  if (!isPlainObject(input)) {
    throw new Error("skillParserOverride must be a JSON object");
  }
  const entry: SkillParserEntry = {};
  if ("parserId" in input && input.parserId != null) {
    if (typeof input.parserId !== "string") {
      throw new Error("skillParserOverride.parserId must be a string");
    }
    entry.parserId = input.parserId.trim() || null;
  }
  if (
    "executiveSummaryFallbackMaxChars" in input &&
    input.executiveSummaryFallbackMaxChars != null
  ) {
    const n = Number(input.executiveSummaryFallbackMaxChars);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      throw new Error(
        "skillParserOverride.executiveSummaryFallbackMaxChars must be between 0 and 10000000"
      );
    }
    entry.executiveSummaryFallbackMaxChars = Math.floor(n);
  }
  return entry;
}
