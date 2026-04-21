/**
 * Optional multipart fields for grouping runs into a logical "suite" batch and UI layout.
 * Stored in runs.rawMetadata alongside artifact payloads.
 */
export type SkillFamily =
  | "audit"
  | "browser"
  | "discovery"
  | "content"
  | "publish";

export interface SuiteRunFields {
  suiteRunId: string | null;
  /** 1-based phase index from the orchestrator (optional). */
  suitePhase: number | null;
  /** Order within phase or global batch order (optional). */
  suiteOrder: number | null;
  commitSha: string | null;
  version: string | null;
  skillFamily: SkillFamily | null;
  /** Optional structured hints per family; validated lightly on ingest. */
  familyPayload: Record<string, unknown> | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSkillFamily(s: string): s is SkillFamily {
  return (
    s === "audit" ||
    s === "browser" ||
    s === "discovery" ||
    s === "content" ||
    s === "publish"
  );
}

function parseOptionalJsonObject(
  input: FormDataEntryValue | null,
  fieldName: string
): Record<string, unknown> | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string" || !input.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new Error(`${fieldName} must be valid JSON object`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }
  return raw as Record<string, unknown>;
}

/**
 * Parse optional suite + family fields from POST /api/runs multipart body.
 */
export function parseSuiteFieldsFromFormData(formData: FormData): SuiteRunFields {
  const suiteRunIdRaw = formData.get("suiteRunId");
  let suiteRunId: string | null = null;
  if (typeof suiteRunIdRaw === "string" && suiteRunIdRaw.trim()) {
    const t = suiteRunIdRaw.trim();
    if (!UUID_RE.test(t)) {
      throw new Error("suiteRunId must be a UUID v1–v8 string");
    }
    suiteRunId = t.toLowerCase();
  }

  const suitePhaseRaw = formData.get("suitePhase");
  let suitePhase: number | null = null;
  if (typeof suitePhaseRaw === "string" && suitePhaseRaw.trim()) {
    const n = Number(suitePhaseRaw);
    if (!Number.isFinite(n) || n < 0) throw new Error("suitePhase must be a non-negative number");
    suitePhase = Math.floor(n);
  }

  const suiteOrderRaw = formData.get("suiteOrder");
  let suiteOrder: number | null = null;
  if (typeof suiteOrderRaw === "string" && suiteOrderRaw.trim()) {
    const n = Number(suiteOrderRaw);
    if (!Number.isFinite(n) || n < 0) throw new Error("suiteOrder must be a non-negative number");
    suiteOrder = Math.floor(n);
  }

  const commitRaw = formData.get("commitSha");
  const commitSha =
    typeof commitRaw === "string" && commitRaw.trim()
      ? commitRaw.trim().slice(0, 64)
      : null;

  const versionRaw = formData.get("version");
  const version =
    typeof versionRaw === "string" && versionRaw.trim()
      ? versionRaw.trim().slice(0, 64)
      : null;

  const skillFamilyRaw = formData.get("skillFamily");
  let skillFamily: SkillFamily | null = null;
  if (typeof skillFamilyRaw === "string" && skillFamilyRaw.trim()) {
    const f = skillFamilyRaw.trim().toLowerCase();
    if (!isSkillFamily(f)) {
      throw new Error(
        "skillFamily must be one of: audit, browser, discovery, content, publish"
      );
    }
    skillFamily = f;
  }

  const familyPayload = parseOptionalJsonObject(
    formData.get("familyPayload"),
    "familyPayload"
  );

  return {
    suiteRunId,
    suitePhase,
    suiteOrder,
    commitSha,
    version,
    skillFamily,
    familyPayload,
  };
}

export function mergeSuiteFieldsIntoRawMetadata(
  base: Record<string, unknown>,
  suite: SuiteRunFields,
  catalogFamily: SkillFamily | null
): Record<string, unknown> {
  const effectiveFamily = suite.skillFamily ?? catalogFamily;
  const out = { ...base };
  if (suite.suiteRunId) out.suiteRunId = suite.suiteRunId;
  if (suite.suitePhase !== null) out.suitePhase = suite.suitePhase;
  if (suite.suiteOrder !== null) out.suiteOrder = suite.suiteOrder;
  if (suite.commitSha) out.commitSha = suite.commitSha;
  if (suite.version) out.version = suite.version;
  if (effectiveFamily) out.skillFamily = effectiveFamily;
  if (suite.familyPayload && Object.keys(suite.familyPayload).length > 0) {
    out.familyPayload = suite.familyPayload;
  }
  return out;
}
