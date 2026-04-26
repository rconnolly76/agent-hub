#!/usr/bin/env node
/**
 * Agent Hub — suite batch push (registry-driven, product-repo cwd).
 *
 * Live outside the application repo: run from the product workspace (or pass --project-root).
 *
 * Usage (from product repo root):
 *   node ../agent-hub/scripts/suite-registry-push.mjs
 *   node /path/to/suite-registry-push.mjs --project-root /path/to/product-repo
 *
 *   node ... -- --skill code-quality-audit
 *   node ... -- --suite-id <uuid>
 *   AGENT_HUB_SUITE_RUN_ID=<uuid> node ...
 *   node ... -- --dry-run
 *
 * Env:
 *   AGENT_HUB_PROJECT_ROOT  — absolute path to product repo (overrides cwd)
 *
 * Config (read from product repo):
 *   .agent-hub.json           endpoint + apiKey
 *   agent-hub.push.json       optional paths / overrides
 *   _suite-registry.json      which skills to push
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, normalize, resolve } from "node:path";

const args = process.argv.slice(2);

function resolveProjectRoot() {
  const env = process.env.AGENT_HUB_PROJECT_ROOT?.trim();
  if (env) return resolve(env);
  const i = args.indexOf("--project-root");
  if (i !== -1 && args[i + 1]) return resolve(String(args[i + 1]).trim());
  return process.cwd();
}

const root = resolveProjectRoot();
try {
  process.chdir(root);
} catch (e) {
  console.error("suite-registry-push: cannot chdir to project root:", root, e.message);
  process.exit(1);
}

const dryRun = args.includes("--dry-run") || args.includes("-n");
const skillFilter =
  (() => {
    const i = args.indexOf("--skill");
    if (i !== -1 && args[i + 1]) return args[i + 1];
    return null;
  })();

/** Agent Hub requires suiteRunId to be a UUID with version nibble 1–8 (RFC 4122). */
function isValidHubSuiteRunId(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(s).trim(),
  );
}

/** Same ID on every run in this process so Hub can group a full suite push. */
function resolveSuiteRunId() {
  const i = args.indexOf("--suite-id");
  if (i !== -1 && args[i + 1]) {
    const v = String(args[i + 1]).trim();
    if (!isValidHubSuiteRunId(v)) {
      console.error(
        `suite-registry-push: --suite-id must be a UUID (v1–v8). Got: ${JSON.stringify(v)}`,
      );
      process.exit(1);
    }
    return v;
  }
  if (process.env.AGENT_HUB_SUITE_RUN_ID) {
    const v = String(process.env.AGENT_HUB_SUITE_RUN_ID).trim();
    if (isValidHubSuiteRunId(v)) return v;
    console.warn(
      "suite-registry-push: AGENT_HUB_SUITE_RUN_ID is not a valid Hub suite UUID — generating a new one.",
    );
  }
  const scPathNested = join(root, "_suite-out", "_suite-context.json");
  const scPath = existsSync(scPathNested) ? scPathNested : join(root, "_suite-context.json");
  if (existsSync(scPath)) {
    try {
      const sc = JSON.parse(readFileSync(scPath, "utf8"));
      if (sc.suiteRunId) {
        const v = String(sc.suiteRunId).trim();
        if (isValidHubSuiteRunId(v)) return v;
        console.warn(
          "suite-registry-push: _suite-context.json suiteRunId is not a UUID — generating a new one (update the file for stable suite ids).",
        );
      }
    } catch {
      /* ignore */
    }
  }
  return randomUUID();
}

const suiteRunId = resolveSuiteRunId();

function readJson(p) {
  return JSON.parse(readFileSync(join(root, p), "utf8"));
}

let hubPaths = {};
if (existsSync(join(root, "agent-hub.push.json"))) {
  try {
    hubPaths = readJson("agent-hub.push.json");
  } catch (e) {
    console.warn("agent-hub.push.json: invalid JSON, ignoring:", e.message);
  }
}

if (!existsSync(join(root, ".agent-hub.json"))) {
  console.error(
    "suite-registry-push: .agent-hub.json not found in project root:",
    root,
  );
  process.exit(1);
}

const cfg = readJson(".agent-hub.json");
const endpoint = cfg.endpoint.replace(/\/$/, "");
const apiKey = cfg.apiKey;

function loadOptionalJsonText(absPath) {
  try {
    const t = readFileSync(absPath, "utf8");
    JSON.parse(t);
    return t;
  } catch {
    return null;
  }
}

