# Run Detail Contract (v1.0)

This contract allows skills to provide richer right-rail rendering on the Run Detail page, including per-section health.

## File name and placement

- Report-style skills: `_run-detail-contract.json` at the repo root.
- Content-bundle skills: `_run-detail-contract.json` inside the bundle directory (for example `docs/_run-detail-contract.json`).

The push script (`agent-hub-push.mjs`) uploads the contents as the `runDetailContract` multipart field (JSON **text**, not a file blob).

## Schema

```json
{
  "version": "1.0",
  "artifactKind": "report",
  "sections": [
    {
      "id": "executive-summary",
      "title": "Executive Summary",
      "level": "healthy",
      "summary": "No critical or warning indicators",
      "criticalCount": 0,
      "warningCount": 0,
      "findingCount": 2
    }
  ]
}
```

## Rules

- `version` must be `"1.0"`.
- `artifactKind` is `"report"` or `"content-bundle"`.
- `sections` is a non-empty array; each section needs `title` and `level`.

### Section fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | no | Section anchor id for right-rail links. If omitted, the server slugifies `title`. |
| `title` | string | yes | Visible section title. Matches the report's `## H2` heading when possible. |
| `level` | `"healthy" \| "watch" \| "critical" \| "info"` | yes | Drives the health pill color in the right rail. |
| `summary` | string | no | Short one-line health explanation shown under the pill. |
| `criticalCount` | number | no | Count of critical findings in this section. |
| `warningCount` | number | no | Count of warning findings in this section. |
| `findingCount` | number | no | Total findings in this section (all severities). |

## Section ids

Section ids should match the markdown report's `## H2` heading slugs so clicking a right-rail item scrolls the reader to the right place. Skills can either:

- Emit `id` explicitly (recommended when the title isn't unique after slugify).
- Omit `id` and let the server slugify the `title` (the default).

## Level semantics

| Level | When to use |
|---|---|
| `critical` | One or more critical findings in this section. Red pill. |
| `watch` | One or more warning findings, no criticals. Yellow pill. |
| `healthy` | Passing/positive section with no findings to flag. Green pill. |
| `info` | Narrative / framing section with no scored health signal. Gray pill. |

## Fallback behavior

If this file is missing, Agent Hub derives section health from report `## H2` headings and parsed findings via `buildRunDetailContractFromReport`. This contract is optional but recommended — skills that emit it get precise control over section order, levels, and summary text in the UI.
