import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { renderWebUI } from '../browser/render.mjs';
import { verifyBrowserEvidence } from '../browser/verify.mjs';
import { truncate, writeJson } from './utils.mjs';

function run(command, args, { cwd, timeoutMs = 120000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: null, error: error.message, stdout, stderr, timedOut, latencyMs: Date.now() - started }); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr, timedOut, latencyMs: Date.now() - started }); });
  });
}

export async function runVerification({ config, workspace, runDir, targetUrl }) {
  fs.mkdirSync(runDir, { recursive: true });
  const commands = [];
  for (const check of config.verification?.commands || []) {
    const result = await run(check.command, check.args || [], { cwd: path.resolve(workspace, check.cwd || '.'), timeoutMs: check.timeoutMs || 120000 });
    commands.push({ name: check.name, required: check.required !== false, command: check.command, args: check.args || [], ...result, stdout: truncate(result.stdout, 20000), stderr: truncate(result.stderr, 20000) });
  }
  const commandFailures = commands.filter((r) => r.required && (r.code !== 0 || r.timedOut || r.error));
  let browser = null;
  if (config.verification?.webui?.enabled) {
    const rendered = await renderWebUI({ workspace, config, runDir, targetUrl });
    const verdict = verifyBrowserEvidence(rendered.manifestPath);
    browser = { manifestPath: rendered.manifestPath, verdict };
  }
  const passed = commandFailures.length === 0 && (!browser || browser.verdict.passed);
  const summary = { passed, commands, browser, commandFailures: commandFailures.map((x) => x.name) };
  writeJson(path.join(runDir, 'verification.json'), summary);
  return summary;
}
