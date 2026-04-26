#!/usr/bin/env node
/**
 * Phase state machine for the agentic suite: start / next / assert / complete.
 * Pairs with _suite-registry.json and (optionally) suite-validate per phase.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { validateRegistryOutputs, readJson, exists } from "./lib/suite-validate-outputs.mjs";

const DEFAULT_STATE = "_suite-run-state.json";
const DEFAULT_REGISTRY = "_suite-registry.json";

function parseArgs(argv) {
  let root = process.cwd();
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) {
      root = path.resolve(argv[++i]);
    }
  }
  const rest = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) {
      i++;
      continue;
    }
    rest.push(argv[i]);
  }
  return { root, rest };
}

function getCommand(rest) {
  if (!rest[0] || rest[0].startsWith("-")) return null;
  return rest[0];
}

function getUniquePhases(registry) {
  const s = new Set();
  for (const cfg of Object.values(registry.skills || {})) {
    if (!cfg || cfg.enabled === false) continue;
    const p = Number(cfg.phase);
    if (Number.isFinite(p)) s.add(p);
  }
  return Array.from(s).sort((a, b) => a - b);
}

function skillsInPhase(registry, phase) {
  const m = new Map();
  for (const [key, cfg] of Object.entries(registry.skills || {})) {
    if (!cfg || cfg.enabled === false) continue;
    if (Number(cfg.phase) !== Number(phase)) continue;
    m.set(key, cfg);
  }
  return m;
}

/**
 * Topological order for in-phase skills (dependsOn to same phase only; cross-phase is ordering already).
 */
