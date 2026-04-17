# Agent Hub Ingest Contracts

The complete contract for skills pushing runs to the Hub. This file is the source of truth — the push script, the ingest API, and every skill must agree with what's written here.

If you're authoring or refactoring a skill, read this first. If you're changing the Hub's ingest behavior, update this file in the same change.

## Overview

A skill run produces:

1. A **primary artifact** — either a markdown report, or a directory of content files (content bundle).
2. Two optional **sidecar JSON files** that control how the Hub renders the run:
   - [`_run-detail-contract.json`](run-detail-contract.md) — section health for the right rail.
   - [`_top-5-recommendations.json`](top-recommendations-contract.md) — the top 1–5 prioritized actions.

The push script (`agent-hub-push.mjs`) reads the artifact and the sidecars, then POSTs a multipart request to `/api/runs`.

## Ingest endpoint

```
POST /api/runs
Header: x-api-key: <project api key>
Content-Type: multipart/form-data
```

The request body is a `FormData` object. Field keys are defined below — they fall into two categories:

- **Fixed keys** — exact field names the server reads by name.
- **Prefixed keys** — fields of the form `<prefix>:<name>` where the server enumerates all entries with that prefix.

## Field reference

| Field key | Type | Required | Applies to | Notes |
|---|---|---|---|---|
| `skillType` | string | yes | both | Matches a skill key in `_suite-registry.json`. |
| `artifactType` | string | for bundles | content-bundle | `"content-bundle"` for bundles; omit for reports. |
| `report` | File (markdown) | yes | report | The primary markdown report. |
| `manifest` | File (JSON) | yes | content-bundle | `_manifest.json`. See schema below. |
| `auditReport` | File (markdown) | no | content-bundle | Required only when `manifest.mode === "audit"`. |
| `content:<rel-path>` | File | one+ required | content-bundle | One entry per content file. The key encodes the file's path within the bundle. |
| `screenshot:<name>` | File (image) | no | report | Screenshots attached to the report. |
| `config:<name>` | File (JSON) | no | report | Config files (e.g. journey configs). |
| `journeyMap` | File (markdown) | no | report (reviewer) | Optional ux-journeys.md companion. |
| `runDetailContract` | **JSON string (text)** | no | both | Contents of `_run-detail-contract.json`. See [run-detail-contract.md](run-detail-contract.md). |
| `topRecommendations` | **JSON string (text)** | no | both | Contents of `_top-5-recommendations.json`. See [top-recommendations-contract.md](top-recommendations-contract.md). |
| `skillParserOverride` | JSON string (text) | no | both | `{ parserId, executiveSummaryFallbackMaxChars? }` — force a specific parser for this run. |
| `apiKey` | string | — | both | Header `x-api-key` preferred; the field form is a fallback. |

### Important

- `runDetailContract` and `topRecommendations` are **text fields containing JSON** — not file blobs. The push script reads the sidecar file and appends its text content to the form. The server parses the string with `JSON.parse` before validating.
- `content:<rel-path>` keys preserve nested paths (`features/dark-mode.md`). The server reconstructs the directory structure from the key.
- Files use `File` (not `Blob`) in Node fetch when content is UTF-8 text — smart quotes, emoji, CJK can otherwise fail multipart serialization.

## Primary artifact: markdown report

Evaluative skills (audits, reviews, discovery) produce a single markdown report. The report is the authoritative, human-readable output — it drives ingest's findings and metrics extraction via `parseReportForIngest`.

Report filenames are skill-specific and detected by the push script:

| Skill | Report filename |
|---|---|
| `ux-journey-discovery` | `ux-journeys.md` |
| `ux-journey-reviewer` | `ux-journey-report.md` |
| `ux-visual-design-review` | `visual-design-review.md` |
| `ux-design-system-audit` | `design-system-audit.md` |
| `code-quality-audit` | `code-quality-audit.md` |
| `web-security-audit` | `web-security-audit.md` |
| `web-performance-audit` | `web-performance-audit.md` |

The server parses `## H2` headings into sections, extracts findings (severity + title + description + category + optional recommendation), and extracts metrics when the parser understands the skill's format.

## Primary artifact: content bundle

Generative skills (`product-marketer`, `product-docs-author`) produce a directory containing a `_manifest.json` plus content files.

