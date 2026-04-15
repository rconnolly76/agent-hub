#!/usr/bin/env node

/**
 * UX Journey Runner — Playwright-based fallback
 * 
 * Usage:
 *   node journey-runner.js --config ./journey-config.json
 *   node journey-runner.js --url https://example.com --steps steps.json
 * 
 * Captures: console logs, network requests, screenshots, accessibility,
 * performance metrics, and DOM assertions at every step.
 */

const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

// ── Parse CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const configPath = args.includes('--config')
  ? args[args.indexOf('--config') + 1]
  : null;

let journey;
if (configPath) {
  journey = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} else {
  console.error('Usage: node journey-runner.js --config journey-config.json');
  process.exit(1);
}

// ── Output dirs ─────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.resolve('./ux-journey-screenshots');
const RESULTS_PATH = path.resolve('./ux-journey-results.json');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Main runner ─────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: journey.viewport || { width: 1440, height: 900 },
    userAgent: 'UXJourneyReviewer/1.0',
  });
  const page = await context.newPage();

  // ── Collectors ────────────────────────────────────────────────────────────

  const results = {
    journey: journey,
    startedAt: new Date().toISOString(),
    steps: [],
    summary: {},
  };

  let consoleLogs = [];
  let networkRequests = [];

  page.on('console', (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: Date.now(),
    });
  });

  page.on('pageerror', (err) => {
    consoleLogs.push({
      type: 'pageerror',
      text: err.message,
      stack: err.stack,
      timestamp: Date.now(),
    });
  });

  page.on('requestfinished', async (req) => {
    const response = req.response ? await req.response() : null;
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      status: response ? response.status() : null,
      duration: req.timing() ? req.timing().responseEnd - req.timing().requestStart : null,
      resourceType: req.resourceType(),
      timestamp: Date.now(),
    });
  });

  page.on('requestfailed', (req) => {
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      status: null,
      failure: req.failure()?.errorText || 'Unknown failure',
      resourceType: req.resourceType(),
      timestamp: Date.now(),
      failed: true,
    });
  });

  // ── Inject Web Vitals observer ────────────────────────────────────────────

  async function injectWebVitals() {
    await page.evaluate(() => {
      window.__uxMetrics = { lcp: null, cls: 0, fid: null, ttfb: null };

      // LCP
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          window.__uxMetrics.lcp = entries[entries.length - 1]?.startTime || null;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {}

      // CLS
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__uxMetrics.cls += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}

      // FID
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            window.__uxMetrics.fid = entries[0].processingStart - entries[0].startTime;
          }
        }).observe({ type: 'first-input', buffered: true });
      } catch (e) {}

      // TTFB
      try {
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
          window.__uxMetrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        }
      } catch (e) {}
    });
  }

  async function collectWebVitals() {
    try {
      return await page.evaluate(() => window.__uxMetrics || {});
    } catch {
      return {};
    }
  }

  // ── Run accessibility scan ────────────────────────────────────────────────

  async function runAxeScan() {
    try {
      const axeResults = await new AxeBuilder({ page }).analyze();
      return {
        violations: axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
        })),
        passes: axeResults.passes.length,
        incomplete: axeResults.incomplete.length,
      };
    } catch (err) {
      return { error: err.message, violations: [], passes: 0, incomplete: 0 };
    }
  }

  // ── Step executor ─────────────────────────────────────────────────────────

  for (const step of journey.steps) {
    const stepStart = Date.now();
    const stepConsoleBefore = consoleLogs.length;
    const stepNetworkBefore = networkRequests.length;

    const stepResult = {
      id: step.id,
      description: step.description,
      action: step.action,
      status: 'pass',
      errors: [],
      consoleLogs: [],
      networkRequests: [],
      accessibility: {},
      performance: {},
      screenshot: null,
      url: null,
      title: null,
      duration: null,
    };

    try {
      // Execute the action
      switch (step.action) {
        case 'navigate':
          await page.goto(step.target, { waitUntil: 'networkidle', timeout: 30000 });
          await injectWebVitals();
          break;

        case 'click':
          if (step.expect && step.expect.url_contains) {
            await Promise.all([
              page.waitForURL(`**/*${step.expect.url_contains}*`, { timeout: 15000 }),
              page.locator(step.target).first().click({ timeout: 10000 }),
            ]);
          } else {
            await page.locator(step.target).first().click({ timeout: 10000 });
          }
          await page.waitForLoadState('networkidle').catch(() => {});
          break;

        case 'fill':
          if (step.fields) {
            for (const [selector, value] of Object.entries(step.fields)) {
              await page.locator(selector).fill(value, { timeout: 10000 });
            }
          } else {
            await page.locator(step.target).fill(step.value || '', { timeout: 10000 });
          }
          break;

        case 'select':
          await page.locator(step.target).selectOption(step.value, { timeout: 10000 });
          break;

        case 'scroll':
          await page.evaluate((sel) => {
            const el = sel ? document.querySelector(sel) : window;
            if (el === window) window.scrollBy(0, 500);
            else el.scrollIntoView({ behavior: 'smooth' });
          }, step.target || null);
          await page.waitForTimeout(500);
          break;

        case 'wait':
          await page.waitForSelector(step.target, { timeout: step.timeout || 10000 });
          break;

        case 'type':
          await page.locator(step.target).pressSequentially(step.value || '', { delay: 50 });
          break;

        default:
          stepResult.errors.push(`Unknown action: ${step.action}`);
          stepResult.status = 'fail';
      }

      // Wait a beat for async side effects
      await page.waitForTimeout(300);

      // Collect state
      stepResult.url = page.url();
      stepResult.title = await page.title();

      // DOM assertions
      if (step.expect) {
        if (step.expect.url_contains && !page.url().includes(step.expect.url_contains)) {
          stepResult.errors.push(`URL expected to contain "${step.expect.url_contains}", got "${page.url()}"`);
          stepResult.status = 'fail';
        }
        if (step.expect.title_contains) {
          const title = await page.title();
          if (!title.includes(step.expect.title_contains)) {
            stepResult.errors.push(`Title expected to contain "${step.expect.title_contains}", got "${title}"`);
            stepResult.status = 'fail';
          }
        }
        if (step.expect.elements) {
          for (const sel of step.expect.elements) {
            const count = await page.locator(sel).count();
            if (count === 0) {
              stepResult.errors.push(`Expected element "${sel}" not found`);
              stepResult.status = stepResult.status === 'fail' ? 'fail' : 'warn';
            }
          }
        }
      }
    } catch (err) {
      stepResult.errors.push(err.message);
      stepResult.status = 'fail';
    }

    // Capture console logs for this step
    stepResult.consoleLogs = consoleLogs.slice(stepConsoleBefore);

    // Capture network requests for this step
    stepResult.networkRequests = networkRequests.slice(stepNetworkBefore).map((r) => ({
      ...r,
      flagged:
        r.failed ||
        (r.status && r.status >= 400) ||
        (r.duration && r.duration > 2000),
    }));

    // Screenshot
    const screenshotName = `step-${step.id}-${(step.description || 'unnamed').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      stepResult.screenshot = screenshotPath;
    } catch (err) {
      stepResult.errors.push(`Screenshot failed: ${err.message}`);
    }

    // Accessibility
    stepResult.accessibility = await runAxeScan();

    // Performance
    stepResult.performance = await collectWebVitals();

    // Duration
    stepResult.duration = Date.now() - stepStart;

    // Escalate warnings from console errors
    const jsErrors = stepResult.consoleLogs.filter(
      (l) => l.type === 'error' || l.type === 'pageerror'
    );
    if (jsErrors.length > 0 && stepResult.status === 'pass') {
      stepResult.status = 'warn';
    }

    results.steps.push(stepResult);

    console.log(
      `Step ${step.id}: ${stepResult.status.toUpperCase()} — ${step.description} (${stepResult.duration}ms)`
    );

    // Abort on fatal failure if configured
    if (stepResult.status === 'fail' && journey.abortOnFailure) {
      console.log('Aborting journey due to step failure.');
      break;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const passed = results.steps.filter((s) => s.status === 'pass').length;
  const warned = results.steps.filter((s) => s.status === 'warn').length;
  const failed = results.steps.filter((s) => s.status === 'fail').length;
  const totalConsoleErrors = results.steps.reduce(
    (sum, s) => sum + s.consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror').length,
    0
  );
  const totalNetworkIssues = results.steps.reduce(
    (sum, s) => sum + s.networkRequests.filter((r) => r.flagged).length,
    0
  );
  const totalA11yViolations = results.steps.reduce(
    (sum, s) => sum + (s.accessibility.violations?.length || 0),
    0
  );

  results.summary = {
    totalSteps: journey.steps.length,
    completed: results.steps.length,
    passed,
    warned,
    failed,
    totalConsoleErrors,
    totalNetworkIssues,
    totalA11yViolations,
    overallStatus: failed > 0 ? 'CRITICAL' : warned > 0 ? 'NEEDS WORK' : 'PASS',
  };
  results.completedAt = new Date().toISOString();

  // Write results JSON
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${RESULTS_PATH}`);
  console.log(`Screenshots saved to ${SCREENSHOT_DIR}/`);
  console.log(`\nOverall: ${results.summary.overallStatus}`);
  console.log(
    `  ${passed} passed, ${warned} warnings, ${failed} failed`
  );
  console.log(
    `  ${totalConsoleErrors} console errors, ${totalNetworkIssues} network issues, ${totalA11yViolations} a11y violations`
  );

  await browser.close();
})();
