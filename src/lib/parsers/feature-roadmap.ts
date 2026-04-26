import { extractExecutiveSummarySection } from "./executive-summary";
import { buildRunDetailContractFromReport } from "@/lib/run-detail-contract";
import type { ParseResult, ParsedFinding, ParsedMetric } from "./ux-journey-reviewer";

type StrategyRec = ParsedFinding["recommendation"] & {
  linked?: string[];
  linkedBacklog?: string[];
};

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

function extractLinkedCodes(block: string, selfCode: string): string[] {
  const hits = [...block.matchAll(/\b(?:OP|BL)-\d+\b/gi)].map((m) =>
    m[0].toUpperCase()
  );
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (h === selfCode) continue;
    if (seen.has(h)) continue;
    seen.add(h);
    uniq.push(h);
  }
  return uniq;
}

function parseTitleParts(title: string): { code: string; headline: string } {
  const m = title.match(/^(OP-\d+)\s*[—\-–]\s*(.+)$/i);
  if (m) return { code: m[1].toUpperCase(), headline: m[2].trim() };
  return { code: "", headline: title.trim() };
}

function buildStrategyNarrative(args: {
  sourceLabel: "Roadmap" | "Backlog";
  itemCode?: string;
  what: string;
  why?: string;
  linked?: string[];
  resolveLinkedLabel?: (code: string) => string | null;
  provenance?: string;
  evidence?: string;
}): string {
  const lines: string[] = [];
  lines.push("### What we’re doing", args.what || "—");

  const why = args.why?.trim();
  if (why) lines.push("", "### Why this matters", why);

  lines.push(
    "",
    "### How we’ll execute",
    `This ${args.sourceLabel.toLowerCase()} item comes from an automated strategy run. We’ll use it to align on the intended outcome, sequence the work into shippable steps, and re-run the suite to confirm the change improves the signals that motivated it.`
  );

  const linked = args.linked ?? [];
  if (linked.length > 0) {
    const resolved = linked
      .map((code) => {
        const label = args.resolveLinkedLabel?.(code);
        return label ? `- ${code}: ${label}` : `- ${code}`;
      })
      .join("\n");
    lines.push(
      "",
      "### Related items (sequence / dependencies)",
      "These are referenced because they should be delivered together, in order, or they materially constrain the approach:",
      resolved
    );
  }

  const provenanceBits = [args.sourceLabel, args.itemCode, args.provenance]
    .filter(Boolean)
    .join(" · ");
  if (provenanceBits) {
    lines.push("", "### Provenance", provenanceBits);
  }

  const evidence = args.evidence?.trim();
  if (evidence) lines.push("", "### Evidence from the run", evidence);

  return lines.join("\n");
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
    const linked = extractLinkedCodes(block, oppId);

    findings.push({
      severity: "info",
      title: `${oppId} — ${shortTitle}`,
      description: [plain, whyText].filter(Boolean).join("\n\n") || shortTitle,
      category: `roadmap-${horizonLabel}`,
      recommendation: {
        userOutcome: userOutcome || undefined,
        what: userOutcome || shortTitle,
        why: whyText || undefined,
        ...(linked.length > 0 ? { linked } : {}),
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

  // Fallback: allow H2 sections with bullet lists, e.g.
  // "## Now (0–6 weeks)" then "- OP-001: thing".
  if (findings.length === 0) {
    const h2 = /^##\s+(Now|Next|Later)\b[^\n]*$/gim;
    const headers = [...hay.matchAll(h2)];

    for (let i = 0; i < headers.length; i++) {
      const m = headers[i];
      const label = m[1].toLowerCase();
      const start = m.index! + m[0].length;
      const end = i + 1 < headers.length ? headers[i + 1].index! : hay.length;
      const body = hay.slice(start, end);

      for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("-")) continue;
        const mm = trimmed.match(/^-+\s*(OP-\d+)\s*:\s*(.+?)\s*$/i);
        if (!mm) continue;
        const oppId = mm[1].toUpperCase();
        const title = mm[2].trim();
        if (!title) continue;
        findings.push({
          severity: "info",
          title: `${oppId} — ${title}`,
          description: title,
          category: `roadmap-${label}`,
          recommendation: { what: title },
        });
      }
    }
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
  const baseFindings = [...byTitle.values()];

  const byCode = new Map<string, string>();
  for (const f of baseFindings) {
    const { code, headline } = parseTitleParts(f.title);
    const rec: StrategyRec = (f.recommendation ?? {}) as StrategyRec;
    const label = (rec.userOutcome || rec.what || headline || f.title).trim();
    if (code) byCode.set(code, label);
  }

  const findings = baseFindings.map((f) => {
    const { code, headline } = parseTitleParts(f.title);
    const rec: StrategyRec = (f.recommendation ?? {}) as StrategyRec;
    const what = (rec.userOutcome || rec.what || headline || f.title).trim();
    const why = typeof rec.why === "string" ? rec.why : undefined;
    const linked: string[] = Array.isArray(rec.linked) ? rec.linked : [];

    return {
      ...f,
      recommendation: {
        ...rec,
        ...(linked.length > 0 ? { linked } : {}),
      },
      description: buildStrategyNarrative({
        sourceLabel: "Roadmap",
        itemCode: code || undefined,
        what,
        why,
        linked,
        resolveLinkedLabel: (c) => byCode.get(c) ?? null,
        provenance: f.category,
        evidence: f.description,
      }),
    };
  });

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
