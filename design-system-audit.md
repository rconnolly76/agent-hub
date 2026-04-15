# Design System Audit: Agent Hub
**Analyzed:** 2026-04-14  
**Framework:** Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui (Base UI) + Geist fonts  
**Components:** ~11 under `src/components` (6 UI primitives + 5 feature)  
**Tokens:** Semantic palette via `@theme inline` + `:root` / `.dark` OKLCH variables (shadcn pattern)  
**Hardcoded values:** Low in pages — most surfaces use `bg-card`, `text-muted-foreground`, `border-border`, etc.

## Executive Summary

The UI is a **coherent dark-mode dashboard** built on shadcn-style tokens and a small set of primitives (Card, Badge, Button, Separator, Tabs, Table). Token architecture is **strong for a greenfield app**: OKLCH semantic colors, consistent radius scale, and Tailwind v4 `@theme` mapping. Atomic structure is **mostly sound** — pages compose Cards and Badges rather than inventing one-off layouts. The main gaps are **product-level**: partial API key exposure on project detail (not a token issue but a system-trust issue), **inconsistent empty-state depth** (home vs project), and **accessibility at Level 2 (reactive)** — good semantic HTML in places (e.g. screenshot dialog), but no project-wide focus/keyboard spec for cards-as-links. Trajectory is **stable to positive** if the team resists ad-hoc utility strings in new pages.

## System Health Dashboard

| Dimension | Score | Key finding |
|-----------|-------|-------------|
| 1. Token architecture | 4/5 | OKLCH + semantic map; root always `dark` on `<html>` — light tokens exist but unused |
| 2. Atomic classification | 4/5 | Clear atoms; feature components are thin |
| 3. Composition quality | 3/5 | Card + Link wrapping repeats; acceptable for scale |
| 4. State pattern consistency | 3/5 | Loading via `loading.tsx`; interactive states strong on `Button`, cards rely on hover utility |
| 5. Accessibility infrastructure | Level 2 | Dialog uses `role="dialog"` + `aria-modal`; link-cards need explicit guidance |
| 6. Reuse and duplication | 4/5 | `formatSkillType` duplicated across pages — extract util |
| 7. Design API quality | 4/5 | shadcn props consistent; feature components small |
| 8. System trajectory | Stable | Few `TODO` markers; risk is copy-paste metric rows across pages |

**Overall maturity:** Adolescent → approaching **Mature** for a single-product internal dashboard.

## Dimension 1 — Token architecture

### Token inventory (summary)

| Category | Defined | Notes |
|----------|---------|--------|
| Color | Yes | `--background`, `--foreground`, `--card`, `--muted-foreground`, status via Badge utilities |
| Spacing | Tailwind scale | `py-10`, `gap-4`, `max-w-7xl` — consistent layout grid |
| Typography | Geist + variables | `--font-sans`, `--font-geist-mono` |
| Radius | Yes | `--radius` + derived `radius-sm`…`radius-4xl` |
| Shadow | Minimal | `hover:shadow-lg` on cards — not tokenized as named shadow scale |

### Hardcoded values (sample)

| File | Observation |
|------|-------------|
| `layout.tsx` | Inline SVG favicon data URI — acceptable |
| Various | `text-red-400`, `text-amber-400`, `text-emerald-400` on badges — semantic status, could map to `--status-*` later |

### Score: 4/5

## Dimension 2 — Atomic classification

| Component | Level | Notes |
|-----------|-------|-------|
| `Button`, `Badge`, `Card` | Atom / molecule | shadcn defaults |
| `MarkdownReport`, `MetricsSidebar` | Organism | Compose smaller pieces |
| Pages | Page | Data fetch + composition |

**Issue:** `formatSkillType` duplicated — **phantom util** not extracted.

### Score: 4/5

## Dimension 3 — Composition quality

- **Card + Link:** Whole card clickable — good affordance; ensure one focusable target for keyboard users (currently valid pattern with Link wrapping Card).
- **Provider depth:** Low — no excessive context nesting.

### Score: 3/5

## Dimension 4 — State pattern consistency

| Pattern | Coverage |
|---------|----------|
| Loading | Route-level skeletons |
| Error | `error.tsx` boundary |
| Empty | Custom per page |
| Hover | Cards, nav links |

**Gap:** Disabled state N/A for most; run/report missing state is text-only.

### Score: 3/5

## Dimension 5 — Accessibility infrastructure

- **Baked in:** `ScreenshotGallery` dialog has `aria-modal`, `aria-label`, Escape handling.
- **Reactive:** No eslint-jsx-a11y output in this audit run; card grid relies on browser defaults for `Link`.

### Level: 2 (Reactive)

## Dimension 6 — Reuse and duplication

- **Duplication:** `formatSkillType`, `timeAgo` (home only), UUID regex in two pages — consolidate to `lib/format.ts` and `lib/uuid.ts`.

### Score: 4/5

## Dimension 7 — Design API quality

shadcn `variant` + `size` patterns are consistent. Feature components take typed props (`screenshots`, `metrics`).

### Score: 4/5

## Dimension 8 — System trajectory

| Signal | Assessment |
|--------|--------------|
| Token drift | Low — new UI should use semantic classes |
| Duplicated helpers | Small tech debt |
| Documentation | No Storybook — acceptable for app size |

**Assessment:** Stable

## Synthesized findings

Tokens and components are **aligned**: the product *looks* like one system. The largest UX-system risk is **information disclosure** (API key snippet) mixed with **reader experience** (long markdown) — not token fragmentation.

## Recommendations

### Fix soon
**R1. Extract shared formatters** — Deduplicate `formatSkillType` and UUID validation.  
- **Why:** Reduces drift when skill types are added.  
- **Owner:** Frontend  
- **Effort:** Small  
- **Done-when:** Single import used in `page.tsx` files.

### Next sprint
**R2. Status color tokens** — Map badge health colors to semantic CSS variables for theming and contrast testing.  
- **Effort:** Small–Medium  

### Backlog
**R3. Light mode** — `:root` light tokens exist but `className="dark"` is fixed on `<html>`. Either remove dead tokens or support toggle.  
- **Effort:** Medium  

## Maturity roadmap

| Dimension | Current | Next milestone |
|-----------|---------|------------------|
| Tokens | Strong | Named shadow / status tokens |
| A11y | Level 2 | Focus-visible audit on interactive cards |
| Docs | None | Optional Storybook for `MarkdownReport` + gallery |
