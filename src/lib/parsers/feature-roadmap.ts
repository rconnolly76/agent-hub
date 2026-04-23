import { extractExecutiveSummarySection } from "./executive-summary";
import { buildRunDetailContractFromReport } from "@/lib/run-detail-contract";
import type { ParseResult, ParsedFinding, ParsedMetric } from "./ux-journey-reviewer";

/** Data row: | 1 | OP-007 | Title | ... | */
function parseHorizonTableRows(
  body: string,
  horizonKey: string
): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  let inTable = false;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    if (/Opp\s*ID|#\s*\|\s*Opp/i.test(trimmed)) {
      inTable = true;
      continue;
    }
    if (/^[\s|:\-–—.]+$/.test(trimmed.replace(/\|/g, ""))) {
      continue;
    }

    if (!inTable) continue;

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;

    const oppIdx = cells.findIndex((c) => /^OP-\d+$/i.test(c));
    if (oppIdx < 0) continue;

    const oppId = cells[oppIdx];
    const title = (cells[oppIdx + 1] ?? "").trim();
    if (/^Title$/i.test(title)) continue;

    const theme = (cells[oppIdx + 2] ?? "").trim();
    const notes =
      cells.length > oppIdx + 4
        ? cells.slice(oppIdx + 4).join(" · ").trim()
        : (cells[oppIdx + 3] ?? "").trim();

    const description = [theme && `Theme: ${theme}`, notes && `Notes: ${notes}`]
      .filter(Boolean)
      .join("\n");

    findings.push({
      severity: "info",
      title: `${oppId.toUpperCase()} — ${title}`,
      description: description || title,
      category: `roadmap-${horizonKey}`,
      recommendation: {
        what: title,
        why: notes || undefined,
        theme: theme || undefined,
      },
    });
  }

  return findings;
}

