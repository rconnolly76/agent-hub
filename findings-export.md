# Findings export contract (optional, v1.0)

Optional JSON that lists **machine-stable** fields for every finding. Sent as a multipart form **text** field on `POST /api/runs` as `findingsExport` (same pattern as `runDetailContract`).

- **File name in the repo (suite push):** `_findings-export.json` next to the other sidecars. `suite-registry-push.mjs` appends it when present.
- **When to use:** Cross-run project reconciliation, faceting, and `affectedFiles` without relying on markdown parsing. If omitted, ingest only uses report + top-5; Hub still stores per-run `findings` and can reconcile on title when `run_finding_id` is absent (weaker keys).

## Schema (minimum v1.0)

```json
{
  "version": "1.0",
  "findings": [
    {
      "runFindingId": "SEC-003",
      "severity": "warning",
      "title": "Missing CORS preflight for /api/invite",
      "category": "cors",
      "description": "…",
      "facet": "health",
      "affectedFiles": ["app/api/invite/route.ts"]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `version` | string | yes | Must be `"1.0"`. |
| `findings` | array | yes | At least one entry. |
| `findings[].runFindingId` | string | no | Should match the skill’s markdown id (e.g. `CQ-001`) when you have it. |
| `findings[].severity` | string | yes | Same vocabulary as other Hub findings. |
| `findings[].title` | string | yes | |
| `findings[].description` | string | no | |
| `findings[].category` | string | no | |
| `findings[].facet` | `"health"` \| `"strategy"` | no | If omitted, the Hub uses the skill’s default: **strategy** for GTM/roadmap/research skills; **health** for audits and browser reviews. |
| `findings[].affectedFiles` | string[] | no | Stored in `findings.extra`. |

**Merge with markdown:** the export is **index-aligned** with the merged markdown + top-5 list; extra `findings[]` entries beyond the list are appended. If `findings` is the only source, send an empty parsed report and full export, or use export-only rows (see `mergeFindingsWithExport` in the Hub code).
