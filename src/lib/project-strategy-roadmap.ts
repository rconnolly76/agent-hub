import { db } from "@/lib/db";
import { findings, runs } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export type StrategyRoadmapRow = {
  findingId: string;
  runId: string;
  source: "feature-roadmap" | "product-backlog";
  skillLabel: string;
  itemCode: string;
  headline: string;
  what: string;
  why: string;
  who: string;
  priorityLabel: string;
  /** Lower sorts first within the same source (Now before Next). */
  prioritySort: number;
};

type Rec = {
  /** Plain-language user outcome (preferred for “What” in the strategy UI). */
  userOutcome?: string;
  what?: string;
  why?: string;
  theme?: string;
  epic?: string;
  owner?: string;
};

function parseTitleParts(title: string): { code: string; headline: string } {
  const m = title.match(/^(OP-\d+|BL-\d+)\s*[—\-–]\s*(.+)$/i);
  if (m) {
    return { code: m[1].toUpperCase(), headline: m[2].trim() };
  }
  return { code: "", headline: title.trim() };
}

function categoryToDisplay(category: string | null): {
  label: string;
  sort: number;
} {
  const c = (category ?? "").toLowerCase();
  if (c === "roadmap-now" || c === "backlog-now")
    return { label: "Now", sort: 0 };
  if (c === "roadmap-next" || c === "backlog-next")
    return { label: "Next", sort: 1 };
  if (c === "roadmap-later" || c === "backlog-later")
    return { label: "Later", sort: 2 };
  if (c === "roadmap-gated" || c === "backlog-gated")
    return { label: "Gated", sort: 3 };
  return { label: "Backlog", sort: 4 };
}

function stripThemeNotes(desc: string): string {
  return desc
    .replace(/^Theme:\s*.+$/gim, "")
    .replace(/^Notes:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildRow(
  f: {
    id: string;
    runId: string;
    title: string;
    description: string | null;
    category: string | null;
    recommendation: unknown;
  },
  skillType: "feature-roadmap" | "product-backlog"
): StrategyRoadmapRow {
  const rec = (f.recommendation as Rec | null) ?? {};
  const { code, headline } = parseTitleParts(f.title);
  const { label: priorityLabel, sort: prioritySort } = categoryToDisplay(
    f.category
  );

  const what =
    rec.userOutcome?.trim() ||
    rec.what?.trim() ||
    headline ||
    f.title;

  let why =
    rec.why?.trim() ||
    (f.description ? stripThemeNotes(f.description) : "") ||
    "";
  if (!why || why === what) {
    why =
      f.description && f.description !== what
        ? stripThemeNotes(f.description)
        : "";
  }

  const who =
    rec.theme?.trim() ||
    rec.epic?.trim() ||
    rec.owner?.trim() ||
    (() => {
      const d = f.description ?? "";
      const themeLine = d.match(/^Theme:\s*(.+)$/im)?.[1]?.trim();
      return themeLine || "—";
    })();

  return {
    findingId: f.id,
    runId: f.runId,
    source: skillType,
    skillLabel:
      skillType === "feature-roadmap" ? "Roadmap" : "Backlog",
    itemCode: code,
    headline,
    what,
    why: why || "—",
    who,
    priorityLabel,
    prioritySort,
  };
}

export type ProjectStrategySnapshot = {
  roadmapRun: { id: string; createdAt: Date } | null;
  backlogRun: { id: string; createdAt: Date } | null;
  roadmapRows: StrategyRoadmapRow[];
  backlogRows: StrategyRoadmapRow[];
};

/**
 * Latest `feature-roadmap` + `product-backlog` runs and their findings as strategy rows.
 */
export async function getProjectStrategyRoadmap(
  projectId: string
): Promise<ProjectStrategySnapshot | null> {
  const roadmapRun = await db.query.runs.findFirst({
    where: and(
      eq(runs.projectId, projectId),
      eq(runs.skillType, "feature-roadmap")
    ),
    orderBy: [desc(runs.createdAt)],
    columns: { id: true, createdAt: true },
  });

  const backlogRun = await db.query.runs.findFirst({
    where: and(
      eq(runs.projectId, projectId),
      eq(runs.skillType, "product-backlog")
    ),
    orderBy: [desc(runs.createdAt)],
    columns: { id: true, createdAt: true },
  });

  if (!roadmapRun && !backlogRun) return null;

  const runIds = [roadmapRun?.id, backlogRun?.id].filter(
    Boolean
  ) as string[];

  const findingRows =
    runIds.length > 0
      ? await db.query.findings.findMany({
          where: inArray(findings.runId, runIds),
        })
      : [];

  const byRun = new Map<string, typeof findingRows>();
  for (const row of findingRows) {
    const list = byRun.get(row.runId) ?? [];
    list.push(row);
    byRun.set(row.runId, list);
  }

  const roadmapRows =
    roadmapRun ?
      (byRun.get(roadmapRun.id) ?? [])
        .map((f) => buildRow(f, "feature-roadmap"))
        .sort(
          (a, b) =>
            a.prioritySort - b.prioritySort ||
            a.headline.localeCompare(b.headline)
        )
    : [];

  const backlogRows =
    backlogRun ?
      (byRun.get(backlogRun.id) ?? [])
        .map((f) => buildRow(f, "product-backlog"))
        .sort(
          (a, b) =>
            a.prioritySort - b.prioritySort ||
            a.headline.localeCompare(b.headline)
        )
    : [];

  return {
    roadmapRun: roadmapRun ?? null,
    backlogRun: backlogRun ?? null,
    roadmapRows,
    backlogRows,
  };
}
