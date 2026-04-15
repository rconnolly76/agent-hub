#!/usr/bin/env node

import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const PRIORITIES = ["P1", "P2", "P3", "P4", "P5"];

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    llm: argv.includes("--llm"),
    interpretive: argv.includes("--interpretive"),
    limit: (() => {
      const idx = argv.indexOf("--limit");
      if (idx === -1) return null;
      const value = Number(argv[idx + 1]);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
    })(),
  };
}

function fallbackRecommendations(skillType, findings, metrics) {
  const rank = (severity) => {
    switch ((severity ?? "").toLowerCase()) {
      case "critical":
        return 0;
      case "warning":
        return 1;
      case "investigate":
        return 2;
      case "info":
        return 3;
      case "low":
        return 4;
      default:
        return 5;
    }
  };

  const sorted = [...findings].sort((a, b) => rank(a.severity) - rank(b.severity));
  const recommendations = [];
  const seen = new Set();

  for (const finding of sorted) {
    const title = (finding.title ?? "").trim();
    const action = (finding.recommendation?.what ?? "").trim();
    if (!title && !action) continue;
    const dedupe = (title || action).toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    recommendations.push({
      priority: PRIORITIES[Math.min(recommendations.length, 4)],
      title: title || "Address identified finding",
      action: action || `Resolve ${title} and validate via rerun.`,
      rationale: (finding.recommendation?.why ?? "").trim() || undefined,
      severity: finding.severity || undefined,
    });
    if (recommendations.length === 5) break;
  }

  const critical = metrics.find((m) => m.key === "severity_critical")?.value ?? 0;
  const warning = metrics.find((m) => m.key === "severity_warning")?.value ?? 0;

  while (recommendations.length < 5) {
    const index = recommendations.length;
    const fallback =
      index === 0 && critical > 0
        ? {
            title: "Resolve critical issues first",
            action: `Fix ${critical} critical issue${critical === 1 ? "" : "s"} and verify immediately.`,
            rationale: "Critical issues carry the highest delivery risk.",
            severity: "critical",
          }
        : index <= 1 && warning > 0
          ? {
              title: "Triage warning backlog",
              action: "Prioritize warning findings by user impact and close highest-risk items.",
              rationale: "Warnings can quickly become release-blocking issues.",
              severity: "warning",
            }
          : index === 3
            ? {
                title: "Assign owners and success criteria",
                action: "Create tasks with owner, effort, and done-when criteria for each recommendation.",
                rationale: "Explicit ownership improves execution consistency.",
              }
            : {
                title: "Rerun and measure trend",
                action: `Rerun ${skillType} after changes and confirm critical/warning metrics improve.`,
                rationale: "Trend verification confirms recommendation impact.",
              };

    recommendations.push({
      priority: PRIORITIES[index],
      ...fallback,
    });
  }

  return {
    version: "1.0",
    skillType,
    generatedAt: new Date().toISOString(),
    recommendations: recommendations.slice(0, 5),
  };
}

