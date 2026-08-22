import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/core/config.mjs';
import { materializeProvider, providerPresets, commandPresets } from '../src/core/presets.mjs';

const valid = {
  version: 1,
  task: { objective: 'x' },
  providers: { a: { preset: 'openai' }, b: { preset: 'anthropic' } },
  agents: [
    { id:'builder', provider:'a', model:'m', mode:'patch', roles:['builder'] },
    { id:'critic', provider:'b', model:'m2', mode:'advisory', roles:['critic'] }
  ],
  workflow: { builder:'builder', critics:['critic'], maxRounds:3 }
};

test('valid provider-neutral config passes', () => assert.deepEqual(validateConfig(valid), []));
test('literal secrets are rejected', () => {
  const c = structuredClone(valid); c.providers.a.apiKey = 'secret';
  assert.match(validateConfig(c).join('\n'), /environment variables/);
});
test('independent critic is enforced', () => {
  const c = structuredClone(valid); c.agents[0].roles.push('critic'); c.workflow.critics=['builder'];
  assert.match(validateConfig(c).join('\n'), /builder cannot also be critic/);
});
test('presets cover API, local and coding CLI families', () => {
  for (const id of ['openai','anthropic','xai','gemini','abacus','azure-openai','bedrock','lmstudio','ollama','vllm','llamacpp']) assert.ok(providerPresets[id], id);
  for (const id of ['claude-code','codex','grok-build','abacusai']) assert.ok(commandPresets[id], id);
  assert.equal(materializeProvider({preset:'xai'}).type, 'openai-responses');
});
