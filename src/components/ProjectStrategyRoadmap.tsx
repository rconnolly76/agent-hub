import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoadmapMarkdown } from "@/components/RoadmapMarkdown";
import type {
  ProjectStrategySnapshot,
  StrategyRoadmapRow,
} from "@/lib/project-strategy-roadmap";

function priorityBadgeClass(label: string): string {
  switch (label) {
    case "Now":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Next":
      return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    case "Later":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/25";
    case "Gated":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function RoadmapCard({ row }: { row: StrategyRoadmapRow }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card/40 p-4 transition-colors hover:bg-card/60">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${priorityBadgeClass(row.priorityLabel)}`}
          >
            {row.priorityLabel}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-medium">
            {row.skillLabel}
          </Badge>
          {row.itemCode ? (
            <code className="text-[10px] text-muted-foreground font-mono">
              {row.itemCode}
            </code>
          ) : null}
        </div>
        <Link
          href={`/runs/${row.runId}`}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
        >
          View run
        </Link>
      </div>
      <h3 className="text-sm font-semibold text-foreground leading-snug mb-2">
        {row.headline || row.what}
      </h3>
      <dl className="space-y-2 text-[13px] leading-relaxed">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90 mb-0.5">
            What
          </dt>
          <dd className="text-muted-foreground">
            <RoadmapMarkdown content={row.what} />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90 mb-0.5">
            Why
          </dt>
          <dd className="text-muted-foreground/95">
            <RoadmapMarkdown content={row.why} />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/90 mb-0.5">
            Who / where it lives
          </dt>
          <dd className="text-muted-foreground">
            <RoadmapMarkdown content={row.who} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Subsection({
  title,
  subtitle,
  runMeta,
  rows,
}: {
  title: string;
  subtitle: string;
  runMeta: { id: string; createdAt: Date } | null;
  rows: StrategyRoadmapRow[];
}) {
  if (!runMeta) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Link
          href={`/runs/${runMeta.id}`}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Latest run ·{" "}
          {runMeta.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-4">
          No parsed items yet for this run. Open the run to view the report, or
          re-ingest after updating the roadmap/backlog parsers.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {rows.map((row) => (
            <RoadmapCard key={row.findingId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectStrategyRoadmapSection({ data }: { data: ProjectStrategySnapshot }) {
  const hasAnyRows = data.roadmapRows.length > 0 || data.backlogRows.length > 0;

  return (
    <Card className="mb-10 overflow-hidden border-border/80">
      <CardHeader className="pb-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Roadmap &amp; backlog
        </h2>
        <p className="text-xs text-muted-foreground/80 mt-1 max-w-2xl">
          Latest <strong className="text-foreground/90">feature roadmap</strong>{" "}
          (direction) and <strong className="text-foreground/90">product backlog</strong>{" "}
          (commitments). Each card is <strong className="text-foreground/90">what</strong>{" "}
          we are building, <strong className="text-foreground/90">why</strong> it matters,{" "}
          <strong className="text-foreground/90">who / where</strong> it sits (theme or
          epic), and <strong className="text-foreground/90">priority</strong> by horizon.
        </p>
      </CardHeader>
      <CardContent className="space-y-10 pt-2 pb-6">
        <Subsection
          title="Direction"
          subtitle="Opportunities by horizon from the latest roadmap run."
          runMeta={data.roadmapRun}
          rows={data.roadmapRows}
        />
        <Subsection
          title="Backlog items"
          subtitle="Scored work items from the latest backlog run (BL IDs)."
          runMeta={data.backlogRun}
          rows={data.backlogRows}
        />
        {!hasAnyRows && (data.roadmapRun ?? data.backlogRun) ? (
          <p className="text-xs text-muted-foreground">
            Runs exist but no findings were extracted yet. Push an updated report or check
            ingest parsers for{" "}
            <code className="text-[10px] px-1 bg-muted rounded">feature-roadmap</code> /{" "}
            <code className="text-[10px] px-1 bg-muted rounded">product-backlog</code>.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
