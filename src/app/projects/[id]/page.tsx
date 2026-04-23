import { db } from "@/lib/db";
import { runs, metrics, findings } from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  aggregateCategoryTotals,
  listSuiteSnapshots,
  rollupSuiteFindings,
} from "@/lib/suites";
import {
  getProjectStrategyRoadmap,
  type StrategyRoadmapRow,
} from "@/lib/project-strategy-roadmap";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return { title: "Not Found" };
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  return { title: project?.name ?? "Project" };
}

// ── Design tokens (mirror the Direction A mock) ──────────────────────────
const SEV = {
  critical: { fg: "#ef4444", dot: "#ef4444" },
  warning: { fg: "#f59e0b", dot: "#f59e0b" },
  passing: { fg: "#10b981", dot: "#10b981" },
};

const HORIZON: Record<
  string,
  { fg: string; bg: string; border: string; dot: string }
> = {
  Now: {
    fg: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.30)",
    dot: "#10b981",
  },
  Next: {
    fg: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.30)",
    dot: "#60a5fa",
  },
  Later: {
    fg: "#a1a1aa",
    bg: "rgba(161,161,170,0.10)",
    border: "rgba(161,161,170,0.24)",
    dot: "#a1a1aa",
  },
  Gated: {
    fg: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.30)",
    dot: "#f59e0b",
  },
};

const STATE_STYLE = {
  "on-track": {
    fg: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.32)",
    label: "ON TRACK",
  },
  attention: {
    fg: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.32)",
    label: "NEEDS ATTENTION",
  },
  critical: {
    fg: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.32)",
    label: "AT RISK",
  },
} as const;

type StateKey = keyof typeof STATE_STYLE;

