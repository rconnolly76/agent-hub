# Agent Hub — suite push (registry)

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
