#!/usr/bin/env node
/**
 * Mechanical validation for agentic suite outputs described in _suite-registry.json.
 * - Resolves each listed output path relative to the workspace root
 * - For `.agent-hub-sidecars/{skill-key}/`, validates both JSON sidecars parse and meet Hub minimum schema
 * - For generative bundle dirs (`product-marketing/`, `docs/`), optionally validates manifest + bundle sidecars when present
 *
 * Usage: node scripts/suite-validate.mjs [--root <dir>] [--registry <path>] [--strict]
 *
 * Defaults: root = cwd, registry = <root>/_suite-registry.json
 *
 * --strict — require every registry output path to exist (use after a suite run).
 * Without --strict — missing outputs are warnings only; any present sidecars are still validated.
 */

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  let root = process.cwd();
  let registryPath = null;
  let strict = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) {
      root = path.resolve(argv[++i]);
    } else if (a === "--registry" && argv[i + 1]) {
      registryPath = path.resolve(argv[++i]);
    } else if (a === "--strict") {
      strict = true;
    }
  }
  if (!registryPath) registryPath = path.join(root, "_suite-registry.json");
  return { root, registryPath, strict };
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJson(p, label) {
  let raw;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch (e) {
    throw new Error(`${label}: cannot read ${p}: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${label}: malformed JSON in ${p}: ${e.message}`);
  }
}

function validateRunDetailContract(obj, filePath) {
  if (!obj || typeof obj !== "object") throw new Error(`run-detail: not an object (${filePath})`);
  if (obj.version !== "1.0") throw new Error(`run-detail: version must be "1.0" (${filePath})`);
  if (obj.artifactKind !== "report" && obj.artifactKind !== "content-bundle") {
    throw new Error(`run-detail: artifactKind must be "report" or "content-bundle" (${filePath})`);
  }
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) {
    throw new Error(`run-detail: sections must be a non-empty array (${filePath})`);
  }
  for (const s of obj.sections) {
    if (!s || typeof s.title !== "string" || s.title.length === 0) {
      throw new Error(`run-detail: each section needs a non-empty title (${filePath})`);
    }
  }
}

function validateTopRecommendations(obj, filePath) {
  if (!obj || typeof obj !== "object") throw new Error(`top-5: not an object (${filePath})`);
  if (obj.version !== "1.0") throw new Error(`top-5: version must be "1.0" (${filePath})`);
  if (!Array.isArray(obj.recommendations) || obj.recommendations.length === 0) {
    throw new Error(`top-5: recommendations must be a non-empty array (${filePath})`);
  }
  for (const r of obj.recommendations) {
    const ok =
      r &&
      typeof r.priority === "string" &&
      typeof r.title === "string" &&
      r.title.length > 0 &&
      typeof r.action === "string" &&
      r.action.length > 0;
    if (!ok) {
      throw new Error(
        `top-5: each recommendation needs priority, title, and action (${filePath})`
      );
    }
  }
}

function validateGenerativeBundle(dir, skillKey) {
  const manifestPath = path.join(dir, "_manifest.json");
  const rd = path.join(dir, "_run-detail-contract.json");
  const tr = path.join(dir, "_top-5-recommendations.json");
  if (!exists(manifestPath)) return;
  const present = [manifestPath, rd, tr].filter(exists);
  if (present.length < 3) {
    throw new Error(
      `generative bundle incomplete for ${skillKey}: expected _manifest.json + both sidecars under ${dir}`
    );
  }
  const manifest = readJson(manifestPath, "manifest");
  if (typeof manifest.summary !== "string" || manifest.summary.length === 0) {
    throw new Error(`manifest.summary required (${manifestPath})`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`manifest.files must be non-empty (${manifestPath})`);
  }
  for (const f of manifest.files) {
    if (!f || typeof f.path !== "string" || typeof f.title !== "string") {
      throw new Error(`manifest.files entries need path + title (${manifestPath})`);
    }
  }
  validateRunDetailContract(readJson(rd, "run-detail"), rd);
  validateTopRecommendations(readJson(tr, "top-5"), tr);
}

function main() {
  const { root, registryPath, strict } = parseArgs(process.argv);
  const errors = [];
  const warnings = [];

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

  const skills = registry.skills;
  if (!skills || typeof skills !== "object") {
    console.error("suite-validate: registry.skills missing or invalid");
    process.exit(1);
  }

  for (const [skillKey, cfg] of Object.entries(skills)) {
    if (!cfg || cfg.enabled === false) continue;
    const outputs = cfg.outputs;
    if (!Array.isArray(outputs) || outputs.length === 0) continue;

    for (const rel of outputs) {
      const abs = path.join(root, rel);
      const sidecarMatch = rel.match(/^\.agent-hub-sidecars\/([^/]+)\/?$/);
      if (sidecarMatch) {
        const key = sidecarMatch[1];
        if (key !== skillKey) {
          errors.push(
            `Skill "${skillKey}": sidecar directory key ".agent-hub-sidecars/${key}/" must match registry key`
          );
        }
        if (!exists(abs) || !fs.statSync(abs).isDirectory()) {
          const msg = `Skill "${skillKey}": missing directory ${rel}`;
          if (strict) errors.push(msg);
          else warnings.push(msg);
          continue;
        }
        const rdPath = path.join(abs, "_run-detail-contract.json");
        const trPath = path.join(abs, "_top-5-recommendations.json");
        if (!exists(rdPath)) {
          const msg = `Skill "${skillKey}": missing ${path.posix.join(rel, "_run-detail-contract.json")}`;
          if (strict) errors.push(msg);
          else warnings.push(msg);
        }
        if (!exists(trPath)) {
          const msg = `Skill "${skillKey}": missing ${path.posix.join(rel, "_top-5-recommendations.json")}`;
          if (strict) errors.push(msg);
          else warnings.push(msg);
        }
        if (exists(rdPath) && exists(trPath)) {
          try {
            validateRunDetailContract(readJson(rdPath, "run-detail"), rdPath);
            validateTopRecommendations(readJson(trPath, "top-5"), trPath);
          } catch (e) {
            errors.push(`Skill "${skillKey}": ${e.message}`);
          }
        }
        continue;
      }

      if (rel.endsWith("/")) {
        if (!exists(abs) || !fs.statSync(abs).isDirectory()) {
          const msg = `Skill "${skillKey}": missing directory ${rel}`;
          if (strict) errors.push(msg);
          else warnings.push(msg);
          continue;
        }
        if (
          rel === "product-marketing/" ||
          rel === "docs/" ||
          rel.endsWith("product-marketing/") ||
          rel.endsWith("docs/")
        ) {
          try {
            validateGenerativeBundle(abs, skillKey);
          } catch (e) {
            errors.push(`Skill "${skillKey}": ${e.message}`);
          }
        }
        continue;
      }

      if (!exists(abs) || fs.statSync(abs).isDirectory()) {
        const msg = `Skill "${skillKey}": missing file ${rel}`;
        if (strict) errors.push(msg);
        else warnings.push(msg);
      }
    }
  }

  if (warnings.length && !strict) {
    console.warn(
      `suite-validate: ${warnings.length} missing output(s) (ok in lenient mode; use --strict after a suite run):\n` +
        warnings.map((l) => `  - ${l}`).join("\n")
    );
  }

  if (errors.length) {
    console.error("suite-validate failed:\n", errors.map((l) => `  - ${l}`).join("\n"));
    process.exit(1);
  }

  console.log(`suite-validate OK (root: ${root}${strict ? ", strict" : ", lenient"})`);
}

main();
