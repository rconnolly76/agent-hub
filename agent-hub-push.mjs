#!/usr/bin/env node

/**
 * agent-hub-push — Push agentic skill outputs to Agent Hub
 *
 * Usage:
 *   node agent-hub-push.mjs --endpoint https://agent-hub.vercel.app --key sk_xxx
 *   node agent-hub-push.mjs --endpoint http://localhost:3000 --key sk_xxx --project my-app --skill ux-journey-reviewer
 *   node agent-hub-push.mjs ... --content-dir product-marketing --skill product-marketer
 *
 * Optional: include `_run-detail-contract.json` to enrich Run Detail right-rail section health.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const endpoint = getArg("endpoint");
const apiKey = getArg("key");
const explicitSkill = getArg("skill");
const explicitProject = getArg("project");
const parserOverrideRaw = getArg("parser-override");
const contentDirArg = getArg("content-dir");

if (!endpoint || !apiKey) {
  console.error(
    "Usage: agent-hub-push --endpoint <url> --key <api-key> [--project <name>] [--skill <type>] [--parser-override <json>] [--content-dir <dir>]"
  );
  process.exit(1);
}

/** Content-bundle skills: directory contains _manifest.json */
const BUNDLE_DIRS = {
  "product-marketer": "product-marketing",
  "product-docs-author": "docs",
};

function detectSkillType(cwd) {
  if (fs.existsSync(path.join(cwd, "ux-journey-report.md"))) {
    return "ux-journey-reviewer";
  }
  if (
    fs.existsSync(path.join(cwd, "ux-journeys.md")) &&
    fs.existsSync(path.join(cwd, "ux-journey-configs"))
  ) {
    return "ux-journey-discovery";
  }
  if (fs.existsSync(path.join(cwd, "visual-design-review.md"))) {
    return "ux-visual-design-review";
  }
  if (fs.existsSync(path.join(cwd, "design-system-audit.md"))) {
    return "ux-design-system-audit";
  }
  if (fs.existsSync(path.join(cwd, "code-quality-audit.md"))) {
    return "code-quality-audit";
  }
  if (fs.existsSync(path.join(cwd, "web-security-audit.md"))) {
    return "web-security-audit";
  }
  if (fs.existsSync(path.join(cwd, "web-performance-audit.md"))) {
    return "web-performance-audit";
  }
  const pm = path.join(cwd, "product-marketing", "_manifest.json");
  if (fs.existsSync(pm)) {
    return "product-marketer";
  }
  const docsManifest = path.join(cwd, "docs", "_manifest.json");
  if (fs.existsSync(docsManifest)) {
    try {
      const m = JSON.parse(fs.readFileSync(docsManifest, "utf-8"));
      if (m.skillType === "product-docs-author") return "product-docs-author";
    } catch {
      /* fall through */
    }
    return "product-docs-author";
  }
  return null;
}

function detectProjectName(cwd) {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "package.json"), "utf-8")
    );
    return pkg.name || path.basename(cwd);
  } catch {
    return path.basename(cwd);
  }
}

function collectFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return extensions.includes(ext);
  });
}

/**
 * Markdown / JSON must use File (not Blob) so UTF-8 (smart quotes, emoji, CJK)
 * serializes correctly in multipart. Blob + Unicode text can throw ByteString errors in Node fetch.
 */
function textFile(absPath, filename, mime) {
  const buf = fs.readFileSync(absPath);
  return new File([buf], filename, { type: mime });
}

/**
 * Optional sidecar contract for richer Run Detail rendering.
 * If present, it is sent as JSON text field `runDetailContract`.
 */
function appendRunDetailContractIfPresent(formData, absPath) {
  if (!fs.existsSync(absPath)) return false;
  try {
    const text = fs.readFileSync(absPath, "utf-8");
    JSON.parse(text);
    formData.append("runDetailContract", text);
    console.log(`  + runDetailContract: ${path.relative(process.cwd(), absPath)}`);
    return true;
  } catch (e) {
    console.warn(
      `  ! invalid run detail contract JSON at ${path.relative(process.cwd(), absPath)}: ${e.message}`
    );
    return false;
  }
}

/**
 * @param {FormData} formData
 * @param {string} relDir relative to cwd (e.g. product-marketing)
 * @param {string} cwd
 */
