import { authHeaders, joinUrl, requestJson } from './http.mjs';

export async function invokeAnthropicMessages({ provider, agent, prompt, system }) {
  const url = joinUrl(provider.baseUrl, 'v1/messages');
  const headers = authHeaders(provider, 'anthropic');
  headers['anthropic-version'] = provider.anthropicVersion || '2023-06-01';
  const body = { model: agent.model, max_tokens: agent.maxTokens || provider.maxTokens || 8192, messages: [{ role: 'user', content: prompt }], ...(system ? { system } : {}), ...(provider.request || {}), ...(agent.request || {}) };
  const { data, latencyMs } = await requestJson(url, { headers, body, timeoutMs: provider.timeoutMs || 180000, retries: provider.retries ?? 2 });
  const text = (data.content || []).filter((b) => b.type === 'text' || typeof b.text === 'string').map((b) => b.text || '').join('\n');
  if (!text) throw new Error(`Anthropic Messages adapter received no text output from ${agent.id}`);
  return { text, raw: data, usage: data.usage, latencyMs };
}

export async function probeAnthropicMessages({ provider }) {
  const url = joinUrl(provider.baseUrl, 'v1/models');
  const headers = authHeaders(provider, 'anthropic');
  headers['anthropic-version'] = provider.anthropicVersion || '2023-06-01';
  const { data, latencyMs } = await requestJson(url, { method: 'GET', headers, timeoutMs: Math.min(provider.timeoutMs || 30000, 30000), retries: 0 });
  return { ok: true, latencyMs, models: (data.data || []).map((m) => m.id).filter(Boolean).slice(0, 100) };
}
