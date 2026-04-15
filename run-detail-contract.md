# Run Detail Contract (v1.0)

This contract allows skills to provide richer right-rail rendering on the Run Detail page, including per-section health.

## Where to put it

- Report-style skills: place `_run-detail-contract.json` at repo root.
- Content-bundle skills: place `_run-detail-contract.json` inside the bundle directory (for example `docs/_run-detail-contract.json`).

The push tool (`agent-hub-push.mjs`) automatically includes this file as `runDetailContract` when present.

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

## Fields

- `version`: must be `"1.0"`.
- `artifactKind`: `"report"` or `"content-bundle"`.
- `sections`: array of section health entries:
  - `id`: section anchor id used by right-rail links.
  - `title`: visible section title.
  - `level`: one of `"healthy" | "watch" | "critical" | "info"`.
  - `summary` (optional): short health explanation.
  - `criticalCount` / `warningCount` / `findingCount` (optional numeric details).

## Fallback behavior

If this file is missing, Agent Hub derives section health from report headings and parsed findings. This contract is optional but recommended for best fidelity.
