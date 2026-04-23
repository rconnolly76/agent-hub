import { extractExecutiveSummarySection } from "./executive-summary";
import { buildRunDetailContractFromReport } from "@/lib/run-detail-contract";
import type { ParseResult, ParsedFinding, ParsedMetric } from "./ux-journey-reviewer";

const BL_HEADING =
  /^###\s+(BL-\d+)\s*[—\-–]\s*(.+?)(?:\s+\*\([^)]+\)\*)?\s*$/gm;

/** Lines like: | 1 | BL-014 | Title | now | 210 | */
const BL_TABLE_ROW =
  /^\|\s*[^|]*\|\s*(BL-\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;

function firstParagraph(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const para = t.split(/\n\n+/)[0] ?? t;
  return para.replace(/\n/g, " ").trim().slice(0, 3500);
}

function inferHorizonFromHeadingContext(md: string, blockStart: number): string | undefined {
  const before = md.slice(0, blockStart);
  const sec = before.match(/##\s+(Now|Next|Later|Gated)\b/gi);
  if (!sec || sec.length === 0) return undefined;
  const last = sec[sec.length - 1].replace(/##\s+/i, "").trim().toLowerCase();
  if (last === "gated") return "gated";
  return last;
}

function inferHorizonFromBlock(block: string): string | undefined {
  const m =
    block.match(/\*\*Horizon:?\*\*?\s*:?\s*(now|next|later|gated)/i) ||
    block.match(/\bHorizon\s*:\s*(now|next|later|gated)\b/i);
  return m ? m[1].toLowerCase() : undefined;
}

/** Pulls skill-contract fields from per-item markdown for Hub “who / why” display. */
function extractBacklogSemantics(block: string): {
  userOutcome?: string;
  userStory?: string;
  problem?: string;
  epic?: string;
  theme?: string;
  whatItIs?: string;
  whyItMatters?: string;
  deliveryNote?: string;
} {
  const whatItIs =
    block.match(/-\s*\*\*What it is:?\*\*\s*([^\n]+)/i)?.[1]?.trim() ||
    block.match(/\*\*What it is:?\*\*\s*([^\n]+)/i)?.[1]?.trim();
  const whyItMatters =
    block.match(/-\s*\*\*Why it matters:?\*\*\s*([^\n]+)/i)?.[1]?.trim() ||
    block.match(/\*\*Why it matters:?\*\*\s*([^\n]+)/i)?.[1]?.trim();
  const deliveryNote =
    block.match(/-\s*\*\*Delivery[^:]*:\*\*\s*([^\n]+)/i)?.[1]?.trim() ||
    block.match(/\*\*Delivery[^:]*:\*\*\s*([^\n]+)/i)?.[1]?.trim();

  const userStory =
    block.match(/\*\*User [Ss]tory:?\*\*\s*([^\n]+)/)?.[1]?.trim() ||
    block.match(/^User story:\s*([^\n]+)/im)?.[1]?.trim();
  const problem =
    block.match(/\*\*Problem:?\*\*\s*([^\n]+)/)?.[1]?.trim() ||
    block.match(/^Problem:\s*([^\n]+)/im)?.[1]?.trim();
  const epic = block.match(/\*\*Epic:?\*\*\s*([^\n]+)/)?.[1]?.trim();
  const theme =
    block.match(/\*\*Theme:?\*\*\s*([^\n]+)/)?.[1]?.trim() ||
    block.match(/\*\*Theme\s*\(T\d+\):?\*\*\s*([^\n]+)/)?.[1]?.trim();

  const userOutcome = whatItIs || userStory;

  return {
    userOutcome,
    userStory,
    problem,
    epic,
    theme,
    whatItIs,
    whyItMatters,
    deliveryNote,
  };
}

type BacklogItemJson = {
  id?: string;
  userOutcome?: string;
  title?: string;
  epic?: string;
  themeId?: string;
  horizon?: string;
};

type BacklogJsonFile = {
  items?: BacklogItemJson[];
};

function mergeBacklogJsonFindings(
  base: ParsedFinding[],
  json: BacklogJsonFile | null | undefined
): ParsedFinding[] {
  if (!json?.items?.length) return base;

  const byId = new Map<string, BacklogItemJson>();
  for (const it of json.items) {
    const id = it.id?.toUpperCase();
    if (id) byId.set(id, it);
  }
  if (byId.size === 0) return base;

  return base.map((f) => {
    const idMatch = f.title.match(/^(BL-\d+)/i);
    const id = idMatch?.[1]?.toUpperCase();
    const row = id ? byId.get(id) : undefined;
    if (!row?.userOutcome?.trim()) return f;
    const uo = row.userOutcome.trim();
    const prev = f.recommendation ?? {};
    const epic =
      typeof row.epic === "string" ? row.epic : prev.epic;
    return {
      ...f,
      recommendation: {
        ...prev,
        userOutcome: uo,
        what: prev.what || uo,
        ...(epic !== undefined ? { epic } : {}),
      },
    };
  });
}

/**
 * `## Now` / `## Per-Item Detail` → `### BL-014 — Title` blocks (skill contract).
 */
function extractFromPerItemHeadings(md: string): ParsedFinding[] {
  const section = md.match(
    /##\s+Per-Item Detail\s*\n([\s\S]*?)(?=\n##\s+(?!#)|$)/i
  );
  const searchIn = section ? section[1] : md;
  const findings: ParsedFinding[] = [];

  const matches = [...searchIn.matchAll(BL_HEADING)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const id = m[1];
    const shortTitle = m[2].trim();
    const blockStart = (m.index ?? 0) + m[0].length;
    const next =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? searchIn.length)
        : searchIn.length;
    const block = searchIn.slice(blockStart, next);
    const horizon =
      inferHorizonFromBlock(block) ||
      inferHorizonFromHeadingContext(searchIn, m.index ?? 0);
    const sem = extractBacklogSemantics(block);
    const description = firstParagraph(block);

    const userOutcome = sem.userOutcome?.trim();
    const what = userOutcome || sem.userStory || shortTitle;
    const why =
      sem.whyItMatters?.trim() ||
      sem.problem ||
      (description !== shortTitle ? description : "") ||
      shortTitle;
    const whoLine = sem.epic || sem.theme;

    findings.push({
      severity: "info",
      title: `${id} — ${shortTitle}`,
      description: description || shortTitle,
      category: horizon ? `backlog-${horizon}` : "backlog",
      recommendation: {
        userOutcome: userOutcome || undefined,
        what,
        why: why !== what ? why : description || undefined,
        epic: sem.epic,
        theme: sem.theme,
      },
    });
  }

  return findings;
}

/**
 * Fallback: `### By RICE` / `### By revenue-weighted RICE` tables.
 */
function extractFromPriorityTables(md: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const seen = new Set<string>();

  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 4) continue;
    const blIdx = cells.findIndex((c) => /^BL-\d+$/i.test(c));
    if (blIdx < 0) continue;
    const id = cells[blIdx];
    const title = cells[blIdx + 1] ?? "";
    if (/^Rank$/i.test(id) || /^BL$/i.test(id)) continue;

    const horizon =
      cells
        .slice(blIdx + 2)
        .find((c) => /^(now|next|later|gated)$/i.test(c))?.toLowerCase() ??
      undefined;

    if (seen.has(id)) continue;
    seen.add(id);

    findings.push({
      severity: "info",
      title: `${id} — ${title.trim()}`,
      description: title.trim(),
      category: horizon ? `backlog-${horizon}` : "backlog",
      recommendation: {},
    });
  }

  return findings;
}

