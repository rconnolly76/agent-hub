import { db } from "@/lib/db";
import {
  findings,
  projectFindings,
  trendEvents,
  runs,
} from "@/lib/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { defaultFacetForSkill } from "./findings-export";

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

function dedupeKey(
  skillType: string,
  runFindingId: string | null | undefined,
  title: string
): string {
  const part = runFindingId?.trim() || normalizeTitle(title);
  return `${skillType}::${part}`;
}

const SEV_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  warning: 2,
  error: 2,
  info: 3,
  low: 4,
  investigate: 4,
};

function severityRank(s: string): number {
  const k = s.toLowerCase();
  if (k in SEV_ORDER) return SEV_ORDER[k]!;
  return 3;
}

function trendTypeForSeverity(
  before: string,
  after: string
): "improved" | "regressed" | "updated" {
  const a = severityRank(after);
  const b = severityRank(before);
  if (a < b) return "regressed";
  if (a > b) return "improved";
  if (before !== after) return "updated";
  return "updated";
}

/**
 * After a run is ingested, update project-scoped `project_findings` and append `trend_events`
 * (deterministic matching; no LLM).
 */
export async function reconcileAfterIngest(params: {
  projectId: string;
  runId: string;
  skillType: string;
}): Promise<void> {
  const { projectId, runId, skillType } = params;

  const thisRunFindings = await db.query.findings.findMany({
    where: eq(findings.runId, runId),
  });
  const hasThisRun = thisRunFindings.length > 0;

  const [prevRun] = await db
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.projectId, projectId),
        eq(runs.skillType, skillType),
        ne(runs.id, runId)
      )
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);

  const prevByDedupe = new Map<
    string,
    (typeof thisRunFindings)[0]
  >();
  if (prevRun) {
    const prevRowFindings = await db.query.findings.findMany({
      where: eq(findings.runId, prevRun.id),
    });
    for (const f of prevRowFindings) {
      const k = dedupeKey(
        skillType,
        f.runFindingId,
        f.title
      );
      prevByDedupe.set(k, f);
    }
  }

  const nowKeys = new Set<string>();
  for (const f of hasThisRun ? thisRunFindings : []) {
    const defFacet = defaultFacetForSkill(skillType);
    const facet = (f.facet as "health" | "strategy" | undefined) ?? defFacet;
    const key = dedupeKey(skillType, f.runFindingId, f.title);
    nowKeys.add(key);

    const existing = await db.query.projectFindings.findFirst({
      where: and(
        eq(projectFindings.projectId, projectId),
        eq(projectFindings.dedupeKey, key)
      ),
    });

    if (!existing) {
      const [row] = await db
        .insert(projectFindings)
        .values({
          projectId,
          dedupeKey: key,
          skillType,
          facet,
          runFindingId: f.runFindingId,
          title: f.title,
          severity: f.severity,
          status: "open",
          firstRunId: runId,
          lastRunId: runId,
          lastHubFindingId: f.id,
          updatedAt: new Date(),
        })
        .returning();
      if (row) {
        await db.insert(trendEvents).values({
          projectId,
          projectFindingId: row.id,
          type: "new",
          skillType,
          fromRunId: null,
          toRunId: runId,
          detail: { runFindingId: f.runFindingId, title: f.title },
        });
      }
    } else {
      if (f.severity !== existing.severity) {
        const t = trendTypeForSeverity(existing.severity, f.severity);
        await db.insert(trendEvents).values({
          projectId,
          projectFindingId: existing.id,
          type: t,
          skillType,
          fromRunId: existing.lastRunId,
          toRunId: runId,
          detail: {
            fromSeverity: existing.severity,
            toSeverity: f.severity,
          },
        });
      } else if (f.title !== existing.title) {
        await db.insert(trendEvents).values({
          projectId,
          projectFindingId: existing.id,
          type: "updated",
          skillType,
          fromRunId: existing.lastRunId,
          toRunId: runId,
          detail: { title: f.title },
        });
      }

      await db
        .update(projectFindings)
        .set({
          title: f.title,
          severity: f.severity,
          facet,
          runFindingId: f.runFindingId ?? existing.runFindingId,
          lastRunId: runId,
          lastHubFindingId: f.id,
          status: "open",
          updatedAt: new Date(),
        })
        .where(eq(projectFindings.id, existing.id));
    }
  }

  // Resolved: present in previous run for this skill, absent from this run
  if (prevRun) {
    for (const [key, oldF] of prevByDedupe) {
      if (nowKeys.has(key)) continue;
      const existing = await db.query.projectFindings.findFirst({
        where: and(
          eq(projectFindings.projectId, projectId),
          eq(projectFindings.dedupeKey, key)
        ),
      });
      if (existing?.status === "open") {
        await db.insert(trendEvents).values({
          projectId,
          projectFindingId: existing.id,
          type: "resolved",
          skillType,
          fromRunId: prevRun.id,
          toRunId: runId,
          detail: { runFindingId: oldF.runFindingId, title: oldF.title },
        });
        await db
          .update(projectFindings)
          .set({ status: "resolved", lastRunId: runId, updatedAt: new Date() })
          .where(eq(projectFindings.id, existing.id));
      }
    }
  }
}