### Manifest schema

```json
{
  "schemaVersion": "1.0",
  "skillType": "product-marketer",
  "mode": "generate",
  "generatedAt": "2026-04-16T12:00:00.000Z",
  "summary": "Generated 6 marketing content files for my-project. Mode: generate.",
  "auditReport": "marketing-audit.md",
  "files": [
    {
      "path": "positioning.md",
      "title": "Product Positioning",
      "category": "strategy",
      "description": "Value proposition, target audience, differentiation, elevator pitch.",
      "tags": ["strategy", "positioning"]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | string | no | Forward-compat marker. Server ignores but accepts. Current: `"1.0"`. |
| `skillType` | string | no | If set, overrides the ingest `skillType` for manifest-driven routing. |
| `mode` | string | no | `"generate"` or `"audit"`. Controls whether an audit report is expected. |
| `generatedAt` | string | no | ISO 8601 timestamp. |
| `summary` | string | **yes** | One-sentence summary — drives the synthetic report fallback. |
| `auditReport` | string | when `mode === "audit"` | Relative path within the bundle to the audit markdown. |
| `files` | array | **yes** | One entry per content file. Each needs `path` + `title`; `category`, `description`, `tags` are optional. |

Only `summary` and `files[]` are strictly validated by the server (see `parseContentBundleManifestJson`). Everything else is accepted if present and useful to downstream parsers.

### Bundle directory layout

```
./product-marketing/
├── _manifest.json
├── _run-detail-contract.json       ← sidecar, uploaded as runDetailContract JSON text
├── _top-5-recommendations.json     ← sidecar, uploaded as topRecommendations JSON text
├── marketing-audit.md              ← only when mode: "audit"; uploaded as auditReport
├── positioning.md                  ← uploaded as content:positioning.md
├── landing-page-copy.md            ← uploaded as content:landing-page-copy.md
└── features/
    └── dark-mode.md                ← uploaded as content:features/dark-mode.md
```

The push script enumerates `manifest.files[]` for the upload set — so the manifest is the authoritative file list. Nested paths are preserved via the `content:<rel-path>` key.

## Sidecar: `_run-detail-contract.json`

Section-health data for the right rail. See [run-detail-contract.md](run-detail-contract.md) for the full spec.

TL;DR:
- `version: "1.0"`, `artifactKind: "report" | "content-bundle"`, `sections[]`.
- Each section: `title` + `level` (healthy/watch/critical/info) + optional `id`, `summary`, `criticalCount`, `warningCount`, `findingCount`.
- Optional; if missing the server derives sections from the report's `## H2` headings.

## Sidecar: `_top-5-recommendations.json`

The top 1–5 prioritized actions. See [top-recommendations-contract.md](top-recommendations-contract.md) for the full spec.

TL;DR:
- `version: "1.0"`, optional `skillType` and `generatedAt`, `recommendations[]`.
- Each recommendation: required `priority` (P1–P5) + `title` + `action`.
- Optional: `rationale`, `severity`, `effort`, `impact`, `expectedOutcome`, `successMetric`, `relatedFindings[]`, `affectedFiles[]`.
- Skills that use a richer recommendation model (effort/impact, success metrics) should emit the extended fields; the server stores them and the UI surfaces them over time.

## Where what lives

| File | Required | Enriched by | Parsed by |
|---|---|---|---|
| Markdown report | yes (report skills) | — | `parseReportForIngest` — findings, metrics, executive summary. |
| `_manifest.json` | yes (bundle skills) | — | `parseContentBundleManifestJson` — catalog for uploads + bundle nav. |
| `_run-detail-contract.json` | no | skill author | `parseRunDetailContract` — right-rail health. |
| `_top-5-recommendations.json` | no | skill author | `parseTopRecommendationsPayload` — top actions block. |

The markdown is the source of richness. The sidecars are render-time hints the skill provides when it wants precise control over how the run appears in the Hub.

## Archived contract references

The two contract files are kept as focused docs for skills that only need one:

- [run-detail-contract.md](run-detail-contract.md) — section health schema.
- [top-recommendations-contract.md](top-recommendations-contract.md) — top-5 recommendations schema.

If those disagree with this file, this file wins — update them in the same change.