function topSortInPhase(inPhase) {
  const keys = Array.from(inPhase.keys());
  const inDegree = new Map();
  for (const k of keys) {
    const dep = inPhase.get(k);
    const count = (dep.dependsOn || []).filter((d) => inPhase.has(d)).length;
    inDegree.set(k, count);
  }
  const out = [];
  const queue = keys.filter((k) => inDegree.get(k) === 0);
  queue.sort();
  while (queue.length) {
    const a = queue.shift();
    out.push(a);
    for (const b of keys) {
      if ((inPhase.get(b).dependsOn || []).includes(a)) {
        inDegree.set(b, inDegree.get(b) - 1);
        if (inDegree.get(b) === 0) {
          queue.push(b);
        }
      }
    }
  }
  if (out.length < keys.length) {
    for (const k of keys) {
      if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

function skillListPayload(registry, phase) {
  const m = skillsInPhase(registry, phase);
  const order = topSortInPhase(m);
  return order.map((key) => {
    const c = m.get(key);
    return { key, skill: c.skill, model: c.model ?? null, phase: Number(c.phase) };
  });
}

function readStateFile(root) {
  const p = path.join(root, DEFAULT_STATE);
  if (!exists(p)) return null;
  try {
    return readJson(p, "state");
  } catch {
    return null;
  }
}

function writeStateFile(root, state) {
  fs.writeFileSync(path.join(root, DEFAULT_STATE), JSON.stringify(state, null, 2) + "\n", "utf8");
}

function loadRegistry(root) {
  const p = path.join(root, DEFAULT_REGISTRY);
  if (!exists(p)) {
    throw new Error(`_suite-registry.json not found: ${p}`);
  }
  return readJson(p, "registry");
}

function cmdStart(root, rest) {
  let force = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--force") force = true;
  }
  if (exists(path.join(root, DEFAULT_STATE)) && !force) {
    console.error(
      "suite-dispatch: _suite-run-state.json already exists. Use --force to start a new run, or `next` / `complete` to continue."
    );
    process.exit(1);
  }

  const registry = loadRegistry(root);
  const phases = getUniquePhases(registry);
  if (phases.length === 0) {
    console.error("suite-dispatch: no enabled skills in registry");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const state = {
    version: 1,
    runId: randomUUID(),
    startedAt: now,
    phases: Object.fromEntries(phases.map((p) => [String(p), "pending"])),
  };

  const ctx1 = path.join(root, "_suite-context.json");
  const ctx2 = path.join(root, "_suite-out", "_suite-context.json");
  for (const f of [ctx1, ctx2]) {
    if (exists(f)) {
      try {
        fs.unlinkSync(f);
      } catch (e) {
        console.error(`suite-dispatch: could not remove ${f}: ${e.message}`);
        process.exit(1);
      }
    }
  }

  writeStateFile(root, state);
  console.log(`suite-dispatch: started run ${state.runId}`);
  console.log(`  phases tracked: ${phases.join(", ")} (all pending)`);
  console.log(`  next: run \`node scripts/suite-dispatch.mjs next\` (or npm run suite:next) from this directory`);
}

function getFirstIncompletePhase(state) {
  const ph = state.phases || {};
  const keys = Object.keys(ph)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  for (const k of keys) {
    if (ph[String(k)] !== "complete") return k;
  }
  return null;
}

function allComplete(state) {
  return getFirstIncompletePhase(state) == null;
}

function cmdNext(root) {
  const state = readStateFile(root);
  if (!state || !state.version) {
    console.error("suite-dispatch: no run state. Run `suite start` (or `npm run suite:start`) first.");
    process.exit(1);
  }
  const registry = loadRegistry(root);
  if (allComplete(state)) {
    console.log(JSON.stringify({ done: true, runId: state.runId }, null, 2));
    return;
  }
  const p = getFirstIncompletePhase(state);
  const skills = skillListPayload(registry, p);
  const out = {
    done: false,
    runId: state.runId,
    phase: p,
    skills,
  };
  console.log(JSON.stringify(out, null, 2));
}

function isPhaseComplete(state, phase) {
  return (state.phases && state.phases[String(phase)]) === "complete";
}

function cmdAssert(root, rest) {
  let p = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--phase" && rest[i + 1]) p = parseInt(String(rest[++i]), 10);
  }
  if (p == null || Number.isNaN(p) || p < 1) {
    console.error("usage: suite-dispatch assert --phase <N>");
    process.exit(1);
  }
  const state = readStateFile(root);
  if (!state) {
    console.error("suite-dispatch: no run state. Run `suite start` first.");
    process.exit(1);
  }
  for (let i = 1; i < p; i++) {
    if (!isPhaseComplete(state, i)) {
      console.error(
        `suite-dispatch: assert --phase ${p} failed: complete prior phases first (phase ${i} is not complete).`
      );
      process.exit(1);
    }
  }
  if (isPhaseComplete(state, p)) {
    console.error(`suite-dispatch: assert --phase ${p} failed: phase ${p} is already complete. Run \`next\` for the next work window.`);
    process.exit(1);
  }
  process.exit(0);
}

function phaseHasFileValidation(registry, phase) {
  for (const [key, cfg] of Object.entries(registry.skills || {})) {
    if (!cfg || cfg.enabled === false) continue;
    if (Number(cfg.phase) !== Number(phase)) continue;
    if (Array.isArray(cfg.outputs) && cfg.outputs.length > 0) return true;
  }
  return false;
}

function cmdComplete(root, rest) {
  let p = null;
  let confirm = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--phase" && rest[i + 1]) p = parseInt(String(rest[++i]), 10);
    else if (rest[i] === "--confirm") confirm = true;
  }
  if (p == null || Number.isNaN(p) || p < 1) {
    console.error("usage: suite-dispatch complete --phase <N> [--confirm]");
    process.exit(1);
  }

  const state = readStateFile(root);
  if (!state) {
    console.error("suite-dispatch: no run state. Run `suite start` first.");
    process.exit(1);
  }

  for (let i = 1; i < p; i++) {
    if (!isPhaseComplete(state, i)) {
      console.error(
        `suite-dispatch: complete --phase ${p} failed: phase ${i} is not yet marked complete. Run work + complete for that phase first.`
      );
      process.exit(1);
    }
  }
  if (isPhaseComplete(state, p)) {
    console.error(`suite-dispatch: complete --phase ${p} failed: phase ${p} is already complete.`);
    process.exit(1);
  }

  const registry = loadRegistry(root);
  if (!state.phases || state.phases[String(p)] == null) {
    console.error(`suite-dispatch: run state does not track phase ${p}. Re-run \`suite start --force\`.`);
    process.exit(1);
  }

  if (p === 4) {
    if (!confirm) {
      console.error(
        "suite-dispatch: complete --phase 4 requires --confirm (publish / agent-hub-push; no file outputs in default registry)"
      );
      process.exit(1);
    }
  }
  if (phaseHasFileValidation(registry, p)) {
    const { errors, warnings } = validateRegistryOutputs({
      root,
      registry,
      strict: true,
      onlyPhase: p,
    });
    if (warnings.length) {
      console.warn("suite-dispatch: unexpected warnings in strict per-phase mode:\n", warnings);
    }
    if (errors.length) {
      console.error("suite-dispatch: phase validation failed:\n", errors.map((l) => `  - ${l}`).join("\n"));
      process.exit(1);
    }
  }

  state.phases[String(p)] = "complete";
  if (!state.phasesUpdatedAt) state.phasesUpdatedAt = {};
  state.phasesUpdatedAt[String(p)] = new Date().toISOString();
  writeStateFile(root, state);
  console.log(`suite-dispatch: phase ${p} marked complete for run ${state.runId}.`);
  if (allComplete(state)) {
    console.log("  All suite phases in this run are complete. (Optional: `npm run suite-validate:strict` for full output check.)");
  } else {
    const nextP = getFirstIncompletePhase(state);
    console.log(`  Next: run \`node scripts/suite-dispatch.mjs next\` — phase ${nextP} is pending.`);
  }
}

function cmdStatus(root) {
  const state = readStateFile(root);
  if (!state) {
    console.log("No _suite-run-state.json (no active suite run).");
    return;
  }
  console.log(`Run ID:   ${state.runId}`);
  console.log(`Started:  ${state.startedAt || "?"}`);
  for (const k of Object.keys(state.phases || {}).sort((a, b) => Number(a) - Number(b))) {
    const st = state.phases[k] || "?";
    console.log(`  Phase ${k}: ${st}`);
  }
  if (allComplete(state)) console.log("  Status: all phases complete for this run.");
  else {
    const np = getFirstIncompletePhase(state);
    console.log(`  Status: work allowed on phase ${np} (if prior phases are complete, run \`next\` for skills list).`);
  }
}

function help() {
  console.log(`Usage: node scripts/suite-dispatch.mjs [options] <command>

Commands:
  start [--force]   Initialize _suite-run-state.json and clear _suite-context.json. Fails if state exists unless --force.
  next              Print JSON: next incomplete phase and ordered skills, or { "done": true }.
  assert --phase N  Exit 0 if phases < N are complete and N is not yet complete; else exit 1.
  complete --phase N [--confirm]
                    Mark phase N complete after strict validation of that phase's file outputs, if any.
                    --phase 4 also requires --confirm (publish; often no file outputs in registry).
  status            Print human-readable run state.

Options:
  --root <path>  Workspace root (default: cwd)
`);
}

function main() {
  const { root, rest } = parseArgs(process.argv);
  const sub = getCommand(rest);
  const args = sub ? rest.slice(1) : rest.filter((x) => !x.startsWith("suite-dispatch") && x !== "node");
  if (!sub || sub === "help" || sub === "-h" || sub === "--help") {
    help();
    if (!sub) process.exit(0);
    return;
  }

  try {
    if (sub === "start") cmdStart(root, args);
    else if (sub === "next") cmdNext(root);
    else if (sub === "assert") cmdAssert(root, args);
    else if (sub === "complete") cmdComplete(root, args);
    else if (sub === "status") cmdStatus(root);
    else {
      console.error(`Unknown command: ${sub}\n`);
      help();
      process.exit(1);
    }
  } catch (e) {
    console.error("suite-dispatch:", e.message || e);
    process.exit(1);
  }
}

main();
