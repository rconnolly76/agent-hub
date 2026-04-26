#!/usr/bin/env node
/**
 * Regression: roadmap horizons extraction yields roadmap-* findings.
 *
 * Usage:
 *   node scripts/regression-horizons.mjs /abs/path/to/feature-roadmap.md
 */
import fs from "node:fs";
import path from "node:path";

function extractRoadmapFindingCategories(md) {
  // Minimal mirror of Hub parser coverage:
  // - narrative blocks under "#### OP-xxx — Title" within ### Now/Next/Later
  // - bullet list items under "## Now/Next/Later" like "- OP-001: thing"
  const out = [];

  // Prefer the Horizons section if present.
  const horizonsBody =
    md.match(/##\s+Horizons\s*\n([\s\S]*?)(?=\n##\s|$)/i)?.[1] ?? md;

  // Case 1: "### Now" blocks.
  for (const label of ["now", "next", "later"]) {
    const re = new RegExp(`^###\\s+${label}\\b[\\s\\S]*?$`, "gim");
    // We'll just look for any "#### OP-" under this horizon label by slicing ranges.
    const headerRe = /^###\s+(Now|Next|Later)\b[^\n]*$/gim;
    const headers = [...horizonsBody.matchAll(headerRe)].map((m) => ({
      label: m[1].toLowerCase(),
      index: m.index ?? 0,
      len: m[0].length,
    }));
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const start = h.index + h.len;
      const end = i + 1 < headers.length ? headers[i + 1].index : horizonsBody.length;
      const body = horizonsBody.slice(start, end);
      const oppMatches = [...body.matchAll(/^####\s+(OP-\d+)\b/gim)];
      for (const _m of oppMatches) out.push(`roadmap-${h.label}`);
    }
  }

  // Case 2: H2 bullet list style "## Now" + "- OP-001: title"
  if (out.length === 0) {
    const h2 = /^##\s+(Now|Next|Later)\b[^\n]*$/gim;
    const headers = [...horizonsBody.matchAll(h2)].map((m) => ({
      label: m[1].toLowerCase(),
      index: m.index ?? 0,
      len: m[0].length,
    }));
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const start = h.index + h.len;
      const end = i + 1 < headers.length ? headers[i + 1].index : horizonsBody.length;
      const body = horizonsBody.slice(start, end);
      const bullets = [...body.matchAll(/^-+\s*(OP-\d+)\s*:\s*(.+)$/gim)];
      for (const _b of bullets) out.push(`roadmap-${h.label}`);
    }
  }

  return out;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Missing arg: path to feature-roadmap.md");
    process.exit(2);
  }
  const p = path.resolve(arg);
  const md = fs.readFileSync(p, "utf8");
  const catsRaw = extractRoadmapFindingCategories(md);
  const cats = new Map();
  for (const c of catsRaw) cats.set(c, (cats.get(c) || 0) + 1);
  const roadmapCats = [...cats.entries()].filter(([c]) => String(c).startsWith("roadmap-"));
  const ok = roadmapCats.reduce((a, [, n]) => a + n, 0) > 0;
  console.log(
    JSON.stringify(
      {
        ok,
        roadmapCats,
        totalRoadmapFindings: roadmapCats.reduce((a, [, n]) => a + n, 0),
      },
      null,
      2
    )
  );
  process.exit(ok ? 0 : 1);
}

main();

