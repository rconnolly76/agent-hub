# UX Journey Review: Agent Hub (Agentic Suite run)
**Date:** 2026-04-14  
**URL:** http://localhost:3000  
**Viewport:** 1440×900 (browser resized for review)  
**Steps exercised:** P1 primary path + spot-checks aligned with configs  
**Suite context:** `_suite-context.json` from Phase 1 (design audit + journey map) informed Layer B focus areas.

## Executive Summary

The **core drill-down journey** (Projects → Project detail → Run detail) **passes** for a read-only analytics-style product: navigation is predictable, cards communicate status, and the run detail page presents a long-form report with TOC-style controls and a screenshot gallery. Technical severity for this session: **PASS with notes** — console showed only dev warnings (React DevTools, HMR); network requests for navigations returned **200**. Layer B: the experience feels **competent and calm** (dark shell, clear typographic title stack); the deepest insight is that **trust is anchored on the report reader** — if markdown renders well, the product feels valuable.

**Note on ingested reports:** Older runs stored in Blob may describe superseded behavior (e.g. missing `not-found`). This review prioritizes **current source** (`src/app/**`) plus **live browser** evidence from this suite run.

### Top 5 Recommendations

1. **Keep UUID guards consistent** — `projects/[id]` and `runs/[id]` validate UUID shape before querying; ensure any new dynamic routes follow the same pattern. (Small)
2. **Surface blob/report fetch failures explicitly** — when `fetch(reportArtifact.blobUrl)` fails, show an inline warning, not only empty copy. (Medium) — *from Phase 1 cross-skill context*
3. **Extract duplicated formatters** — `formatSkillType` across pages; reduces drift when new `skillType` strings appear. (Small) — *from design audit*
4. **Document POST `/api/projects` threat model** — project creation is unauthenticated by design for CLI onboarding; confirm rate limits / abuse controls for production. (Medium)
5. **Add visual regression for card hover** — hover elevation is a key affordance; protect with a simple Playwright screenshot diff on the home grid. (Small)

## Journey Timeline (P1: Browse to run detail)

| Step | Action | Status | Console | Network | Notes |
|------|--------|--------|---------|---------|-------|
| 1 | Navigate `/` | ✅ | Dev warnings only | 200 | Heading “Projects”, two cards visible |
| 2 | Click first project card | ✅ | HMR noise only | 200 | Land on `/projects/{uuid}` |
| 3 | Click Journey Reviewer run row | ✅ | Fast refresh | 200 | Land on `/runs/{uuid}` |
| 4 | Scroll run detail | ✅ | — | — | Executive summary + markdown body + screenshot thumbs |

## Console Log Analysis

### Errors (0 user-facing)
- None observed during navigation.

### Warnings
- React DevTools prompt, HMR “Fast Refresh” messages — **dev-only**, expected on `next dev`.

## Network Analysis

### Failed Requests
- None during dashboard → project → run navigation.

### Observations
- RSC payloads (`?_rsc=`) return 200; chunk loading 200.

## Accessibility Report (manual / snapshot)

- **Screenshot gallery:** prior code review: dialog uses `role="dialog"`, `aria-modal`, `aria-label`; Escape closes — **good baseline**.
- **Landmarks:** Header + main present; page title updates per route (`generateMetadata`).

## Synthesized Findings (Layer A × Layer B)

### 1. Calm chrome + dense report = trust hinge
- **Layer A:** Run detail loads report markdown and optional images from blob storage; no failed fetch observed in-session.
- **Layer B:** User emotion shifts from **scanning** (cards) to **reading** (report). If fetch silently fails, **confidence collapses** — user blames the product, not the network.
- **User impact:** Silent failure looks like “empty run,” not “network issue.”
- **Recommendation:** Inline error with retry when `!res.ok` (ties to Phase 1 finding).

## Product design — Nielsen heuristics (session-level)

| Heuristic | P1 journey | Evidence |
|-----------|------------|----------|
| H1 Visibility of status | ✅ | Cards show run counts and recency; run shows timestamp |
| H4 Consistency | ✅ | Header + back links repeat pattern |
| H5 Error prevention | — | Read-only UI — not exercised |
| H9 Error recovery | — | No form errors — not exercised |

**Coverage:** Heavily navigational; do not over-claim H5/H9 without error-path journeys.

## Product design — Emotional arc

| Step | User feeling | Confidence | Friction |
|------|--------------|-------------|----------|
| 1 | Oriented | High | Low — clear “Projects” framing |
| 2 | In control | High | Low — breadcrumb + list |
| 3 | Focused / reading | Medium–High | Long report = cognitive load |

## Product design — Screenshot callouts

| Step | Screenshot | Callout |
|------|------------|---------|
| Run detail | `suite-step-run-detail.png` | Executive summary panel establishes tone; serif title + uppercase label creates clear section boundary; scrollbar indicates long content — expected for report viewer. |

## Severity × frequency matrix

| Finding | Severity | Frequency | Quadrant |
|---------|----------|-----------|----------|
| Silent report fetch failure | Medium | Medium when blob misconfigured | Fix soon |
| Duplicated formatters | Low | Every deploy touching skill types | Backlog |

## Screenshots

- `./ux-journey-screenshots/suite-step-run-detail.png` — run detail viewport (this suite run)

## Secondary journeys (S1 / S2)

- **S1 Breadcrumbs:** Code and live UI expose `< All projects` and project name back-link on run detail — **consistent back paths** (not re-walked end-to-end in this run to save time; spot-checked structure in snapshot).
- **S2 Gallery:** Thumbnail buttons present on run with screenshots; lightbox pattern documented in `ScreenshotGallery.tsx` (Escape, backdrop). Full lightbox click not repeated here — **fail forward** per suite rules after primary path completed.
