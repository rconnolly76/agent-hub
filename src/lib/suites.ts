import type { SkillFamily } from "@/lib/suite-metadata";
import { db } from "@/lib/db";
import { findings, metrics as metricsTable, runs } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

export interface RunRowLite {
  id: string;
  skillType: string;
  createdAt: Date;
  rawMetadata: unknown;
}

export interface SuiteSnapshot {
  suiteRunId: string;
  /** Max createdAt among member runs (proxy for suite completion time). */
  suiteCompletedAt: Date;
  commitSha: string | null;
  version: string | null;
  runs: RunRowLite[];
}

export interface FindingSeverityCount {
  severity: string;
  count: number;
}

function getSuiteId(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const s = (meta as Record<string, unknown>).suiteRunId;
  return typeof s === "string" && s.length > 0 ? s : null;
}

function getStringField(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getSkillFamily(meta: unknown): SkillFamily | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>).skillFamily;
  if (
    v === "audit" ||
    v === "browser" ||
    v === "discovery" ||
    v === "content" ||
    v === "publish"
  ) {
    return v;
  }
  return null;
}

/**
 * Group project runs that carry suiteRunId; each group is one logical suite.
 * Ordered newest suite first (by latest run time in group).
 */
export async function listSuiteSnapshots(projectId: string): Promise<SuiteSnapshot[]> {
  const projectRuns = await db.query.runs.findMany({
    where: eq(runs.projectId, projectId),
    orderBy: (r, { desc: d }) => [d(r.createdAt)],
  });

  const bySuite = new Map<string, typeof projectRuns>();
  for (const run of projectRuns) {
    const sid = getSuiteId(run.rawMetadata);
    if (!sid) continue;
    const list = bySuite.get(sid) ?? [];
    list.push(run);
    bySuite.set(sid, list);
  }

  const snapshots: SuiteSnapshot[] = [];
  for (const [suiteRunId, memberRuns] of bySuite) {
    const suiteCompletedAt = memberRuns.reduce(
      (max, r) => (r.createdAt > max ? r.createdAt : max),
      memberRuns[0].createdAt
    );
    const anyMeta = memberRuns[0].rawMetadata;
    snapshots.push({
      suiteRunId,
      suiteCompletedAt,
      commitSha: getStringField(anyMeta, "commitSha"),
      version: getStringField(anyMeta, "version"),
      runs: memberRuns.map((r) => ({
        id: r.id,
        skillType: r.skillType,
        createdAt: r.createdAt,
        rawMetadata: r.rawMetadata,
      })),
    });
  }

  snapshots.sort((a, b) => b.suiteCompletedAt.getTime() - a.suiteCompletedAt.getTime());
  return snapshots;
}

async function metricsByRunId(
  runIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(metricsTable)
    .where(inArray(metricsTable.runId, runIds));
  const map = new Map<string, Record<string, number>>();
  for (const m of rows) {
    const cur = map.get(m.runId) ?? {};
    cur[m.key] = m.value;
    map.set(m.runId, cur);
  }
  return map;
}

/** Count findings grouped by severity for a set of run ids. */
export async function rollupSuiteFindings(snapshot: SuiteSnapshot): Promise<{
  totalFindings: number;
  critical: number;
  warning: number;
}> {
  const ids = snapshot.runs.map((r) => r.id);
  const sev = await findingsSeverityByRun(ids);
  let totalFindings = 0;
  let critical = 0;
  let warning = 0;
  for (const rid of ids) {
    for (const row of sev.get(rid) ?? []) {
      totalFindings += row.count;
      if (row.severity === "critical") critical += row.count;
      if (row.severity === "warning") warning += row.count;
    }
  }
  return { totalFindings, critical, warning };
}

