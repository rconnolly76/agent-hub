#!/usr/bin/env node
/**
 * Mechanical validation for agentic suite outputs described in _suite-registry.json.
 * See ./lib/suite-validate-outputs.mjs for implementation.
 *
 * Usage: node scripts/suite-validate.mjs [--root <dir>] [--registry <path>] [--strict] [--only-phase P]
 *
 * --strict — require every registry output path to exist (use after a suite run).
 * --only-phase P — only validate skills with that phase (1-based); for those skills, missing outputs are errors (like strict for that phase).
 * When --only-phase is set, behavior matches strict for the selected phase's outputs; other phases are skipped.
 */

import path from "node:path";
import { validateRegistryOutputs, readJson, exists } from "./lib/suite-validate-outputs.mjs";

function parseArgs(argv) {
  let root = process.cwd();
  let registryPath = null;
  let strict = false;
  let onlyPhase = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) {
      root = path.resolve(argv[++i]);
    } else if (a === "--registry" && argv[i + 1]) {
      registryPath = path.resolve(argv[++i]);
    } else if (a === "--only-phase" && argv[i + 1]) {
      const n = parseInt(String(argv[++i]), 10);
      if (Number.isNaN(n) || n < 1) {
        console.error("suite-validate: --only-phase requires a positive integer");
        process.exit(1);
      }
      onlyPhase = n;
    } else if (a === "--strict") {
      strict = true;
    }
  }
  if (!registryPath) registryPath = path.join(root, "_suite-registry.json");
  return { root, registryPath, strict, onlyPhase };
}

function main() {
  const { root, registryPath, strict, onlyPhase } = parseArgs(process.argv);
  const effectiveStrict = onlyPhase != null ? true : strict;

  if (!exists(registryPath)) {
    console.error(`suite-validate: registry not found: ${registryPath}`);
    process.exit(1);
  }

  let registry;
  try {
    registry = readJson(registryPath, "registry");
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const { errors, warnings } = validateRegistryOutputs({
    root,
    registry,
    strict: effectiveStrict,
    onlyPhase,
  });

  if (warnings.length && !effectiveStrict) {
    console.warn(
      `suite-validate: ${warnings.length} missing output(s) (ok in lenient mode; use --strict after a suite run):\n` +
        warnings.map((l) => `  - ${l}`).join("\n")
    );
  }

  if (errors.length) {
    console.error("suite-validate failed:\n", errors.map((l) => `  - ${l}`).join("\n"));
    process.exit(1);
  }

  const label =
    onlyPhase != null
      ? `only phase ${onlyPhase}, strict for phase`
      : effectiveStrict
        ? "strict"
        : "lenient";
  console.log(`suite-validate OK (root: ${root}, ${label})`);
}

main();