function appendSidecarsFromDir(form, dir) {
  if (!dir || !existsSync(dir)) return;
  const rd = join(dir, "_run-detail-contract.json");
  const tr = join(dir, "_top-5-recommendations.json");
  const fe = join(dir, "_findings-export.json");
  const a = loadOptionalJsonText(rd);
  const b = loadOptionalJsonText(tr);
  const c = loadOptionalJsonText(fe);
  if (a) form.append("runDetailContract", a);
  if (b) form.append("topRecommendations", b);
  if (c) form.append("findingsExport", c);
}

function fileField(absPath, filename) {
  const buf = readFileSync(absPath);
  const name = filename || basename(absPath);
  const mime = name.endsWith(".png")
    ? "image/png"
    : name.endsWith(".json")
      ? "application/json"
      : "text/markdown";
  return new File([buf], name, { type: mime });
}

/** Keep at or above Vercel’s `maxDuration` for /api/runs (see agent-hub) so the client does not abort first. */
const DEFAULT_FETCH_TIMEOUT_MS = 300_000;

function fetchTimeoutMs() {
  const raw = process.env.AGENT_HUB_PUSH_TIMEOUT_MS;
  if (raw == null || raw === "") return DEFAULT_FETCH_TIMEOUT_MS;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FETCH_TIMEOUT_MS;
}