/** Loose parse for pipe rows that look like backlog priority rows. */
function extractFromPipeFallback(md: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const seen = new Set<string>();

  for (const line of md.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const m = trimmed.match(BL_TABLE_ROW);
    if (!m) continue;
    const id = m[1];
    const title = m[2].trim();
    if (/^title$/i.test(title)) continue;
    const horizon = m[3]?.toLowerCase();
    const h =
      horizon && /^(now|next|later|gated)$/.test(horizon)
        ? horizon
        : undefined;
    if (seen.has(id)) continue;
    seen.add(id);
    findings.push({
      severity: "info",
      title: `${id} — ${title}`,
      description: title,
      category: h ? `backlog-${h}` : "backlog",
      recommendation: {},
    });
  }

  return findings;
}

function extractBacklogMetrics(findings: ParsedFinding[]): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];
  let now = 0,
    next = 0,
    later = 0,
    gated = 0,
    unspecified = 0;

  for (const f of findings) {
    const c = f.category;
    if (c === "backlog-now") now++;
    else if (c === "backlog-next") next++;
    else if (c === "backlog-later") later++;
    else if (c === "backlog-gated") gated++;
    else unspecified++;
  }

  metrics.push({ key: "backlog_item_count", value: findings.length, unit: "items" });
  if (now) metrics.push({ key: "backlog_now", value: now, unit: "items" });
  if (next) metrics.push({ key: "backlog_next", value: next, unit: "items" });
  if (later) metrics.push({ key: "backlog_later", value: later, unit: "items" });
  if (gated) metrics.push({ key: "backlog_gated", value: gated, unit: "items" });
  if (unspecified && findings.length)
    metrics.push({ key: "backlog_unlabeled", value: unspecified, unit: "items" });

  return metrics;
}

export function parseProductBacklogReport(
  markdown: string,
  backlogJson?: unknown
): ParseResult {
  let findings = extractFromPerItemHeadings(markdown);
  if (findings.length === 0) {
    findings = extractFromPriorityTables(markdown);
  }
  if (findings.length === 0) {
    findings = extractFromPipeFallback(markdown);
  }

  if (backlogJson && typeof backlogJson === "object") {
    findings = mergeBacklogJsonFindings(findings, backlogJson as BacklogJsonFile);
  }

  const metrics = extractBacklogMetrics(findings);

  return {
    executiveSummary: extractExecutiveSummarySection(markdown),
    metrics,
    findings,
    runDetail:
      buildRunDetailContractFromReport({
        markdown,
        artifactKind: "report",
        findings,
      }) ?? undefined,
  };
}
