import fs from 'node:fs';
import path from 'node:path';
import { nowId, safeSlug, writeJson } from '../core/utils.mjs';

function routeUrl(base, routePath) {
  return new URL(routePath, `${base.replace(/\/$/, '')}/`).toString();
}

function telemetry(page) {
  const data = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [] };
  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    if (msg.type() === 'error') data.consoleErrors.push(entry);
    if (msg.type() === 'warning') data.consoleWarnings.push(entry);
  });
  page.on('pageerror', (error) => data.pageErrors.push({ message: error.message, name: error.name }));
  page.on('requestfailed', (request) => data.requestFailures.push({
    url: request.url(), method: request.method(), resourceType: request.resourceType(), errorText: request.failure()?.errorText || 'unknown'
  }));
  return data;
}

async function auditPage(page, keyboardTabs = 6) {
  const audit = await page.evaluate(() => {
    const visible = (el) => {
      const s = getComputedStyle(el); const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const brief = (el) => {
      if (!el) return null; const tag = el.tagName?.toLowerCase() || 'unknown';
      if (el.id) return `${tag}#${el.id}`;
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return cls ? `${tag}.${cls}` : tag;
    };
    const overflowElements = [...document.querySelectorAll('body *')].filter(visible).filter((el) => {
      const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1;
    }).slice(0, 30).map((el) => { const r = el.getBoundingClientRect(); return { selector: brief(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; });
    const issues = [];
    if (!document.documentElement.lang) issues.push({ rule: 'html-lang', detail: 'html element is missing lang' });
    if (!document.title.trim()) issues.push({ rule: 'document-title', detail: 'document title is empty' });
    for (const img of [...document.images].filter(visible)) if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation') issues.push({ rule: 'img-alt', detail: brief(img) });
    for (const button of [...document.querySelectorAll('button')].filter(visible)) {
      const name = (button.innerText || button.getAttribute('aria-label') || button.getAttribute('title') || '').trim();
      if (!name) issues.push({ rule: 'button-name', detail: brief(button) });
    }
    for (const link of [...document.querySelectorAll('a[href]')].filter(visible)) {
      const name = (link.innerText || link.getAttribute('aria-label') || link.getAttribute('title') || '').trim();
      if (!name) issues.push({ rule: 'link-name', detail: brief(link) });
    }
    for (const input of [...document.querySelectorAll('input,select,textarea')].filter(visible)) {
      const named = input.labels?.length || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || input.getAttribute('title');
      if (!named) issues.push({ rule: 'form-label', detail: brief(input) });
    }
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
    for (const id of [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))].slice(0, 20)) issues.push({ rule: 'duplicate-id', detail: id });
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]));
    return {
      title: document.title, lang: document.documentElement.lang || null,
      viewportWidth: innerWidth, documentScrollWidth: document.documentElement.scrollWidth,
      documentHasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      overflowElements, a11yHeuristicIssues: issues.slice(0, 100),
      performance: nav ? { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadEventMs: Math.round(nav.loadEventEnd), transferSize: nav.transferSize, decodedBodySize: nav.decodedBodySize, paints } : { paints }
    };
  });
  const focusSequence = [];
  for (let i = 0; i < keyboardTabs; i++) {
    await page.keyboard.press('Tab');
    focusSequence.push(await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      return { tag: el.tagName?.toLowerCase() || null, id: el.id || null, role: el.getAttribute?.('role') || null, name: (el.getAttribute?.('aria-label') || el.textContent || '').trim().slice(0, 120) };
    }));
  }
  audit.focusSequence = focusSequence.filter(Boolean);
  return audit;
}

async function performStep(page, step, timeout) {
  switch (step.action) {
    case 'click': await page.locator(step.selector).click({ timeout }); break;
    case 'fill': await page.locator(step.selector).fill(step.value, { timeout }); break;
    case 'press': await page.keyboard.press(step.key); break;
    case 'waitForSelector': await page.locator(step.selector).waitFor({ timeout }); break;
    case 'waitForTimeout': await page.waitForTimeout(step.ms); break;
    default: throw new Error(`Unsupported browser interaction action: ${step.action}`);
  }
}

export async function renderWebUI({ workspace, config, runDir, targetUrl }) {
  const web = config.verification?.webui;
  if (!web?.enabled) return null;
  const baseUrl = targetUrl || process.env[web.targetUrlEnv || 'TARGET_URL'] || web.targetUrl;
  if (!baseUrl) throw new Error('WebUI verification enabled but no target URL was supplied');
  const routes = web.routes?.length ? web.routes : [{ name: 'home', path: '/' }];
  const viewports = web.viewports?.length ? web.viewports : [
    { name: 'desktop', width: 1440, height: 1000, required: true },
    { name: 'compact', width: 1100, height: 900, required: true },
    { name: 'mobile', width: 390, height: 844, required: true }
  ];
  const policy = {
    navigationTimeoutMs: 30000, settleMs: 500, keyboardTabs: 6,
    failOnConsoleErrors: true, failOnRequestFailures: true, failOnHorizontalOverflow: true, failOnA11yHeuristics: true,
    ...(web.policy || {})
  };
  const browserDir = path.join(runDir, 'browser');
  fs.mkdirSync(browserDir, { recursive: true });
  const manifest = { schemaVersion: 1, runId: nowId('browser'), targetUrl: baseUrl, policy, routes, viewports, interactions: web.interactions || [], records: [], fatalError: null };
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('WebUI verification requires Playwright. Run npm install (and npx playwright install chromium) before browser runs.'); }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const events = telemetry(page);
      for (const route of routes) {
        const scenarios = [{ kind: 'base', name: 'base', steps: [] }, ...(web.interactions || []).filter((x) => x.route === route.name).map((x) => ({ kind: 'interaction', name: x.name, steps: x.steps || [] }))];
        for (const scenario of scenarios) {
          const start = Object.fromEntries(Object.keys(events).map((k) => [k, events[k].length]));
          const url = routeUrl(baseUrl, route.path);
          let responseStatus = null; let navigationError = null; let audit = null; let screenshot = null;
          try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: policy.navigationTimeoutMs });
            responseStatus = response?.status() ?? null;
            if (policy.settleMs) await page.waitForTimeout(policy.settleMs);
            for (const step of scenario.steps) await performStep(page, step, policy.navigationTimeoutMs);
            if (scenario.steps.length && policy.settleMs) await page.waitForTimeout(policy.settleMs);
            audit = await auditPage(page, policy.keyboardTabs);
            screenshot = `${safeSlug(viewport.name)}__${safeSlug(route.name)}__${safeSlug(scenario.kind)}__${safeSlug(scenario.name)}.png`;
            await page.screenshot({ path: path.join(browserDir, screenshot), fullPage: true });
          } catch (error) { navigationError = { name: error.name, message: error.message }; }
          const slice = (k) => events[k].slice(start[k]);
          manifest.records.push({ kind: scenario.kind, scenario: scenario.name, route: route.name, path: route.path, url, viewport, responseStatus, navigationError, screenshot, consoleErrors: slice('consoleErrors'), consoleWarnings: slice('consoleWarnings'), pageErrors: slice('pageErrors'), requestFailures: slice('requestFailures'), audit });
        }
      }
      await context.close();
    }
  } catch (error) {
    manifest.fatalError = { name: error.name, message: error.message, stack: error.stack };
  } finally { await browser.close(); }
  manifest.completedAt = new Date().toISOString();
  const manifestPath = path.join(browserDir, 'manifest.json');
  writeJson(manifestPath, manifest);
  return { manifestPath, manifest, relativeManifestPath: path.relative(workspace, manifestPath) };
}