async function postRun(form) {
  const timeout = fetchTimeoutMs();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  const startedAt = Date.now();
  let res;
  try {
    res = await fetch(`${endpoint}/api/runs`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    const elapsedMs = Date.now() - startedAt;
    const err = new Error(
      `fetch failed (elapsed ${elapsedMs}ms, timeout ${timeout}ms, endpoint ${endpoint})`,
    );
    err.cause = e;
    throw err;
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const elapsedMs = Date.now() - startedAt;
    const err = new Error(`HTTP ${res.status} (elapsed ${elapsedMs}ms)`);
    err.body = json;
    throw err;
  }
  return json;
}

function firstExistingReportMd(outputs) {
  for (const o of outputs) {
    if (o.endsWith("/")) continue;
    if (!o.endsWith(".md")) continue;
    const p = join(root, o);
    if (existsSync(p)) return o;
  }
  return null;
}

function firstBundleDir(outputs) {
  for (const o of outputs) {
    if (!o.endsWith("/")) continue;
    const dir = join(root, o);
    const m = join(dir, "_manifest.json");
    if (existsSync(m) && statSync(dir).isDirectory()) return o;
  }
  return null;
}

/**
 * Build ordered push jobs from registry + filesystem.
 * @returns {Array<{ skill: string, kind: 'report'|'bundle', report?: string, bundle?: string, outputs?: string[] }>}
 */
function discoverJobs() {
  if (!existsSync(join(root, "_suite-registry.json"))) {
    throw new Error("_suite-registry.json not found — add it or run from repo root.");
  }
  const reg = readJson("_suite-registry.json");
  const skills = reg.skills || {};
  const entries = Object.entries(skills)
    .filter(([k, v]) => v && v.enabled !== false && k !== "agent-hub-push")
    .sort((a, b) => (a[1].phase || 0) - (b[1].phase || 0));

  const jobs = [];

  for (const [skillKey, meta] of entries) {
    const outs = meta.outputs || [];
    const bundle = firstBundleDir(outs);
    if (bundle) {
      jobs.push({ skill: skillKey, kind: "bundle", bundle: bundle.replace(/\/$/, "") });
      continue;
    }
    const report = firstExistingReportMd(outs);
    if (!report) continue;

    jobs.push({ skill: skillKey, kind: "report", report: report, outputs: outs });
  }

  const hasReviewer = jobs.some((j) => j.skill === "ux-journey-reviewer");
  const jrReport = ["_suite-out/ux-journey-report.md", "ux-journey-report.md"].find(
    (p) => existsSync(join(root, p)),
  );
  const jrMap = ["_suite-out/ux-journeys.md", "ux-journeys.md"].find((p) =>
    existsSync(join(root, p)),
  );
  if (!hasReviewer && jrReport && jrMap) {
    jobs.push({
      skill: "ux-journey-reviewer",
      kind: "report",
      report: jrReport,
      outputs: [],
    });
  }

  return jobs;
}

/** Skip registry paths that are dirs, the report .md, or sidecar-only folders. */
function shouldAttachOutputJson(rel, reportFile) {
  const r = String(rel).trim().replace(/\/$/, "");
  if (!r.endsWith(".json")) return false;
  if (r.endsWith("/")) return false;
  if (r === reportFile) return false;
  if (r.startsWith(".agent-hub-sidecars/")) return false;
  if (r.includes("/.agent-hub-sidecars/")) return false;
  return true;
}

/**
 * Attach `config:<relPath>` for each JSON file listed in this skill’s registry `outputs`.
 */
function appendReportJsonFromRegistryOutputs(form, outputs, reportFile, skillKey) {
  const skipSet = new Set(
    Array.isArray(hubPaths.skipReportConfigJson)
      ? hubPaths.skipReportConfigJson
      : [],
  );
  const extra =
    (hubPaths.reportConfigFiles && hubPaths.reportConfigFiles[skillKey]) || [];
  const list = [...new Set([...(outputs || []), ...extra])];

  const seenKeys = new Set();
  for (const rel of list) {
    if (!shouldAttachOutputJson(rel, reportFile)) continue;
    if (skipSet.has(rel)) continue;
    const safeRel = normalize(rel).replace(/^\.\//, "");
    const abs = join(root, safeRel);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    try {
      JSON.parse(readFileSync(abs, "utf8"));
    } catch {
      console.warn(
        `suite-registry-push: skip invalid JSON, not attaching config: ${safeRel}`,
      );
      continue;
    }
    const key = `config:${safeRel}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    form.append(key, fileField(abs, basename(safeRel)));
  }
}

async function pushReportJob(job) {
  const skillType = job.skill;
  const reportPath = join(root, job.report);
  const form = new FormData();
  form.append("skillType", skillType);
  form.append("suiteRunId", suiteRunId);
  form.append("report", fileField(reportPath));

  const sidecarMap = hubPaths.reportSidecars || {};
  const sideDir = sidecarMap[skillType]
    ? join(root, sidecarMap[skillType])
    : null;

  appendReportJsonFromRegistryOutputs(
    form,
    job.outputs,
    job.report,
    skillType,
  );

  if (skillType === "ux-journey-reviewer") {
    const jr = hubPaths.uxJourneyReviewer || {};
    const mapPath = jr.journeysPath || "ux-journeys.md";
    if (existsSync(join(root, mapPath))) {
      form.append("journeyMap", fileField(join(root, mapPath)));
    }
    const cfgDir = jr.configsDir ? join(root, jr.configsDir) : join(root, "ux-journey-configs");
    if (existsSync(cfgDir)) {
      for (const name of readdirSync(cfgDir).filter((f) => f.endsWith(".json"))) {
        form.append(`config:${name}`, fileField(join(cfgDir, name), name));
      }
    }
    // Opt-in: attach PNGs only when explicitly true. If agent-hub.push.json is missing,
    // defaulting "on" produced multi‑MB requests that stalled the Hub ingest and looked like a hang.
    const includeScreenshots = jr.includeScreenshots === true || jr.uploadScreenshots === true;
    if (includeScreenshots) {
      const shotDir = jr.screenshotsDir
        ? join(root, jr.screenshotsDir)
        : join(root, "ux-journey-screenshots");
      if (existsSync(shotDir)) {
        let n = 0;
        for (const name of readdirSync(shotDir)) {
          if (!name.endsWith(".png")) continue;
          form.append(`screenshot:${name}`, fileField(join(shotDir, name), name));
          n += 1;
        }
        console.warn(
          `suite-registry-push: ux-journey-reviewer attached ${n} screenshot PNG (opt-in)`,
        );
      }
    } else {
      console.warn(
        "suite-registry-push: ux-journey-reviewer skipping screenshot PNGs (set includeScreenshots: true in agent-hub.push.json to send them)",
      );
    }
    const jrSideNested = join(root, "_suite-out", ".agent-hub-sidecars", "ux-journey-reviewer");
    const jrSide =
      existsSync(jrSideNested) && statSync(jrSideNested).isDirectory()
        ? jrSideNested
        : join(root, ".agent-hub-sidecars", "ux-journey-reviewer");
    if (existsSync(jrSide)) appendSidecarsFromDir(form, jrSide);
    return postRun(form);
  }

  if (sidecarMap[skillType]) {
    appendSidecarsFromDir(form, sideDir);
  } else {
    const nested = join(root, "_suite-out", ".agent-hub-sidecars", skillType);
    const opt = existsSync(nested) && statSync(nested).isDirectory()
      ? nested
      : join(root, ".agent-hub-sidecars", skillType);
    if (existsSync(opt)) appendSidecarsFromDir(form, opt);
  }

  return postRun(form);
}

async function pushBundleJob(job) {
  const skillType = job.skill;
  const bundleDir = join(root, job.bundle);
  const manifestPath = join(bundleDir, "_manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const form = new FormData();
  form.append("skillType", skillType);
  form.append("suiteRunId", suiteRunId);
  form.append("artifactType", "content-bundle");
  form.append("manifest", fileField(manifestPath, "_manifest.json"));
  appendSidecarsFromDir(form, bundleDir);
  for (const entry of manifest.files || []) {
    const rel = entry.path;
    const abs = join(bundleDir, rel);
    if (!existsSync(abs)) {
      console.warn(`[${skillType}] skip missing manifest file: ${rel}`);
      continue;
    }
    form.append(`content:${rel}`, fileField(abs, basename(rel)));
  }
  return postRun(form);
}

let jobs;
try {
  jobs = discoverJobs();
} catch (e) {
  console.error(e.message || e);
  process.exitCode = 1;
  process.exit();
}

if (skillFilter) {
  jobs = jobs.filter((j) => j.skill === skillFilter);
}

const excludeRaw = process.env.AGENT_HUB_PUSH_EXCLUDE?.trim();
if (excludeRaw) {
  const ex = new Set(
    excludeRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (ex.size) {
    jobs = jobs.filter((j) => !ex.has(j.skill));
    console.warn(
      "suite-registry-push: excluding skills (AGENT_HUB_PUSH_EXCLUDE):",
      [...ex].join(", "),
    );
  }
}

if (jobs.length === 0) {
  console.log(
    JSON.stringify(
      { projectRoot: root, endpoint, message: "nothing to push (no matching artifacts)", filter: skillFilter },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    {
      projectRoot: root,
      endpoint,
      dryRun,
      suiteRunId,
      apiKeyPrefix: `${String(apiKey).slice(0, 8)}...`,
      jobs: jobs.map((j) => ({ skill: j.skill, kind: j.kind, artifact: j.report || j.bundle })),
    },
    null,
    2,
  ),
);

if (dryRun) process.exit(0);

const PUSH_JOB_RETRIES = (() => {
  const r = process.env.AGENT_HUB_PUSH_RETRIES;
  if (r == null || r === "") return 1;
  const n = parseInt(String(r), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 5);
})();

function isRetriablePushError(message, e) {
  const m = String(message).toLowerCase();
  if (m.includes("aborted") || m.includes("fetch failed")) return true;
  if (m.includes("econnreset") || m.includes("econnrefused") || m.includes("socket")) return true;
  const c = e?.cause;
  if (c instanceof Error) {
    const cm = c.message.toLowerCase();
    if (cm.includes("aborted") || cm.includes("timeout") || cm.includes("reset")) return true;
  }
  return false;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const results = [];
const errors = [];

for (const job of jobs) {
  let data = null;
  let lastErr = null;
  for (let attempt = 0; attempt < PUSH_JOB_RETRIES; attempt++) {
    try {
      data = job.kind === "bundle" ? await pushBundleJob(job) : await pushReportJob(job);
      lastErr = null;
      break;
    } catch (e) {
      const extra =
        e && typeof e === "object" && e.cause != null
          ? `; cause: ${e.cause instanceof Error ? e.cause.message : String(e.cause)}`
          : "";
      const msg = `${e?.message || String(e)}${extra}`;
      lastErr = { e, msg };
      if (attempt < PUSH_JOB_RETRIES - 1 && isRetriablePushError(msg, e)) {
        const w = 3000 * (attempt + 1);
        console.warn(
          `suite-registry-push: ${job.skill} — ${msg.split("\n")[0].slice(0, 200)}; retrying in ${w}ms (attempt ${attempt + 2}/${PUSH_JOB_RETRIES})`,
        );
        await delay(w);
        continue;
      }
      break;
    }
  }
  if (data) {
    results.push({ skill: job.skill, ok: true, data });
    console.log(`ok\t${job.skill}\t${data?.id || data?.runId || ""}`);
  } else if (lastErr) {
    const { e, msg } = lastErr;
    errors.push({ skill: job.skill, message: msg, body: e?.body });
    console.error(`fail\t${job.skill}\t${msg}`);
  }
}

console.log(
  JSON.stringify(
    {
      pushed: results.length,
      failed: errors.length,
      results,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