function interpretiveRecommendations(skillType, findings, metrics, reportMarkdown) {
  const normalizedReport = (reportMarkdown || "").toLowerCase();
  const recommendations = [];
  const seen = new Set();

  const rank = (severity) => {
    switch ((severity ?? "").toLowerCase()) {
      case "critical":
        return 0;
      case "warning":
        return 1;
      case "investigate":
        return 2;
      case "info":
        return 3;
      case "low":
        return 4;
      default:
        return 5;
    }
  };

  const verbs = [
    "Stabilize",
    "Refine",
    "Harden",
    "Rework",
    "Clarify",
    "Strengthen",
  ];

  const sortedFindings = [...findings].sort(
    (a, b) => rank(a.severity) - rank(b.severity)
  );

  for (let i = 0; i < sortedFindings.length && recommendations.length < 5; i += 1) {
    const finding = sortedFindings[i];
    const findingTitle = (finding.title ?? "").trim();
    const recommendationWhat = (finding.recommendation?.what ?? "").trim();
    const rationale = (finding.recommendation?.why ?? "").trim();
    if (!findingTitle && !recommendationWhat) continue;

    const anchor = findingTitle || recommendationWhat;
    if (seen.has(anchor.toLowerCase())) continue;
    seen.add(anchor.toLowerCase());
    const verb = verbs[i % verbs.length];
    const title = `${verb} ${anchor.replace(/^[Rr]esolve:\s*/, "")}`.slice(0, 140);
    const action = recommendationWhat
      ? recommendationWhat
      : `Address "${findingTitle}" with a targeted fix and validate in the next ${skillType} rerun.`;

    recommendations.push({
      priority: PRIORITIES[recommendations.length],
      title,
      action,
      rationale: rationale || undefined,
      severity: finding.severity || undefined,
    });
  }

  const hasVisualSignals =
    normalizedReport.includes("visual") ||
    normalizedReport.includes("typography") ||
    normalizedReport.includes("hierarchy");
  const hasJourneySignals =
    normalizedReport.includes("journey") ||
    normalizedReport.includes("flow") ||
    normalizedReport.includes("funnel");
  const hasSecuritySignals =
    normalizedReport.includes("security") ||
    normalizedReport.includes("vulnerab") ||
    normalizedReport.includes("xss");
  const hasPerformanceSignals =
    normalizedReport.includes("performance") ||
    normalizedReport.includes("lcp") ||
    normalizedReport.includes("bundle");

  const critical = metrics.find((m) => m.key === "severity_critical")?.value ?? 0;
  const warning = metrics.find((m) => m.key === "severity_warning")?.value ?? 0;
  const coverage = metrics.find((m) => m.key === "heuristic_coverage")?.value ?? null;

  const contextSteps = [
    hasSecuritySignals
      ? {
          title: "Close high-risk security exposure paths",
          action:
            "Prioritize auth/input/header fixes that reduce exploitability, then retest key attack surfaces.",
          rationale:
            "Security debt compounds quickly and can block releases if left unresolved.",
        }
      : null,
    hasPerformanceSignals
      ? {
          title: "Improve performance bottlenecks on core surfaces",
          action:
            "Target the heaviest render/bundle hotspots first, then verify measurable LCP and interaction improvements.",
          rationale:
            "Performance regressions directly affect conversion and retention.",
        }
      : null,
    hasJourneySignals
      ? {
          title: "Smooth the core journey path",
          action:
            "Remove friction across entry, primary action, and confirmation states to increase successful completions.",
          rationale:
            "Journey friction has outsized impact on task success.",
        }
      : null,
    hasVisualSignals
      ? {
          title: "Increase visual consistency and scan clarity",
          action:
            "Standardize hierarchy, spacing, and component treatment where inconsistency weakens readability.",
          rationale:
            "Consistent visual systems reduce cognitive load and improve trust.",
        }
      : null,
    critical > 0
      ? {
          title: "Burn down critical issues before broader polish",
          action: `Resolve ${critical} critical issue${critical === 1 ? "" : "s"} first and gate release progression on validation.`,
          rationale: "Critical issues represent the highest operational and UX risk.",
          severity: "critical",
        }
      : null,
    warning > 0
      ? {
          title: "Systematically reduce warning backlog",
          action:
            "Cluster warning findings by root cause and resolve in small focused batches.",
          rationale:
            "A shrinking warning baseline makes regressions easier to spot.",
          severity: "warning",
        }
      : null,
    typeof coverage === "number" && coverage < 100
      ? {
          title: "Expand validation coverage depth",
          action: `Increase coverage from ${coverage}% toward full scope by testing unvalidated states and edge cases.`,
          rationale: "Coverage gaps can hide release-critical defects.",
        }
      : null,
    {
      title: "Instrument ownership and close-loop validation",
      action:
        "Assign each recommendation to an owner with done-when criteria, then rerun the skill to confirm trend improvement.",
      rationale: "Execution quality depends on explicit ownership and measurable verification.",
    },
  ].filter(Boolean);

  for (const step of contextSteps) {
    if (recommendations.length >= 5) break;
    if (!step || seen.has(step.title.toLowerCase())) continue;
    seen.add(step.title.toLowerCase());
    recommendations.push({
      priority: PRIORITIES[recommendations.length],
      title: step.title,
      action: step.action,
      rationale: step.rationale,
      severity: step.severity,
    });
  }

  while (recommendations.length < 5) {
    recommendations.push({
      priority: PRIORITIES[recommendations.length],
      title: `Prioritized follow-up ${recommendations.length + 1}`,
      action: `Execute prioritized follow-up ${recommendations.length + 1} for ${skillType} and verify impact in the next run.`,
      rationale: "Maintaining momentum across recommendation cycles reduces regression risk.",
    });
  }

  return {
    version: "1.0",
    skillType,
    generatedAt: new Date().toISOString(),
    recommendations: recommendations.slice(0, 5),
  };
}

