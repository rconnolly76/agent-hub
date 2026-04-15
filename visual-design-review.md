# Visual Design Review: Agent Hub
**Reviewed:** 2026-04-14  
**Pages reviewed:** `/` (Projects), `/projects/[id]`, `/runs/[id]` (spot-check)  
**Viewports:** 1440×900 primary; existing captures include multi-viewport assets in `./visual-review-screenshots/`  
**Cross-skill context:** `_suite-context.json` — token + component findings used to focus Typography, Color, and Component Consistency dimensions.

## Executive Summary

The UI **reads as a single dark-mode system**: Geist typography, restrained neutrals, and card surfaces that share one radius and border language. It feels **professional and utilitarian** — closer to a polished internal admin than a marketing site, which fits the product. The highest-impact visual opportunity is **report reading comfort** on run detail (measure, heading rhythm in markdown) rather than reinventing the dashboard cards.

### Top 5 Recommendations

1. **Tighten long-form markdown measure** — constrain prose width for the report column on very wide screens so line length stays in a comfortable range. (Small)
2. **Unify status chroma** — health badges use red/amber/emerald utilities; ensure hover/focus on cards does not compete with “critical” red chips. (Small)
3. **Sidebar vs content balance on lg breakpoint** — verify metrics sidebar does not dominate on short viewports (content priority). (Medium)
4. **Motion** — header `animate-fade-in` is subtle; consider matching route transitions with a soft fade for main content only. (Medium)
5. **Gallery thumbnails** — `aspect-video` grid is clean; ensure filename strip has enough contrast (white on gradient) at small sizes. (Small)

## Visual Quality Dashboard

| Dimension | Score | Key observation |
|-----------|-------|-----------------|
| 1. Typography | 4/5 | Geist + clear title/body separation; long markdown is the stress case |
| 2. Color | 4/5 | Neutral-first; status color used sparingly on badges |
| 3. Spatial rhythm | 4/5 | `max-w-7xl` + consistent py/px; cards align to grid |
| 4. Visual hierarchy | 4/5 | Page titles win; cards scannable |
| 5. Component consistency | 4/5 | shadcn Card/Badge family reads cohesive |
| 6. Layout composition | 4/5 | Clear header / main; run detail two-column works at desktop |
| 7. Craft / polish | 3/5 | Strong for MVP; focus on markdown + gallery edge cases |
| 8. Brand coherence | 3/5 | “A” mark + wordmark; functional not distinctive |
| 9. Responsive integrity | 3/5 | Validate sidebar ordering on `<lg` (see journey notes) |
| 10. Motion | 3/5 | Light entrance animation; no heavy transitions |

**Overall visual quality:** **Polished** (high 3 / low 4)

## Per-dimension findings (abbreviated)

### 1. Typography — 4/5
- **Reference:** `home-1440.png`, `run-detail-report-1440.png` (existing captures).
- Headings use weight + size for hierarchy; body copy relies on `text-muted-foreground` for secondary lines — **clear tiering**.

### 2. Color — 4/5
- Dark surfaces with subtle borders; **critical** badges draw attention appropriately without flooding the canvas.

### 5. Component consistency — 4/5
- Cards share hover border + shadow pattern; badges use one visual language across dashboard and run list.

## Cross-dimensional findings

- **Dashboard cards + status badges:** Color semantics (red = critical) align with user expectation; **pair with** accurate data — misleading counts would undermine the palette (product issue, not pixel issue).

## The one-page test

**Representative page:** Run detail (`/runs/[id]`) — it embodies the product promise (ingested intelligence).  
**To reach the next level:** (1) Optimal reading measure for markdown, (2) stronger empty/error states for missing report, (3) one refined loading skeleton for first paint.

## Recommendations (5-part summaries)

### Fix soon
**R1. Report column max-width**  
- **What:** Cap prose width inside `MarkdownReport` container for large breakpoints.  
- **Why:** Resolves long-line fatigue on ultrawide monitors.  
- **Owner:** Frontend + design review.  
- **Effort:** Small.  
- **Done-when:** 60–75 character approximate measure on 1440px+ viewports.

## Screenshots

- `./visual-review-screenshots/home-1440.png` — projects grid  
- `./visual-review-screenshots/run-detail-report-1440.png` — report reading surface

## Reference mood board

- **Linear** — information density without clutter (for dashboard list).  
- **Vercel** — dark neutral shells with one accent (for overall tone).