function appendContentBundle(formData, relDir, cwd) {
  const abs = path.join(cwd, relDir);
  const manifestPath = path.join(abs, "_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing _manifest.json in ${relDir}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  formData.append("artifactType", "content-bundle");
  formData.append(
    "manifest",
    textFile(manifestPath, "_manifest.json", "application/json")
  );
  console.log("  + manifest: _manifest.json");

  if (manifest.auditReport) {
    const auditPath = path.join(abs, manifest.auditReport);
    if (fs.existsSync(auditPath)) {
      formData.append(
        "auditReport",
        textFile(
          auditPath,
          path.basename(manifest.auditReport),
          "text/markdown"
        )
      );
      console.log(`  + auditReport: ${manifest.auditReport}`);
    }
  }

  appendRunDetailContractIfPresent(
    formData,
    path.join(abs, "_run-detail-contract.json")
  );

  let added = 0;
  for (const f of manifest.files || []) {
    const fp = path.join(abs, f.path);
    if (!fs.existsSync(fp)) {
      console.warn(`  ! manifest file missing on disk: ${f.path}`);
      continue;
    }
    const lower = f.path.toLowerCase();
    const mime = lower.endsWith(".json")
      ? "application/json"
      : "text/markdown";
    formData.append(
      `content:${f.path.replace(/\\/g, "/")}`,
      textFile(fp, path.basename(f.path), mime)
    );
    console.log(`  + content:${f.path}`);
    added++;
  }
  if (added === 0) {
    console.error(
      "No files from manifest were found on disk (check manifest.files paths)."
    );
    process.exit(1);
  }
}

async function push() {
  const cwd = process.cwd();
  const projectName = explicitProject || detectProjectName(cwd);

  const formData = new FormData();

  if (contentDirArg) {
    const skillType =
      explicitSkill ||
      (() => {
        try {
          const m = JSON.parse(
            fs.readFileSync(
              path.join(cwd, contentDirArg, "_manifest.json"),
              "utf-8"
            )
          );
          return m.skillType || "product-marketer";
        } catch {
          return "product-marketer";
        }
      })();
    formData.append("skillType", skillType);
    console.log(`Skill type:  ${skillType}`);
    console.log(`Project:     ${projectName}`);
    console.log(`Endpoint:    ${endpoint}`);
    console.log(`Bundle dir:  ${contentDirArg}`);
    if (parserOverrideRaw) {
      try {
        JSON.parse(parserOverrideRaw);
      } catch {
        console.error(
          '--parser-override must be valid JSON, e.g. {"parserId":"ux-journey-reviewer"}'
        );
        process.exit(1);
      }
      formData.append("skillParserOverride", parserOverrideRaw);
      console.log(`  + skillParserOverride: ${parserOverrideRaw}`);
    }
    appendContentBundle(formData, contentDirArg, cwd);
  } else {
    const skillType = explicitSkill || detectSkillType(cwd);

    if (!skillType) {
      console.error(
        "Could not auto-detect skill type. Use --skill or --content-dir, or add known report/bundle outputs."
      );
      process.exit(1);
    }

    formData.append("skillType", skillType);
    console.log(`Skill type:  ${skillType}`);
    console.log(`Project:     ${projectName}`);
    console.log(`Endpoint:    ${endpoint}`);

    if (parserOverrideRaw) {
      try {
        JSON.parse(parserOverrideRaw);
      } catch {
        console.error(
          '--parser-override must be valid JSON, e.g. {"parserId":"ux-journey-reviewer"}'
        );
        process.exit(1);
      }
      formData.append("skillParserOverride", parserOverrideRaw);
      console.log(`  + skillParserOverride: ${parserOverrideRaw}`);
    }

    appendRunDetailContractIfPresent(
      formData,
      path.join(cwd, "_run-detail-contract.json")
    );

    const bundleDir = BUNDLE_DIRS[skillType];
    if (bundleDir) {
      appendContentBundle(formData, bundleDir, cwd);
    } else if (skillType === "ux-journey-reviewer") {
      const reportPath = path.join(cwd, "ux-journey-report.md");
      if (!fs.existsSync(reportPath)) {
        console.error("ux-journey-report.md not found");
        process.exit(1);
      }

      formData.append(
        "report",
        textFile(reportPath, "ux-journey-report.md", "text/markdown")
      );
      console.log("  + report:  ux-journey-report.md");

      const screenshotsDir = path.join(cwd, "ux-journey-screenshots");
      const screenshots = collectFiles(screenshotsDir, [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
      ]);
      for (const filename of screenshots) {
        const filePath = path.join(screenshotsDir, filename);
        const ext = path.extname(filename).slice(1).toLowerCase();
        const fileBlob = new Blob([fs.readFileSync(filePath)], {
          type: `image/${ext}`,
        });
        formData.append(`screenshot:${filename}`, fileBlob, filename);
        console.log(`  + screenshot: ${filename}`);
      }

      const configsDir = path.join(cwd, "ux-journey-configs");
      const configs = collectFiles(configsDir, [".json"]);
      for (const filename of configs) {
        const filePath = path.join(configsDir, filename);
        formData.append(
          `config:${filename}`,
          textFile(filePath, filename, "application/json")
        );
        console.log(`  + config: ${filename}`);
      }

      const journeyMapPath = path.join(cwd, "ux-journeys.md");
      if (fs.existsSync(journeyMapPath)) {
        formData.append(
          "journeyMap",
          textFile(journeyMapPath, "ux-journeys.md", "text/markdown")
        );
        console.log("  + journey-map: ux-journeys.md");
      }
    } else if (skillType === "ux-journey-discovery") {
      const mapPath = path.join(cwd, "ux-journeys.md");
      if (!fs.existsSync(mapPath)) {
        console.error("ux-journeys.md not found");
        process.exit(1);
      }
      formData.append(
        "report",
        textFile(mapPath, "ux-journeys.md", "text/markdown")
      );
      console.log("  + report: ux-journeys.md");

      const configsDir = path.join(cwd, "ux-journey-configs");
      const configs = collectFiles(configsDir, [".json"]);
      for (const filename of configs) {
        const filePath = path.join(configsDir, filename);
        formData.append(
          `config:${filename}`,
          textFile(filePath, filename, "application/json")
        );
        console.log(`  + config: ${filename}`);
      }
    } else if (skillType === "ux-design-system-audit") {
      const reportPath = path.join(cwd, "design-system-audit.md");
      if (!fs.existsSync(reportPath)) {
        console.error("design-system-audit.md not found");
        process.exit(1);
      }
      formData.append(
        "report",
        textFile(reportPath, "design-system-audit.md", "text/markdown")
      );
      console.log("  + report: design-system-audit.md");
    } else if (skillType === "ux-visual-design-review") {
      const reportPath = path.join(cwd, "visual-design-review.md");
      if (!fs.existsSync(reportPath)) {
        console.error("visual-design-review.md not found");
        process.exit(1);
      }
      formData.append(
        "report",
        textFile(reportPath, "visual-design-review.md", "text/markdown")
      );
      console.log("  + report: visual-design-review.md");

      const screenshotsDir = path.join(cwd, "visual-review-screenshots");
      const screenshots = collectFiles(screenshotsDir, [
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
      ]);
      for (const filename of screenshots) {
        const filePath = path.join(screenshotsDir, filename);
        const ext = path.extname(filename).slice(1).toLowerCase();
        const fileBlob = new Blob([fs.readFileSync(filePath)], {
          type: `image/${ext}`,
        });
        formData.append(`screenshot:${filename}`, fileBlob, filename);
        console.log(`  + screenshot: ${filename}`);
      }
    } else if (
      skillType === "code-quality-audit" ||
      skillType === "web-security-audit" ||
      skillType === "web-performance-audit"
    ) {
      const fileName = `${skillType}.md`;
      const reportPath = path.join(cwd, fileName);
      if (!fs.existsSync(reportPath)) {
        console.error(`${fileName} not found`);
        process.exit(1);
      }
      formData.append(
        "report",
        textFile(reportPath, fileName, "text/markdown")
      );
      console.log(`  + report: ${fileName}`);
    } else {
      console.error(
        `Skill type '${skillType}' is not recognized. Use --skill with a known type or --content-dir for bundles.`
      );
      process.exit(1);
    }
  }

  console.log("\nPushing to Agent Hub...");

  try {
    const res = await fetch(`${endpoint}/api/runs`, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Push failed (${res.status}): ${text}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log("\nPush successful!");
    console.log(`  Run ID:      ${data.id}`);
    if (data.artifactType === "content-bundle") {
      console.log(`  Artifact:    content-bundle`);
      console.log(`  Content:     ${data.contentFiles ?? 0} files`);
    } else {
      console.log(`  Metrics:     ${data.metrics}`);
      console.log(`  Findings:    ${data.findings}`);
      console.log(`  Screenshots: ${data.screenshots}`);
    }
    console.log(`  View at:     ${endpoint}${data.url}`);
  } catch (err) {
    console.error(`Push failed: ${err.message}`);
    process.exit(1);
  }
}

push();
