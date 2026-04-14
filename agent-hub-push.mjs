#!/usr/bin/env node

/**
 * agent-hub-push — Push agentic skill outputs to Agent Hub
 *
 * Usage:
 *   node agent-hub-push.mjs --endpoint https://agent-hub.vercel.app --key sk_xxx
 *   node agent-hub-push.mjs --endpoint http://localhost:3000 --key sk_xxx --project my-app --skill ux-journey-reviewer
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

if (!endpoint || !apiKey) {
  console.error(
    "Usage: agent-hub-push --endpoint <url> --key <api-key> [--project <name>] [--skill <type>]"
  );
  process.exit(1);
}

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
  if (fs.existsSync(path.join(cwd, "visual-review-screenshots"))) {
    return "ux-visual-design-review";
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

async function push() {
  const cwd = process.cwd();
  const skillType = explicitSkill || detectSkillType(cwd);

  if (!skillType) {
    console.error(
      "Could not auto-detect skill type. Use --skill to specify explicitly."
    );
    console.error("Looked for: ux-journey-report.md, ux-journeys.md, visual-review-screenshots/");
    process.exit(1);
  }

  const projectName = explicitProject || detectProjectName(cwd);

  console.log(`Skill type:  ${skillType}`);
  console.log(`Project:     ${projectName}`);
  console.log(`Endpoint:    ${endpoint}`);

  const formData = new FormData();
  formData.append("skillType", skillType);

  if (skillType === "ux-journey-reviewer") {
    const reportPath = path.join(cwd, "ux-journey-report.md");
    if (!fs.existsSync(reportPath)) {
      console.error("ux-journey-report.md not found");
      process.exit(1);
    }

    const reportBlob = new Blob([fs.readFileSync(reportPath)], {
      type: "text/markdown",
    });
    formData.append("report", reportBlob, "ux-journey-report.md");
    console.log("  + report:  ux-journey-report.md");

    const screenshotsDir = path.join(cwd, "ux-journey-screenshots");
    const screenshots = collectFiles(screenshotsDir, [".png", ".jpg", ".jpeg", ".webp"]);
    for (const filename of screenshots) {
      const filePath = path.join(screenshotsDir, filename);
      const fileBlob = new Blob([fs.readFileSync(filePath)], {
        type: `image/${path.extname(filename).slice(1)}`,
      });
      formData.append(`screenshot:${filename}`, fileBlob, filename);
      console.log(`  + screenshot: ${filename}`);
    }

    const configsDir = path.join(cwd, "ux-journey-configs");
    const configs = collectFiles(configsDir, [".json"]);
    for (const filename of configs) {
      const filePath = path.join(configsDir, filename);
      const fileBlob = new Blob([fs.readFileSync(filePath)], {
        type: "application/json",
      });
      formData.append(`config:${filename}`, fileBlob, filename);
      console.log(`  + config: ${filename}`);
    }

    const journeyMapPath = path.join(cwd, "ux-journeys.md");
    if (fs.existsSync(journeyMapPath)) {
      const mapBlob = new Blob([fs.readFileSync(journeyMapPath)], {
        type: "text/markdown",
      });
      formData.append("journeyMap", mapBlob, "ux-journeys.md");
      console.log("  + journey-map: ux-journeys.md");
    }
  } else if (skillType === "ux-journey-discovery") {
    const mapPath = path.join(cwd, "ux-journeys.md");
    if (!fs.existsSync(mapPath)) {
      console.error("ux-journeys.md not found");
      process.exit(1);
    }
    const mapBlob = new Blob([fs.readFileSync(mapPath)], {
      type: "text/markdown",
    });
    formData.append("report", mapBlob, "ux-journeys.md");
    console.log("  + report: ux-journeys.md");

    const configsDir = path.join(cwd, "ux-journey-configs");
    const configs = collectFiles(configsDir, [".json"]);
    for (const filename of configs) {
      const filePath = path.join(configsDir, filename);
      const fileBlob = new Blob([fs.readFileSync(filePath)], {
        type: "application/json",
      });
      formData.append(`config:${filename}`, fileBlob, filename);
      console.log(`  + config: ${filename}`);
    }
  } else {
    console.error(
      `Skill type '${skillType}' is not yet fully supported. Attempting generic push...`
    );
    const mdFiles = fs
      .readdirSync(cwd)
      .filter(
        (f) =>
          f.endsWith(".md") &&
          !f.startsWith("README") &&
          !f.startsWith("CHANGELOG")
      );
    if (mdFiles.length > 0) {
      const reportBlob = new Blob(
        [fs.readFileSync(path.join(cwd, mdFiles[0]))],
        { type: "text/markdown" }
      );
      formData.append("report", reportBlob, mdFiles[0]);
      console.log(`  + report: ${mdFiles[0]}`);
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
    console.log(`  Metrics:     ${data.metrics}`);
    console.log(`  Findings:    ${data.findings}`);
    console.log(`  Screenshots: ${data.screenshots}`);
    console.log(`  View at:     ${endpoint}${data.url}`);
  } catch (err) {
    console.error(`Push failed: ${err.message}`);
    process.exit(1);
  }
}

push();
