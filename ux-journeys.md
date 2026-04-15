# UX Journey Map: Agent Hub
**Analyzed:** 2026-04-14  
**Framework:** Next.js 16, App Router, React 19, Tailwind v4 + shadcn  
**Routes discovered:** 3 page routes + API routes + global shells  
**Journeys defined:** 5 (1 primary, 2 secondary, 1 edge, 1 error)

## Project topology

Agent Hub is a **read-heavy dashboard** for browsing projects created via the ingest API, their skill runs, and rendered markdown reports with screenshot galleries. There is no in-app authentication UI: access to `/api/*` is key-based; the web UI is a thin client over Neon + Vercel Blob.

### Route inventory

| Route | Auth | Dynamic | Loading | Error | Empty | Dead-end |
|-------|------|---------|---------|-------|-------|----------|
| `/` | No | — | `loading.tsx` | `error.tsx` | Yes (no projects) | No |
| `/projects/[id]` | No | `id` | `loading.tsx` | `error.tsx` | Yes (no runs) | No |
| `/runs/[id]` | No | `id` | `loading.tsx` | `error.tsx` | Partial (no report blob) | No |
| `/api/projects` | API key N/A | — | — | — | — | — |
| `/api/runs` | API key | — | — | — | — | — |

**Notes:** `projects/[id]` and `runs/[id]` validate UUID shape; invalid IDs → `notFound()`. Run detail fetches report markdown from public blob URLs; failure yields “No report content available” without throwing.

### Navigation graph

```
[/] Projects dashboard
  → [/projects/:id] via project card Link
  → (header) [/] via "Projects" or breadcrumb "All projects"

[/projects/:id] Project detail (run list)
  → [/runs/:id] via run card Link
  → [/] via "All projects" back link

[/runs/:id] Run detail (report + gallery + metrics)
  → [/projects/:id] via breadcrumb (project name)
  → (indirect) [/] via project → All projects
```

**Gates:** None for UI. Empty states explain how to push data via CLI.

---

## Primary journeys

### P1: Browse projects dashboard to run detail
**User goal:** Find a project, open a run, and read the ingested UX report with evidence.  
**Entry:** `http://localhost:3000/`  
**Steps:**
1. Land on Projects — see grid of project cards with health badges and latest skill type.
2. Click a project card — `/projects/[uuid]` shows repo URL, masked API key snippet, chronological runs.
3. Click a run card — `/runs/[uuid]` shows executive summary, markdown report, screenshot gallery, metrics sidebar.
4. Scroll run detail — long-form markdown and optional screenshots.

**Success criteria:** User reaches a run detail page with report content or an explicit empty/fallback state.  
**Failure modes:**
- Step 1: DB unavailable → `error.tsx`.
- Step 2: No projects → empty card with push instructions.
- Step 3: No runs → empty state with API key reminder.
- Step 4: Blob fetch fails → “No report content available” (non-crashing).

**Reviewer config:** `./ux-journey-configs/01-primary-browse-projects-to-run-detail.json`  
**Reviewer notes:** Core value path. Check hierarchy (dashboard → list → reader), card hover affordances, and whether run detail feels like a credible “report viewer” (typography, sidebar, gallery).

---

## Secondary journeys

### S1: Breadcrumb and back navigation
**User goal:** Move deep into the app and return without losing context.  
**Entry:** `/`  
**Steps:** Dashboard → project → run → back to project via breadcrumb → “All projects” to home.

**Success criteria:** Each transition preserves orientation; links match mental model (project name = up one level).  
**Reviewer config:** `./ux-journey-configs/02-secondary-breadcrumb-navigation.json`  
**Reviewer notes:** Emphasize H3 (user control), link discoverability, consistent header.

### S2: Screenshot gallery and lightbox
**User goal:** Inspect full-size screenshots from a run.  
**Entry:** Run detail with `role=screenshot` artifacts.  
**Steps:** Scroll to gallery → click thumbnail → lightbox → dismiss (backdrop/Escape).

**Success criteria:** Lightbox opens, keyboard navigation works, close path is obvious.  
**Failure modes:** No screenshots — gallery section omitted.  
**Reviewer config:** `./ux-journey-configs/03-secondary-screenshot-gallery-interaction.json`  
**Reviewer notes:** Only rich client interaction; microinteractions, focus/ARIA on dialog, motion.

---

## Edge case journeys

### E1: Empty dashboard (zero projects)
**User goal:** Understand what to do next.  
**Entry:** `/` with empty `projects` table.  
**Steps:** Land on dashboard → read empty state → see `agent-hub-push` hint.

**Success criteria:** User is not blocked without explanation; CTA is informational (CLI), not a dead end.  
**Reviewer notes:** Copy clarity and whether empty state matches developer expectations.

---

## Error path journeys

### ERR1: Invalid or unknown dynamic route
**User goal:** Understand that the resource does not exist.  
**Entry:** `/projects/not-a-uuid` or `/projects/00000000-0000-0000-0000-000000000000` (if no row).  
**Steps:** Navigate → `notFound()` UI.

**Success criteria:** 404 is branded and navigable back to `/`.  
**Failure modes:** Invalid UUID uses same not-found as missing row — acceptable but indistinguishable in copy.

---

## Gap analysis

| Gap | Location | Risk | Recommended follow-up |
|-----|----------|------|------------------------|
| No list pagination | `page.tsx` loads all projects | Low until hundreds of projects | Add pagination/virtualization |
| API key partially visible on project page | `projects/[id]/page.tsx` | Medium — educate users it’s sensitive | Copy + optional “reveal” pattern |
| Report fetch failure is silent aside from placeholder | `runs/[id]/page.tsx` | Medium — user may think run is empty | Toast or inline warning when `!res.ok` |
| No client-side route transition loading indicator beyond RSC | App-wide | Low | Consider `loading.tsx` polish |

## Coverage matrix

| Route | Primary | Secondary | Edge | Error |
|-------|---------|-----------|------|-------|
| `/` | P1 | — | E1 | — |
| `/projects/[id]` | P1 | S1 | — | ERR1 |
| `/runs/[id]` | P1 | S1, S2 | — | ERR1 |
