#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { adapterTypes } from './adapters/index.mjs';
import { invokeAgent, probeAgent } from './core/agents.mjs';
import { loadConfig } from './core/config.mjs';
import { commandPresets, providerPresets } from './core/presets.mjs';
import { runGauntlet } from './core/orchestrator.mjs';
import { renderWebUI } from './browser/render.mjs';
import { verifyBrowserEvidence } from './browser/verify.mjs';
import { nowId, writeJson } from './core/utils.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('--')) { out._.push(value); continue; }
    const [raw, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) out[raw] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[raw] = argv[++i];
    else out[raw] = true;
  }
  return out;
}

function help() {
  console.log(`Universal Gauntlet Runtime\n\nUsage:\n  gauntlet init [--force]\n  gauntlet providers\n  gauntlet doctor [--config FILE]\n  gauntlet invoke --agent ID --prompt TEXT [--config FILE]\n  gauntlet run [--config FILE] [--task TEXT] [--target-url URL]\n  gauntlet render [--config FILE] [--target-url URL]\n  gauntlet verify-evidence --manifest FILE\n\nThe runtime never stores API keys in configuration; use environment variables.`);
}

async function main() {
  const args = parse(process.argv.slice(2));
  const command = args._[0] || 'help';
  if (['help', '-h', '--help'].includes(command)) return help();
  if (command === 'init') {
    const dst = path.resolve(process.cwd(), 'config', 'gauntlet.json');
    if (fs.existsSync(dst) && !args.force) throw new Error(`${dst} already exists (use --force to replace)`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(root, 'config', 'gauntlet.example.json'), dst);
    console.log(`Created ${dst}`); return;
  }
  if (command === 'providers') {
    console.log(JSON.stringify({ adapters: adapterTypes(), apiPresets: Object.keys(providerPresets), commandPresets: Object.keys(commandPresets) }, null, 2)); return;
  }
  const loaded = loadConfig(args.config);
  if (args.task) loaded.config.task = { ...loaded.config.task, objective: String(args.task) };
  if (command === 'doctor') {
    const reports = [];
    for (const agent of Object.values(loaded.config.agents)) reports.push(await probeAgent(loaded.config, agent, loaded.workspace));
    console.log(JSON.stringify({ config: loaded.filePath, workspace: loaded.workspace, reports }, null, 2));
    if (reports.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }
  if (command === 'invoke') {
    const agent = loaded.config.agents[args.agent];
    if (!agent) throw new Error('--agent must name a configured agent');
    const prompt = args.prompt || args._.slice(1).join(' ');
    if (!prompt) throw new Error('--prompt is required');
    const result = await invokeAgent(loaded.config, agent, { prompt, system: args.system || '', cwd: loaded.workspace });
    console.log(result.text); return;
  }
  if (command === 'run') {
    const result = await runGauntlet({ config: loaded.config, workspace: loaded.workspace, targetUrl: args['target-url'], onEvent: (e) => console.error(`[gauntlet] ${JSON.stringify(e)}`) });
    console.log(JSON.stringify({ runId: result.runId, verdict: result.verdict, report: path.join(result.runRoot, 'final-report.json') }, null, 2));
    if (result.verdict !== 'GAUNTLET PASSED') process.exitCode = 2;
    return;
  }
  if (command === 'render') {
    if (!loaded.config.verification?.webui?.enabled) throw new Error('verification.webui.enabled must be true');
    const runDir = path.join(loaded.workspace, 'evidence', nowId('manual'));
    const result = await renderWebUI({ workspace: loaded.workspace, config: loaded.config, runDir, targetUrl: args['target-url'] });
    const verdict = verifyBrowserEvidence(result.manifestPath);
    writeJson(path.join(runDir, 'browser-verdict.json'), verdict);
    console.log(JSON.stringify({ manifest: result.manifestPath, ...verdict }, null, 2));
    if (!verdict.passed) process.exitCode = 2;
    return;
  }
  if (command === 'verify-evidence') {
    if (!args.manifest) throw new Error('--manifest is required');
    const verdict = verifyBrowserEvidence(path.resolve(args.manifest));
    console.log(JSON.stringify(verdict, null, 2));
    if (!verdict.passed) process.exitCode = 2;
    return;
  }
  help(); process.exitCode = 1;
}

main().catch((error) => { console.error(`Gauntlet error: ${error.stack || error.message}`); process.exitCode = 1; });