const ACCENT = "#8b5cf6";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatSkillType(type: string): string {
  return type
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function severityOf(
  critical: number,
  warning: number
): "critical" | "warning" | "passing" {
  if (critical > 0) return "critical";
  if (warning > 0) return "warning";
  return "passing";
}

function stateKey(critical: number, warning: number): StateKey {
  if (critical > 0) return "critical";
  if (warning > 0) return "attention";
  return "on-track";
}

// ── Page ────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return notFound();

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  if (!project) return notFound();

  const strategySnapshot = await getProjectStrategyRoadmap(id);

  const suiteSnapshots = await listSuiteSnapshots(id);
  const suiteCards = await Promise.all(
    suiteSnapshots.map(async (s, idx) => ({
      snapshot: s,
      rollup: await rollupSuiteFindings(s),
      canCompareToPrevious: idx + 1 < suiteSnapshots.length,
    }))
  );

  const latestSuiteCategoryMix =
    suiteCards[0] && suiteCards[0].snapshot.runs.length > 0
      ? await aggregateCategoryTotals(
          suiteCards[0].snapshot.runs.map((r) => r.id)
        )
      : null;

  const projectRuns = await db.query.runs.findMany({
    where: eq(runs.projectId, id),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const runIds = projectRuns.map((r) => r.id);

  const [allMetrics, findingCounts] =
    runIds.length > 0
      ? await Promise.all([
          db.select().from(metrics).where(inArray(metrics.runId, runIds)),
          db
            .select({
              runId: findings.runId,
              count: sql<number>`count(*)`.as("count"),
            })
            .from(findings)
            .where(inArray(findings.runId, runIds))
            .groupBy(findings.runId),
        ])
      : [[], []];

  const metricsByRun = new Map<string, Record<string, number>>();
  for (const m of allMetrics) {
    const cur = metricsByRun.get(m.runId) ?? {};
    cur[m.key] = m.value;
    metricsByRun.set(m.runId, cur);
  }
  const findingsByRun = new Map<string, number>();
  for (const f of findingCounts) {
    findingsByRun.set(f.runId, Number(f.count));
  }

  // ── Skill health (last 20 runs per skill) ─────────────────────────────
  const runsBySkill = new Map<string, typeof projectRuns>();
  for (const r of projectRuns) {
    const list = runsBySkill.get(r.skillType) ?? [];
    list.push(r);
    runsBySkill.set(r.skillType, list);
  }

  const skillOrder: string[] = [];
  const seen = new Set<string>();
  for (const r of projectRuns) {
    if (!seen.has(r.skillType)) {
      seen.add(r.skillType);
      skillOrder.push(r.skillType);
    }
  }

  type SkillHealth = {
    type: string;
    label: string;
    latestAt: Date;
    runs: number;
    findings: number;
    critical: number;
    warning: number;
    trend: Array<"c" | "w" | "h">;
  };

  const skills: SkillHealth[] = skillOrder.map((type) => {
    const bucket = runsBySkill.get(type)!;
    const latest = bucket[0];
    const latestMetrics = metricsByRun.get(latest.id) ?? {};
    const critical = latestMetrics.severity_critical ?? 0;
    const warning = latestMetrics.severity_warning ?? 0;
    const findingsCount = findingsByRun.get(latest.id) ?? 0;

    // oldest → newest so the sparkline reads left-to-right in time
    const trendRuns = bucket.slice(0, 20).reverse();
    const trend = trendRuns.map<"c" | "w" | "h">((r) => {
      const m = metricsByRun.get(r.id) ?? {};
      if ((m.severity_critical ?? 0) > 0) return "c";
      if ((m.severity_warning ?? 0) > 0) return "w";
      return "h";
    });

    return {
      type,
      label: formatSkillType(type),
      latestAt: latest.createdAt,
      runs: bucket.length,
      findings: findingsCount,
      critical,
      warning,
      trend,
    };
  });

  // ── Verdict & hero stats ──────────────────────────────────────────────
  const latest = suiteCards[0];
  const prev = suiteCards[1];
  const counts = {
    critical: latest?.rollup.critical ?? 0,
    warning: latest?.rollup.warning ?? 0,
    findings: latest?.rollup.totalFindings ?? 0,
  };
  const deltaCritical = prev
    ? counts.critical - prev.rollup.critical
    : 0;

  const verdictState = stateKey(counts.critical, counts.warning);
  const verdictStyle = STATE_STYLE[verdictState];

  const verdictHeadline =
    verdictState === "on-track"
      ? `On track — latest suite clean across ${latest?.snapshot.runs.length ?? 0} skill${latest?.snapshot.runs.length === 1 ? "" : "s"}.`
      : verdictState === "attention"
        ? `Needs attention — ${counts.warning} warning${counts.warning === 1 ? "" : "s"} in the latest suite.`
        : `At risk — ${counts.critical} critical finding${counts.critical === 1 ? "" : "s"} in the latest suite.`;

  const verdictSummary = latest
    ? `Latest suite: ${counts.findings} finding${counts.findings === 1 ? "" : "s"} · ${counts.critical} critical · ${counts.warning} warning${counts.warning === 1 ? "" : "s"}.` +
      (prev
        ? ` ${deltaCritical === 0 ? "No change in" : deltaCritical < 0 ? "Down " + Math.abs(deltaCritical) + " on" : "Up " + deltaCritical + " on"} criticals vs previous suite.`
        : "")
    : "No suites have run yet for this project.";

  // ── Category mix (top 3, with tones) ──────────────────────────────────
  const categoryMix = latestSuiteCategoryMix
    ? Object.entries(latestSuiteCategoryMix)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, n], i) => ({
          cat,
          n,
          tone:
            i === 0
              ? ("primary" as const)
              : i === 1
                ? ("warn" as const)
                : ("muted" as const),
        }))
    : [];

  // ── Roadmap by horizon ────────────────────────────────────────────────
  const roadmapRows: StrategyRoadmapRow[] = strategySnapshot?.roadmapRows ?? [];
  const backlogRows: StrategyRoadmapRow[] =
    strategySnapshot?.backlogRows ?? [];
  const allStrategyRows =
    roadmapRows.length > 0 ? roadmapRows : backlogRows;

  const horizons = ["Now", "Next", "Later", "Gated"] as const;
  const byHorizon = Object.fromEntries(
    horizons.map((h) => [
      h,
      allStrategyRows.filter((r) => r.priorityLabel === h),
    ])
  ) as Record<(typeof horizons)[number], StrategyRoadmapRow[]>;

  // ── Guardrails (derived from gated strategy rows) ─────────────────────
  const guardrails = byHorizon.Gated.slice(0, 4).map((r) => ({
    title: r.what,
    note: r.why,
    tag: "Gated",
  }));

  const lastSuiteAgo = latest
    ? formatAgo(latest.snapshot.suiteCompletedAt)
    : "—";
  const commitShort = latest?.snapshot.commitSha?.slice(0, 7) ?? null;

  return (
    <div
      style={{
        background: "#0a0a0a",
        color: "#fafafa",
        minHeight: "100vh",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
        letterSpacing: -0.005,
      }}
    >
      <div style={{ padding: "28px 44px 56px" }}>
        {/* Breadcrumbs */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "rgba(250,250,250,0.55)",
            marginBottom: 18,
          }}
        >
          <Link
            href="/"
            style={{ color: "rgba(250,250,250,0.55)", textDecoration: "none" }}
          >
            Projects
          </Link>
          <span style={{ color: "rgba(250,250,250,0.25)" }}>/</span>
          <span style={{ color: "rgba(250,250,250,0.85)", fontWeight: 500 }}>
            {project.name}
          </span>
        </nav>

        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: -0.8,
              }}
            >
              {project.name}
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: verdictStyle.fg,
                background: verdictStyle.bg,
                border: `1px solid ${verdictStyle.border}`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: verdictStyle.fg,
                  boxShadow: `0 0 10px ${verdictStyle.fg}`,
                }}
              />
              {verdictStyle.label}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12,
              color: "rgba(250,250,250,0.6)",
              flexWrap: "wrap",
            }}
          >
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "rgba(250,250,250,0.6)",
                  textDecoration: "none",
                }}
              >
                {project.repoUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span style={{ opacity: 0.3 }}>·</span>
            <code
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {project.apiKey.slice(0, 8)}…
            </code>
            {commitShort && (
              <>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>
                  commit{" "}
                  <code
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                    }}
                  >
                    {commitShort}
                  </code>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Verdict hero */}
        <Card
          style={{
            marginTop: 18,
            padding: 24,
            display: "grid",
            gridTemplateColumns: "1.35fr 1fr",
            gap: 28,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: "rgba(250,250,250,0.5)",
                marginBottom: 8,
              }}
            >
              State of {project.name} · {lastSuiteAgo}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.3,
                letterSpacing: -0.3,
                fontWeight: 600,
                maxWidth: 620,
              }}
            >
              {verdictHeadline}
            </h2>
            <p
              style={{
                marginTop: 10,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "rgba(250,250,250,0.7)",
                maxWidth: 620,
              }}
            >
              {verdictSummary}
            </p>
          </div>

          {/* Right: rollup tiles */}
          <div
            style={{
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              paddingLeft: 28,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <RollupTile
                n={counts.critical}
                label="Critical"
                tone={counts.critical > 0 ? "critical" : "ok"}
              />
              <RollupTile
                n={counts.warning}
                label="Warnings"
                tone={counts.warning > 0 ? "warning" : "ok"}
              />
              <RollupTile n={counts.findings} label="Findings" tone="info" />
            </div>
            {prev && (
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(250,250,250,0.55)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color:
                      deltaCritical < 0
                        ? "#10b981"
                        : deltaCritical > 0
                          ? "#ef4444"
                          : "rgba(250,250,250,0.6)",
                    fontWeight: 600,
                  }}
                >
                  {deltaCritical > 0
                    ? `+${deltaCritical}`
                    : deltaCritical === 0
                      ? "±0"
                      : deltaCritical}
                </span>
                criticals vs previous suite ·{" "}
                <code
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    color: "rgba(250,250,250,0.55)",
                  }}
                >
                  {prev.snapshot.suiteRunId.slice(0, 8)}
                </code>
              </div>
            )}
            {categoryMix.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(250,250,250,0.45)",
                    marginBottom: 6,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  Findings mix
                </div>
                <StackedBar items={categoryMix} />
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 8,
                    fontSize: 11,
                    color: "rgba(250,250,250,0.6)",
                    flexWrap: "wrap",
                  }}
                >
                  {categoryMix.map((c) => (
                    <span
                      key={c.cat}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 2,
                          background:
                            c.tone === "primary"
                              ? "#8b5cf6"
                              : c.tone === "warn"
                                ? "#f59e0b"
                                : "rgba(255,255,255,0.4)",
                        }}
                      />
                      {c.cat}{" "}
                      <span
                        style={{
                          color: "rgba(250,250,250,0.9)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {c.n}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Roadmap kanban */}
        {allStrategyRows.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <SectionHeader
              eyebrow={`Roadmap & backlog · from ${
                roadmapRows.length > 0 ? "feature-roadmap" : "product-backlog"
              } run`}
              title="Horizons"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              {horizons.map((h) => (
                <HorizonColumn key={h} horizon={h} items={byHorizon[h]} />
              ))}
            </div>
          </div>
        )}

        {/* Skill health + guardrails */}
        {skills.length > 0 && (
          <div
            style={{
              marginTop: 40,
              display: "grid",
              gridTemplateColumns: guardrails.length > 0 ? "1.6fr 1fr" : "1fr",
              gap: 18,
            }}
          >
            <div>
              <SectionHeader
                eyebrow={`${skills.length} skill${skills.length === 1 ? "" : "s"} · ${projectRuns.length} total run${projectRuns.length === 1 ? "" : "s"}`}
                title="Skill health"
                right={
                  <span
                    style={{ fontSize: 11, color: "rgba(250,250,250,0.5)" }}
                  >
                    last 20 runs →
                  </span>
                }
              />
              <Card padding={0}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 84px 1fr 90px 60px",
                    gap: 0,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    color: "rgba(250,250,250,0.4)",
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span>Skill</span>
                  <span>Latest</span>
                  <span>Trend · last 20</span>
                  <span style={{ textAlign: "right" }}>Findings</span>
                  <span style={{ textAlign: "right" }}>Runs</span>
                </div>
                {skills.map((s, i) => (
                  <SkillRow key={s.type} s={s} last={i === skills.length - 1} />
                ))}
              </Card>
            </div>

            {guardrails.length > 0 && (
              <div>
                <SectionHeader
                  eyebrow="Guardrails"
                  title="Cross-skill constraints"
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {guardrails.map((g) => (
                    <Card key={g.title} padding={14}>
                      <div style={{ marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            color: "#f59e0b",
                          }}
                        >
                          {g.tag}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          letterSpacing: -0.1,
                        }}
                      >
                        {g.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(250,250,250,0.6)",
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        {g.note}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suite timeline */}
        {suiteCards.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <SectionHeader
              eyebrow={`${suiteCards.length} recent · grouped by suiteRunId`}
              title="Suite snapshots"
            />
            <Card padding={0}>
              {suiteCards.map((sc, i) => (
                <SuiteRow
                  key={sc.snapshot.suiteRunId}
                  projectId={id}
                  sc={sc}
                  prev={suiteCards[i + 1]}
                  last={i === suiteCards.length - 1}
                />
              ))}
            </Card>
          </div>
        )}

        {/* Empty state */}
        {projectRuns.length === 0 && (
          <Card style={{ marginTop: 40, padding: "56px 24px", textAlign: "center" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "rgba(250,250,250,0.75)",
                margin: 0,
              }}
            >
              No runs yet for this project.
            </p>
            <p
              style={{
                fontSize: 13,
                color: "rgba(250,250,250,0.55)",
                marginTop: 8,
                marginBottom: 20,
              }}
            >
              Push your first skill run using the CLI. Your API key is shown
              above.
            </p>
            <code
              style={{
                display: "inline-block",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(250,250,250,0.75)",
                padding: "10px 14px",
                borderRadius: 6,
              }}
            >
              node agent-hub-push.mjs --endpoint https://your-hub.vercel.app
              --key {project.apiKey.slice(0, 8)}…
            </code>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Shared presentational components ────────────────────────────────────

function Card({
  children,
  padding = 18,
  style = {},
}: {
  children: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 14,
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "rgba(250,250,250,0.45)",
              marginBottom: 4,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function RollupTile({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "critical" | "warning" | "ok" | "info";
}) {
  const color =
    tone === "critical"
      ? "#ef4444"
      : tone === "warning"
        ? "#f59e0b"
        : tone === "ok"
          ? "#10b981"
          : "#a78bfa";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 8,
        background: `${color}11`,
        border: `1px solid ${color}33`,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color,
          letterSpacing: -0.8,
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(250,250,250,0.7)",
          marginTop: 6,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function StackedBar({
  items,
  height = 8,
}: {
  items: Array<{ cat: string; n: number; tone: "primary" | "warn" | "muted" }>;
  height?: number;
}) {
  const total = items.reduce((a, b) => a + b.n, 0) || 1;
  const color = (t: string) =>
    t === "primary"
      ? "#8b5cf6"
      : t === "warn"
        ? "#f59e0b"
        : "rgba(255,255,255,0.4)";
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        height,
        borderRadius: 4,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      {items.map((it) => (
        <div
          key={it.cat}
          style={{
            flex: it.n / total,
            background: color(it.tone),
            opacity: 0.85,
          }}
          title={`${it.cat} · ${it.n}`}
        />
      ))}
    </div>
  );
}

function HorizonColumn({
  horizon,
  items,
}: {
  horizon: keyof typeof HORIZON;
  items: StrategyRoadmapRow[];
}) {
  const c = HORIZON[horizon];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2px 10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: c.dot,
              boxShadow: `0 0 8px ${c.dot}66`,
            }}
          />
          <span
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.1 }}
          >
            {horizon}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(250,250,250,0.45)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {items.length}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 10,
          padding: 8,
          minHeight: 300,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "rgba(250,250,250,0.35)",
              textAlign: "center",
              padding: "16px 8px",
            }}
          >
            No items
          </div>
        ) : (
          items.map((r) => <RoadmapCard key={r.findingId} row={r} />)
        )}
      </div>
    </div>
  );
}

function RoadmapCard({ row }: { row: StrategyRoadmapRow }) {
  return (
    <Link
      href={`/runs/${row.runId}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          padding: "12px 13px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {row.itemCode && (
            <code
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                color: ACCENT,
                fontWeight: 600,
                letterSpacing: 0.3,
              }}
            >
              {row.itemCode}
            </code>
          )}
          {row.itemCode && (
            <span style={{ fontSize: 10, color: "rgba(250,250,250,0.4)" }}>
              ·
            </span>
          )}
          <span style={{ fontSize: 10, color: "rgba(250,250,250,0.55)" }}>
            {row.skillLabel}
          </span>
          <span
            style={{ marginLeft: "auto", display: "flex", gap: 5 }}
          >
            {row.score != null && <ScorePill n={row.score} />}
            {row.effort && <EffortChip e={row.effort} />}
          </span>
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: -0.1,
            lineHeight: 1.3,
          }}
        >
          {row.what}
        </div>
        {row.why && row.why !== "—" && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(250,250,250,0.62)",
              lineHeight: 1.5,
            }}
          >
            {row.why}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 2,
            fontSize: 11,
            color: "rgba(250,250,250,0.55)",
            flexWrap: "wrap",
          }}
        >
          {row.who && row.who !== "—" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {row.who}
            </span>
          )}
          {row.linked.length > 0 && (
            <>
              {row.who && row.who !== "—" && (
                <span style={{ opacity: 0.3 }}>·</span>
              )}
              <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                {row.linked.map((l) => (
                  <code
                    key={l}
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(250,250,250,0.7)",
                    }}
                  >
                    {l}
                  </code>
                ))}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

function ScorePill({ n }: { n: number }) {
  const hue = n >= 4.2 ? "#10b981" : n >= 3.6 ? "#f59e0b" : "#a1a1aa";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: hue,
        background: `${hue}18`,
        border: `1px solid ${hue}44`,
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {n.toFixed(1)}
    </span>
  );
}

function EffortChip({ e }: { e: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        color: "rgba(250,250,250,0.7)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {e}
    </span>
  );
}

function Sparkline({
  trend,
  size = 8,
  gap = 2,
}: {
  trend: Array<"c" | "w" | "h">;
  size?: number;
  gap?: number;
}) {
  const len = Math.max(1, trend.length);
  return (
    <div style={{ display: "flex", gap, alignItems: "center" }}>
      {trend.map((ch, i) => {
        const c =
          ch === "c" ? "#ef4444" : ch === "w" ? "#f59e0b" : "#10b981";
        const alpha = 0.35 + (i / len) * 0.65;
        return (
          <span
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: 2,
              background: c,
              opacity: alpha,
            }}
          />
        );
      })}
    </div>
  );
}

function SkillRow({
  s,
  last,
}: {
  s: {
    type: string;
    label: string;
    latestAt: Date;
    runs: number;
    findings: number;
    critical: number;
    warning: number;
    trend: Array<"c" | "w" | "h">;
  };
  last: boolean;
}) {
  const sev = severityOf(s.critical, s.warning);
  const dot = SEV[sev].dot;
  const findingsColor =
    s.critical > 0
      ? "#ef4444"
      : s.warning > 0
        ? "#f59e0b"
        : "rgba(250,250,250,0.75)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 84px 1fr 90px 60px",
        gap: 0,
        alignItems: "center",
        padding: "10px 16px",
        borderBottom: last
          ? "none"
          : "1px solid rgba(255,255,255,0.04)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: dot,
            boxShadow: `0 0 6px ${dot}66`,
          }}
        />
        <span style={{ fontWeight: 500 }}>{s.label}</span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(250,250,250,0.55)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatTimeShort(s.latestAt)}
      </div>
      <Sparkline trend={s.trend} />
      <div
        style={{
          fontSize: 11,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: findingsColor,
        }}
      >
        {s.findings}{" "}
        <span style={{ color: "rgba(250,250,250,0.4)", fontWeight: 400 }}>
          findings
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          textAlign: "right",
          color: "rgba(250,250,250,0.55)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {s.runs}
      </div>
    </div>
  );
}

function DeltaChip({ n }: { n: number }) {
  if (n === 0) return null;
  const good = n < 0;
  const c = good ? "#10b981" : "#ef4444";
  const sign = n > 0 ? "+" : "";
  return (
    <span style={{ marginLeft: 6, fontSize: 10, color: c, fontWeight: 600 }}>
      {sign}
      {n}
    </span>
  );
}

function SuiteRow({
  projectId,
  sc,
  prev,
  last,
}: {
  projectId: string;
  sc: {
    snapshot: { suiteRunId: string; suiteCompletedAt: Date; commitSha: string | null; runs: Array<unknown> };
    rollup: { totalFindings: number; critical: number; warning: number };
    canCompareToPrevious: boolean;
  };
  prev?: {
    rollup: { totalFindings: number; critical: number; warning: number };
  };
  last: boolean;
}) {
  const sev = severityOf(sc.rollup.critical, sc.rollup.warning);
  const dot = SEV[sev].dot;
  const dF = prev ? sc.rollup.totalFindings - prev.rollup.totalFindings : 0;
  const dC = prev ? sc.rollup.critical - prev.rollup.critical : 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 90px 1fr 110px 110px 90px 70px",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: last
          ? "none"
          : "1px solid rgba(255,255,255,0.04)",
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 500 }}>
        {formatDateShort(sc.snapshot.suiteCompletedAt)}
        <div
          style={{
            fontSize: 10,
            color: "rgba(250,250,250,0.5)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTimeShort(sc.snapshot.suiteCompletedAt)}
        </div>
      </div>
      <code
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          color: "rgba(250,250,250,0.55)",
        }}
      >
        {sc.snapshot.suiteRunId.slice(0, 8)}…
      </code>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: dot,
          }}
        />
        {sc.snapshot.commitSha && (
          <code
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 10,
              color: "rgba(250,250,250,0.55)",
            }}
          >
            {sc.snapshot.commitSha.slice(0, 7)}
          </code>
        )}
        <span style={{ fontSize: 11, color: "rgba(250,250,250,0.4)" }}>
          · {sc.snapshot.runs.length} skill
          {sc.snapshot.runs.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontWeight: 600 }}>{sc.rollup.totalFindings}</span>{" "}
        <span style={{ color: "rgba(250,250,250,0.45)" }}>findings</span>
        {prev && <DeltaChip n={dF} />}
      </div>
      <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
        <span
          style={{
            fontWeight: 600,
            color:
              sc.rollup.critical > 0
                ? "#ef4444"
                : "rgba(250,250,250,0.85)",
          }}
        >
          {sc.rollup.critical}
        </span>{" "}
        <span style={{ color: "rgba(250,250,250,0.45)" }}>crit</span>
        {prev && <DeltaChip n={dC} />}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "rgba(250,250,250,0.55)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {sc.rollup.warning} warn
      </div>
      {sc.canCompareToPrevious ? (
        <Link
          href={`/projects/${projectId}/suites/${sc.snapshot.suiteRunId}/compare`}
          style={{
            fontSize: 11,
            color: "rgba(250,250,250,0.7)",
            textAlign: "right",
            textDecoration: "none",
          }}
        >
          Compare →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