export async function findingsSeverityByRun(
  runIds: string[]
): Promise<Map<string, FindingSeverityCount[]>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select({
      runId: findings.runId,
      severity: findings.severity,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(findings)
    .where(inArray(findings.runId, runIds))
    .groupBy(findings.runId, findings.severity);
  const map = new Map<string, FindingSeverityCount[]>();
  for (const row of rows) {
    const list = map.get(row.runId) ?? [];
    list.push({ severity: row.severity, count: Number(row.count) });
    map.set(row.runId, list);
  }
  return map;
}

/** Category histogram for runs (latest suite analytics). */
export async function findingsCategoryHistogram(
  runIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (runIds.length === 0) return new Map();
  const rows = await db
    .select({
      runId: findings.runId,
      category: sql<string>`coalesce(${findings.category}, 'uncategorized')`.as(
        "category"
      ),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(findings)
    .where(inArray(findings.runId, runIds))
    .groupBy(findings.runId, findings.category);
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const cur = map.get(row.runId) ?? {};
    cur[row.category] = Number(row.count);
    map.set(row.runId, cur);
  }
  return map;
}

/** Merged category totals across multiple runs (e.g. one suite). */
export async function aggregateCategoryTotals(
  runIds: string[]
): Promise<Record<string, number>> {
  const hist = await findingsCategoryHistogram(runIds);
  const out: Record<string, number> = {};
  for (const rid of runIds) {
    const row = hist.get(rid) ?? {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

/** Async enrich compare with real counts from DB. */
export async function compareSuitesDetailed(
  projectId: string,
  currentSuiteId: string,
  mode: "previous" | string
): Promise<{
  current: SuiteSnapshot | null;
  previous: SuiteSnapshot | null;
  findingsDeltaBySkill: Record<string, number>;
  criticalDeltaBySkill: Record<string, number>;
  warningDeltaBySkill: Record<string, number>;
  categoryShiftBySkill: Record<string, Record<string, number>>;
}> {
  const suites = await listSuiteSnapshots(projectId);
  const current = suites.find((s) => s.suiteRunId === currentSuiteId) ?? null;
  if (!current) {
    return {
      current: null,
      previous: null,
      findingsDeltaBySkill: {},
      criticalDeltaBySkill: {},
      warningDeltaBySkill: {},
      categoryShiftBySkill: {},
    };
  }

  const idx = suites.findIndex((s) => s.suiteRunId === currentSuiteId);
  const previous =
    mode === "previous" && idx !== -1 && idx + 1 < suites.length
      ? suites[idx + 1]
      : null;

  if (!previous) {
    return {
      current,
      previous: null,
      findingsDeltaBySkill: {},
      criticalDeltaBySkill: {},
      warningDeltaBySkill: {},
      categoryShiftBySkill: {},
    };
  }

  const currIds = new Map(current.runs.map((r) => [r.skillType, r.id]));
  const prevIds = new Map(previous.runs.map((r) => [r.skillType, r.id]));

  const allRunIds = [...currIds.values(), ...prevIds.values()];
  const severities = await findingsSeverityByRun(allRunIds);
  const metricsMap = await metricsByRunId(allRunIds);

  const findingsDeltaBySkill: Record<string, number> = {};
  const criticalDeltaBySkill: Record<string, number> = {};
  const warningDeltaBySkill: Record<string, number> = {};
  const categoryShiftBySkill: Record<string, Record<string, number>> = {};

  const skills = new Set([...currIds.keys(), ...prevIds.keys()]);
  for (const st of skills) {
    const cId = currIds.get(st);
    const pId = prevIds.get(st);
    const cTotal = cId
      ? [...(severities.get(cId) ?? [])].reduce((s, x) => s + x.count, 0)
      : 0;
    const pTotal = pId
      ? [...(severities.get(pId) ?? [])].reduce((s, x) => s + x.count, 0)
      : 0;
    findingsDeltaBySkill[st] = cTotal - pTotal;

    const cCrit = cId ? metricsMap.get(cId)?.severity_critical ?? 0 : 0;
    const pCrit = pId ? metricsMap.get(pId)?.severity_critical ?? 0 : 0;
    criticalDeltaBySkill[st] = cCrit - pCrit;

    const cWarn = cId ? metricsMap.get(cId)?.severity_warning ?? 0 : 0;
    const pWarn = pId ? metricsMap.get(pId)?.severity_warning ?? 0 : 0;
    warningDeltaBySkill[st] = cWarn - pWarn;

    const catCurr = cId ? await categoryDeltaForRun(cId, pId) : {};
    if (Object.keys(catCurr).length > 0) {
      categoryShiftBySkill[st] = catCurr;
    }
  }

  return {
    current,
    previous,
    findingsDeltaBySkill,
    criticalDeltaBySkill,
    warningDeltaBySkill,
    categoryShiftBySkill,
  };
}

async function categoryDeltaForRun(
  currentRunId: string,
  previousRunId: string | undefined
): Promise<Record<string, number>> {
  const [curr, prev] = await Promise.all([
    db
      .select({
        category: sql<string>`coalesce(${findings.category}, 'uncategorized')`,
        count: sql<number>`count(*)::int`,
      })
      .from(findings)
      .where(eq(findings.runId, currentRunId))
      .groupBy(findings.category),
    previousRunId
      ? db
          .select({
            category: sql<string>`coalesce(${findings.category}, 'uncategorized')`,
            count: sql<number>`count(*)::int`,
          })
          .from(findings)
          .where(eq(findings.runId, previousRunId))
          .groupBy(findings.category)
      : Promise.resolve([] as { category: string; count: number }[]),
  ]);

  const prevMap = new Map(prev.map((r) => [r.category, Number(r.count)]));
  const out: Record<string, number> = {};
  for (const row of curr) {
    const c = row.category;
    const delta = Number(row.count) - (prevMap.get(c) ?? 0);
    if (delta !== 0) out[c] = delta;
  }
  return out;
}

export type { SkillFamily };
export { getSkillFamily };
