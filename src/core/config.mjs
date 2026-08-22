import fs from 'node:fs';
import path from 'node:path';
import { materializeProvider } from './presets.mjs';
import { ensureInside, readJson } from './utils.mjs';

const PROVIDER_TYPES = new Set(['openai-responses', 'openai-chat', 'anthropic-messages', 'gemini-generate-content', 'command']);
const MODES = new Set(['workspace', 'patch', 'advisory']);
const ROLES = new Set(['orchestrator', 'architect', 'builder', 'critic']);

export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['config must be a JSON object'];
  if (config.version !== 1) errors.push('version must be 1');
  if (!config.task || typeof config.task.objective !== 'string' || !config.task.objective.trim()) errors.push('task.objective is required');
  if (!config.providers || typeof config.providers !== 'object' || Array.isArray(config.providers)) errors.push('providers must be an object');
  if (!Array.isArray(config.agents) || config.agents.length === 0) errors.push('agents must be a non-empty array');

  const providerIds = new Set(Object.keys(config.providers || {}));
  for (const [id, raw] of Object.entries(config.providers || {})) {
    try {
      const provider = materializeProvider(raw);
      if (!PROVIDER_TYPES.has(provider.type)) errors.push(`providers.${id}.type is unsupported: ${provider.type}`);
      if (provider.type === 'command' && (!provider.command || !Array.isArray(provider.args))) errors.push(`providers.${id} command providers require command and args[]`);
      if (provider.apiKey !== undefined || provider.token !== undefined || provider.secret !== undefined) errors.push(`providers.${id} must reference credentials through environment variables, not literal secrets`);
      for (const [key] of Object.entries(provider.env || {})) if (/(api.?key|token|secret|password|authorization)/i.test(key)) errors.push(`providers.${id}.env must not contain credential-like values; use envPass/envFrom`);
      for (const [key] of Object.entries(provider.headers || {})) if (/(authorization|api.?key|token|secret)/i.test(key)) errors.push(`providers.${id}.headers must not contain credential headers; use apiKeyEnv/headersFromEnv`);
    } catch (error) { errors.push(`providers.${id}: ${error.message}`); }
  }

  const agentIds = new Set();
  for (const [i, agent] of (config.agents || []).entries()) {
    if (!agent?.id || typeof agent.id !== 'string') errors.push(`agents[${i}].id is required`);
    if (agent?.id && agentIds.has(agent.id)) errors.push(`duplicate agent id: ${agent.id}`);
    if (agent?.id) agentIds.add(agent.id);
    if (!providerIds.has(agent?.provider)) errors.push(`agents[${i}].provider must reference a configured provider`);
    if (!agent?.model || typeof agent.model !== 'string') errors.push(`agents[${i}].model is required`);
    if (!MODES.has(agent?.mode || 'advisory')) errors.push(`agents[${i}].mode must be workspace, patch, or advisory`);
    if (!Array.isArray(agent?.roles) || agent.roles.length === 0) errors.push(`agents[${i}].roles must be non-empty`);
    for (const role of agent?.roles || []) if (!ROLES.has(role)) errors.push(`agents[${i}] has unsupported role ${role}`);
  }

  const wf = config.workflow || {};
  if (!wf.builder || (wf.builder !== 'auto' && !agentIds.has(wf.builder))) errors.push('workflow.builder must reference an agent or be auto');
  if (!Array.isArray(wf.critics) || wf.critics.length === 0) errors.push('workflow.critics must contain at least one critic agent id');
  for (const critic of wf.critics || []) if (critic !== 'auto' && !agentIds.has(critic)) errors.push(`workflow critic not found: ${critic}`);
  if (wf.builder !== 'auto' && (wf.critics || []).includes(wf.builder) && wf.requireIndependentCritic !== false) errors.push('builder cannot also be critic when requireIndependentCritic is enabled');
  if (!Number.isInteger(wf.maxRounds || 3) || (wf.maxRounds || 3) < 1 || (wf.maxRounds || 3) > 20) errors.push('workflow.maxRounds must be an integer from 1 to 20');
  if (wf.passPolicy && !['all', 'majority'].includes(wf.passPolicy)) errors.push('workflow.passPolicy must be all or majority');

  for (const [i, command] of (config.verification?.commands || []).entries()) {
    if (!command?.name || !command?.command || !Array.isArray(command?.args || [])) errors.push(`verification.commands[${i}] requires name, command, args[]`);
  }
  return errors;
}

export function loadConfig(explicitPath) {
  const cwd = process.cwd();
  const candidates = [explicitPath, process.env.GAUNTLET_CONFIG, 'config/gauntlet.json', 'config/gauntlet.example.json'].filter(Boolean);
  const filePath = candidates.map((p) => path.resolve(cwd, p)).find((p) => fs.existsSync(p));
  if (!filePath) throw new Error('No Gauntlet config found. Copy config/gauntlet.example.json to config/gauntlet.json.');
  const config = readJson(filePath);
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Invalid Gauntlet config:\n- ${errors.join('\n- ')}`);
  const configDir = path.dirname(filePath);
  const workspace = path.resolve(configDir, config.workspace || '..');
  const providers = Object.fromEntries(Object.entries(config.providers).map(([id, p]) => {
    const provider = { id, ...materializeProvider(p) };
    if (!provider.baseUrl && provider.baseUrlEnv && process.env[provider.baseUrlEnv]) provider.baseUrl = process.env[provider.baseUrlEnv];
    return [id, provider];
  }));
  const agents = Object.fromEntries(config.agents.map((a) => [a.id, { mode: 'advisory', capabilities: [], ...a }]));
  return { config: { ...config, providers, agents }, filePath, workspace };
}

export function resolveRunPath(workspace, candidate, allowOutside = false) {
  return allowOutside ? path.resolve(workspace, candidate) : ensureInside(workspace, candidate, 'working directory');
}
