<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agentic skill suite (sequencing)

To run the full **agentic suite** in this repository, do **not** ad-hoc multiple phases in parallel. Use the mechanical ordering and exit-code gates: `npm run suite:start` → loop `suite:next` (execute the listed skills only) → `suite:complete` per phase until `next` returns `done`. See [scripts/README.md](scripts/README.md) and `.cursor/rules/agentic-suite-dispatch.mdc`.