function normalizeLlmPayload(raw, skillType) {
  if (!raw || typeof raw !== "object") return null;
  const recs = Array.isArray(raw.recommendations) ? raw.recommendations : null;
  if (!recs) return null;

  const normalized = recs
    .map((r, index) => {
      if (!r || typeof r !== "object") return null;
      const title =
        typeof r.title === "string" ? r.title.trim() : "";
      const action =
        typeof r.action === "string" ? r.action.trim() : "";
      if (!title || !action) return null;
      const priorityRaw =
        typeof r.priority === "string" ? r.priority.trim().toUpperCase() : "";
      const priority = PRIORITIES.includes(priorityRaw)
        ? priorityRaw
        : PRIORITIES[Math.min(index, 4)];
      const severityRaw =
        typeof r.severity === "string" ? r.severity.toLowerCase() : undefined;
      const severity =
        severityRaw &&
        ["critical", "warning", "info", "low", "investigate"].includes(severityRaw)
          ? severityRaw
          : undefined;
      return {
        priority,
        title,
        action,
        rationale:
          typeof r.rationale === "string" ? r.rationale.trim() : undefined,
        severity,
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  if (normalized.length === 0) return null;
  normalized.sort(
    (a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
  );

  return {
    version: "1.0",
    skillType,
    generatedAt: new Date().toISOString(),
    recommendations: normalized,
  };
}

async function generateWithLlm({
  model,
  apiKey,
  skillType,
  reportMarkdown,
  findings,
  metrics,
}) {
  const system =
    "You are a strict JSON formatter. Output only valid JSON with a top-level `recommendations` array of exactly 5 objects. Each object must include priority (P1..P5), title, action, and optional rationale and severity.";
  const user = `Skill type: ${skillType}

Findings JSON:
${JSON.stringify(findings)}

Metrics JSON:
${JSON.stringify(metrics)}

Report excerpt:
${reportMarkdown.slice(0, 12000)}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("LLM response missing JSON content");
  }
  const parsed = JSON.parse(content);
  return normalizeLlmPayload(parsed, skillType);
}

async function main() {
  const { dryRun, force, llm, interpretive, limit } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const llmApiKey = process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? "";
  const llmModel = process.env.LLM_MODEL ?? "gpt-4.1-mini";
  if (llm && !llmApiKey) {
    console.error("LLM mode requested but OPENAI_API_KEY/LLM_API_KEY is not set");
    process.exit(1);
  }

  const sql = neon(url);
  const maybeLimit = limit ? `limit ${limit}` : "";
  const runs = await sql.query(
    `select id, skill_type, raw_metadata from runs order by created_at desc ${maybeLimit}`
  );

  let updated = 0;
  let skippedHasRecommendations = 0;
  let skippedNoData = 0;
  let llmGenerated = 0;
  let fallbackGenerated = 0;
  let failures = 0;

  for (const run of runs) {
    try {
      const raw = run.raw_metadata ?? {};
      if (!force && raw?.topRecommendations) {
        skippedHasRecommendations += 1;
        continue;
      }

      const findings = await sql`
        select severity, title, description, category, recommendation
        from findings
        where run_id = ${run.id}
      `;
      const metrics = await sql`
        select key, value
        from metrics
        where run_id = ${run.id}
      `;

      const reportArtifact = await sql`
        select blob_url
        from artifacts
        where run_id = ${run.id}
          and role = 'report'
        order by created_at desc
        limit 1
      `;
      const reportUrl = reportArtifact[0]?.blob_url;

      let reportMarkdown = "";
      if (reportUrl) {
        const res = await fetch(reportUrl);
        if (res.ok) {
          reportMarkdown = await res.text();
        }
      }

      if (!reportMarkdown && findings.length === 0 && metrics.length === 0) {
        skippedNoData += 1;
        continue;
      }

      let topRecommendations = null;
      if (llm && llmApiKey) {
        try {
          topRecommendations = await generateWithLlm({
            model: llmModel,
            apiKey: llmApiKey,
            skillType: run.skill_type,
            reportMarkdown,
            findings,
            metrics,
          });
          if (topRecommendations) {
            llmGenerated += 1;
          }
        } catch (error) {
          console.warn(
            `LLM fallback for run ${run.id}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      if (!topRecommendations && interpretive) {
        topRecommendations = interpretiveRecommendations(
          run.skill_type,
          findings,
          metrics,
          reportMarkdown
        );
      }

      if (!topRecommendations) {
        topRecommendations = fallbackRecommendations(
          run.skill_type,
          findings,
          metrics
        );
        fallbackGenerated += 1;
      }

      const nextRaw = {
        ...(raw ?? {}),
        topRecommendations,
      };

      if (!dryRun) {
        await sql`
          update runs
          set raw_metadata = ${JSON.stringify(nextRaw)}::jsonb
          where id = ${run.id}
        `;
      }
      updated += 1;
    } catch (error) {
      failures += 1;
      console.warn(
        `Failed run ${run.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  console.log("");
  console.log("Top recommendations backfill complete");
  console.log(`- processed: ${runs.length}`);
  console.log(`- updated: ${updated}${dryRun ? " (dry-run)" : ""}`);
  console.log(`- skipped (already had top recommendations): ${skippedHasRecommendations}`);
  console.log(`- skipped (insufficient source data): ${skippedNoData}`);
  console.log(`- generated with LLM: ${llmGenerated}`);
  console.log(`- generated with fallback: ${fallbackGenerated}`);
  console.log(`- failures: ${failures}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
