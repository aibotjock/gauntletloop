import { getAdapter } from '../adapters/index.mjs';

export function agentsForRole(config, role, requiredCapabilities = []) {
  return Object.values(config.agents)
    .filter((agent) => agent.roles.includes(role))
    .filter((agent) => requiredCapabilities.every((cap) => (agent.capabilities || []).includes(cap)))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.id.localeCompare(b.id));
}

export function resolveAgent(config, selector, role, requiredCapabilities = [], excludeIds = []) {
  if (selector && selector !== 'auto') {
    const agent = config.agents[selector];
    if (!agent) throw new Error(`Agent not found: ${selector}`);
    if (!agent.roles.includes(role)) throw new Error(`Agent ${selector} does not have role ${role}`);
    for (const cap of requiredCapabilities) if (!(agent.capabilities || []).includes(cap)) throw new Error(`Agent ${selector} lacks required capability ${cap}`);
    if (excludeIds.includes(agent.id)) throw new Error(`Agent ${selector} is excluded from ${role}`);
    return agent;
  }
  const candidate = agentsForRole(config, role, requiredCapabilities).find((a) => !excludeIds.includes(a.id));
  if (!candidate) throw new Error(`No configured ${role} agent satisfies capabilities: ${requiredCapabilities.join(', ') || '(none)'}`);
  return candidate;
}

export function resolveCritics(config, selectors, builderId, requiredCapabilities = []) {
  const out = [];
  for (const selector of selectors || ['auto']) {
    const exclude = config.workflow?.requireIndependentCritic === false ? [] : [builderId, ...out.map((a) => a.id)];
    out.push(resolveAgent(config, selector, 'critic', requiredCapabilities, exclude));
  }
  return out;
}

export async function invokeAgent(config, agent, { prompt, system, cwd }) {
  const provider = config.providers[agent.provider];
  if (!provider) throw new Error(`Provider not found for agent ${agent.id}: ${agent.provider}`);
  const adapter = getAdapter(provider.type);
  const result = await adapter.invoke({ provider, agent, prompt, system, cwd });
  return { ...result, agentId: agent.id, providerId: provider.id, providerType: provider.type, model: agent.model };
}

export async function probeAgent(config, agent, cwd) {
  const provider = config.providers[agent.provider];
  if (provider.probe === false) return { agent: agent.id, provider: provider.id, type: provider.type, model: agent.model, ok: true, skipped: true, reason: 'provider probe disabled' };
  const adapter = getAdapter(provider.type);
  try {
    const result = await adapter.probe({ provider, agent, cwd });
    return { agent: agent.id, provider: provider.id, type: provider.type, model: agent.model, ...result };
  } catch (error) {
    return { agent: agent.id, provider: provider.id, type: provider.type, model: agent.model, ok: false, error: error.message };
  }
}