/** `#### OP-007 — Title` narrative blocks under ### Now / Next / Later */
function extractOpportunityNarrativeBlocks(md: string): ParsedFinding[] {
  const findings: ParsedFinding[] = [];
  const hay = md.includes("## Horizons")
    ? (md.match(/##\s+Horizons\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? md)
    : md;

  const horizonRe = /^###\s+(Now|Next|Later)\b[^\n]*$/gim;
  const headers: { label: string; index: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = horizonRe.exec(hay)) !== null) {
    headers.push({ label: hm[1].toLowerCase(), index: hm.index! });
  }

  const oppHeading = /^####\s+(OP-\d+)\s*[—\-–]\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = oppHeading.exec(hay)) !== null) {
    const oppId = m[1].toUpperCase();
    const shortTitle = m[2].trim();
    const start = m.index! + m[0].length;
    const rest = hay.slice(start);
    const nextIdx = rest.search(/^####\s+OP-\d+/m);
    const block = nextIdx >= 0 ? rest.slice(0, nextIdx) : rest;

    let horizonLabel = "now";
    const pos = m.index!;
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].index < pos) {
        horizonLabel = headers[i].label;
        break;
      }
    }

    const plain =
      block.match(
        /\*\*What we(?:'|'|')?re delivering[^:]*:\*\*\s*([^\n]+)/i
      )?.[1]?.trim() ||
      block.match(
        /-\s*\*\*What we(?:'|'|')?re delivering[^:]*:\*\*\s*([^\n]+)/i
      )?.[1]?.trim();

    const whyNow =
      block.match(/\*\*Why it(?:'|'|')?s in (?:Now|Next|Later)[^:]*:\*\*\s*([^\n]+)/i)?.[1]?.trim() ||
      block.match(
        /-\s*\*\*Why it(?:'|'|')?s in (?:Now|Next|Later)[^:]*:\*\*\s*([^\n]+)/i
      )?.[1]?.trim();

    const gate =
      block.match(/\*\*Validation gate:\*\*\s*([^\n]+)/i)?.[1]?.trim();

    const evidence =
      block.match(/\*\*Evidence[^:]*\/[^:]*delivery notes:\*\*\s*([\s\S]*?)(?=\n(?:#|\*\*)|$)/i)?.[1]?.trim() ||
      block.match(/-\s*\*\*Evidence[^:]*:\*\*\s*([^\n]+)/i)?.[1]?.trim();

    const userOutcome = plain || shortTitle;
    const whyText = whyNow || gate || evidence || "";

    findings.push({
      severity: "info",
      title: `${oppId} — ${shortTitle}`,
      description: [plain, whyText].filter(Boolean).join("\n\n") || shortTitle,
      category: `roadmap-${horizonLabel}`,
      recommendation: {
        userOutcome: userOutcome || undefined,
        what: userOutcome || shortTitle,
        why: whyText || undefined,
      },
    });
  }

  return findings;
}

function extractHorizonFindings(md: string): ParsedFinding[] {
  const narrative = extractOpportunityNarrativeBlocks(md);
  if (narrative.length > 0) return narrative;

  const findings: ParsedFinding[] = [];
  const hay = md.includes("## Horizons")
    ? (md.match(/##\s+Horizons\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? md)
    : md;

  const re = /^###\s+(Now|Next|Later)\b[^\n]*$/gim;
  const horizonHeaders = [...hay.matchAll(re)];

  for (let i = 0; i < horizonHeaders.length; i++) {
    const m = horizonHeaders[i];
    const label = m[1].toLowerCase();
    const start = m.index! + m[0].length;
    const end =
      i + 1 < horizonHeaders.length
        ? horizonHeaders[i + 1].index!
        : hay.length;
    const body = hay.slice(start, end);
    findings.push(...parseHorizonTableRows(body, label));
  }

  return findings;
}

/** `## Gated Items` — `| Opp ID | Title | Gate | ...` */
function extractGatedFindings(md: string): ParsedFinding[] {
  const gatedSection = md.match(
    /##\s+Gated Items[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i
  );
  if (!gatedSection) return [];

  const body = gatedSection[1];
  const findings: ParsedFinding[] = [];
  let inTable = false;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/Opp\s*ID/i.test(trimmed)) {
      inTable = true;
      continue;
    }
    if (/^[\s|:\-–—.]+$/.test(trimmed.replace(/\|/g, ""))) continue;
    if (!inTable) continue;

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;

    const oppId = cells[0];
    if (!/^OP-\d+$/i.test(oppId)) continue;
    const title = cells[1]?.trim() ?? "";
    const gate = cells[2]?.trim() ?? "";

    findings.push({
      severity: "warning",
      title: `${oppId.toUpperCase()} — ${title}`,
      description: gate ? `Gate: ${gate}` : title,
      category: "roadmap-gated",
      recommendation: {
        what: title,
        why: gate ? `Blocked by: ${gate}` : undefined,
      },
    });
  }

  return findings;
}

type RoadmapJson = {
  horizons?: {
    now?: Array<{ opportunityId?: string; userOutcome?: string; themeId?: string }>;
    next?: Array<{ opportunityId?: string; userOutcome?: string; themeId?: string }>;
    later?: Array<{ opportunityId?: string; userOutcome?: string; themeId?: string }>;
  };
  themes?: Array<{ id?: string; userOutcome?: string; name?: string }>;
};

function mergeRoadmapJsonFindings(
  base: ParsedFinding[],
  json: RoadmapJson | null | undefined
): ParsedFinding[] {
  if (!json?.horizons) return base;

  const byOpp = new Map<string, string>();
  for (const h of ["now", "next", "later"] as const) {
    const rows = json.horizons[h];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const id = row.opportunityId?.toUpperCase();
      const uo = row.userOutcome?.trim();
      if (id && uo) byOpp.set(id, uo);
    }
  }

  if (byOpp.size === 0) return base;

  return base.map((f) => {
    const idMatch = f.title.match(/^(OP-\d+)/i);
    const id = idMatch?.[1]?.toUpperCase();
    const uo = id ? byOpp.get(id) : undefined;
    if (!uo) return f;
    const prev = f.recommendation ?? {};
    return {
      ...f,
      recommendation: {
        ...prev,
        userOutcome: uo,
        what: prev.what || uo,
      },
    };
  });
}

function extractRoadmapMetrics(findings: ParsedFinding[]): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];
  let now = 0,
    next = 0,
    later = 0,
    gated = 0;

  for (const f of findings) {
    if (f.category === "roadmap-now") now++;
    else if (f.category === "roadmap-next") next++;
    else if (f.category === "roadmap-later") later++;
    else if (f.category === "roadmap-gated") gated++;
  }

  metrics.push({
    key: "roadmap_item_count",
    value: findings.length,
    unit: "items",
  });
  if (now) metrics.push({ key: "roadmap_now", value: now, unit: "opportunities" });
  if (next) metrics.push({ key: "roadmap_next", value: next, unit: "opportunities" });
  if (later) metrics.push({ key: "roadmap_later", value: later, unit: "opportunities" });
  if (gated) metrics.push({ key: "roadmap_gated", value: gated, unit: "opportunities" });

  return metrics;
}

export function parseFeatureRoadmapReport(
  markdown: string,
  roadmapJson?: unknown
): ParseResult {
  const horizonFindings = extractHorizonFindings(markdown);
  const gatedFindings = extractGatedFindings(markdown);

  const mergedJson =
    roadmapJson && typeof roadmapJson === "object"
      ? mergeRoadmapJsonFindings([...horizonFindings], roadmapJson as RoadmapJson)
      : [...horizonFindings];

  const byTitle = new Map<string, ParsedFinding>();
  for (const f of [...mergedJson, ...gatedFindings]) {
    byTitle.set(f.title, f);
  }
  const findings = [...byTitle.values()];

  const metrics = extractRoadmapMetrics(findings);

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
