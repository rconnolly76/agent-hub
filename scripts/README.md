# Agent Hub — suite scripts

## Registry batch push (other repos)

`suite-registry-push.mjs` lives **in the Agent Hub repo** so product application repos stay free of ingest glue.

**Run from the product workspace** (where `_suite-registry.json` and `.agent-hub.json` live):

```bash
cd /path/to/your-product
node ../agent-hub/scripts/suite-registry-push.mjs
```

Or set the project root explicitly:

```bash
node /path/to/agent-hub/scripts/suite-registry-push.mjs --project-root /path/to/your-product
# or
AGENT_HUB_PROJECT_ROOT=/path/to/your-product node /path/to/agent-hub/scripts/suite-registry-push.mjs
```

In a typical layout where `agent-hub` and `your-product` are sibling folders under the same parent, `package.json` can use:

`"agent-hub:push": "node ../agent-hub/scripts/suite-registry-push.mjs"`.

The older CLI-style `agent-hub/agent-hub-push.mjs` at the repo root is a different entry point (explicit flags); this script is **suite-registry batch** only.

---

## `suite-validate` — check outputs against `_suite-registry.json`

**Run from this repo root** (where `_suite-registry.json` lives).

```bash
npm run suite-validate
```

- **Lenient (default):** missing paths are warnings; any present sidecars are still JSON/schema-checked.
- **Strict (after a full run):** every listed output must exist:
  `npm run suite-validate:strict`
- **Single phase** (e.g. after `suite:complete` for phase 1):
  `node scripts/suite-validate.mjs --only-phase 1`  
  Treats the selected phase like **strict** for that phase’s file outputs; other phases are skipped.

---

## `suite-dispatch` — enforced phase order

Tracks progress in **gitignored**-root file `_suite-run-state.json` (so merge conflicts do not block runs; start a new run with `suite:start --force` if needed).

| npm script        | What it does |
|-------------------|--------------|
| `npm run suite:start`   | New run: UUID, all phases `pending`, removes stale root / `_suite-out` `_suite-context.json`. Fails if state exists; use `npm run suite:start -- --force` to replace. |
| `npm run suite:next`  | Prints **JSON** on stdout: next incomplete `phase` + `skills` (topologically ordered in-phase), or `{ "done": true, "runId": "..." }`. |
| `npm run suite:assert -- --phase N` | Exits 0 if phases &lt; N are complete in state and N is not yet complete; else exits 1. |
| `npm run suite:complete -- --phase N` | Fails if any prior phase is not `complete` in state (even if files on disk are old). Then runs per-phase `suite-validate` logic (strict) **if** the registry has file outputs in that phase. **Phase 4 (publish / `agent-hub-push`):** must pass `npm run suite:complete -- --phase 4 --confirm` (no file outputs in default registry). |
| `npm run suite:status` | Human-readable state. |

**Typical agent loop (Composer or [Cursor Agent CLI](https://www.cursor.com/docs/cli/overview)):** `suite:start` → `suite:next` → execute only listed `skills` from each skill’s `SKILL.md` → `suite:complete` for that `phase` → `suite:next` again until `done: true`.

### Cursor Agent CLI (optional, same rules)

The Cursor CLI’s `agent` can drive the same loop: run from the repo root so `npm` commands resolve, or pass `--workspace <root>`. Non-interactive example pattern:

```bash
agent -p "From the repo root: run npm run suite:next, read the JSON, execute only the listed skills, then run npm run suite:complete for that phase, stop when next returns done." --print
```

Use a **tighter** prompt in practice (exact skill paths, one phase at a time). The CLI is documented as beta; it respects `.cursor/rules/`.

### `suite-validate` vs `suite:complete`

- `suite-validate` is a **read-only** quality gate on disk.
- `suite:complete` is the only command that flips a phase to **complete** in `_suite-run-state.json` (after prior phases are already complete in state and, when applicable, after strict per-phase file validation).
