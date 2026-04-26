/**
 * Shared output validation for agentic suite registry entries.
 * Used by suite-validate.mjs and suite-dispatch.mjs (per-phase complete).
 */
import fs from "node:fs";
import path from "node:path";

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function readJson(p, label) {
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

/**
 * @param {{ root: string, registry: object, strict: boolean, onlyPhase?: number | null }} opts
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateRegistryOutputs({ root, registry, strict, onlyPhase = null }) {
  const errors = [];
  const warnings = [];
  const skills = registry.skills;
  if (!skills || typeof skills !== "object") {
    errors.push("registry.skills missing or invalid");
    return { errors, warnings };
  }

  for (const [skillKey, cfg] of Object.entries(skills)) {
    if (!cfg || cfg.enabled === false) continue;
    if (onlyPhase != null) {
      const p = Number(cfg.phase);
      if (Number(onlyPhase) !== p) continue;
    }
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

  return { errors, warnings };
}
