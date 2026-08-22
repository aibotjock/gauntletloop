export const providerPresets = {
  openai: { type: 'openai-responses', baseUrl: 'https://api.openai.com/v1', apiKeyEnv: 'OPENAI_API_KEY' },
  anthropic: { type: 'anthropic-messages', baseUrl: 'https://api.anthropic.com', apiKeyEnv: 'ANTHROPIC_API_KEY', anthropicVersion: '2023-06-01' },
  xai: { type: 'openai-responses', baseUrl: 'https://api.x.ai/v1', apiKeyEnv: 'XAI_API_KEY' },
  gemini: { type: 'gemini-generate-content', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKeyEnv: 'GEMINI_API_KEY' },
  mistral: { type: 'openai-chat', baseUrl: 'https://api.mistral.ai/v1', apiKeyEnv: 'MISTRAL_API_KEY' },
  abacus: { type: 'openai-chat', baseUrl: 'https://routellm.abacus.ai/v1', apiKeyEnv: 'ABACUS_API_KEY' },
  'abacus-responses': { type: 'openai-responses', baseUrl: 'https://routellm.abacus.ai/v1', apiKeyEnv: 'ABACUS_API_KEY' },
  'abacus-anthropic': { type: 'anthropic-messages', baseUrl: 'https://routellm.abacus.ai', apiKeyEnv: 'ABACUS_API_KEY', authMode: 'bearer', anthropicVersion: '2023-06-01' },
  'azure-openai': { type: 'openai-responses', baseUrlEnv: 'AZURE_OPENAI_BASE_URL', apiKeyEnv: 'AZURE_OPENAI_API_KEY', authMode: 'header', authHeaderName: 'api-key', probe: false },
  bedrock: { type: 'openai-responses', baseUrlEnv: 'BEDROCK_OPENAI_BASE_URL', apiKeyEnv: 'BEDROCK_API_KEY', probe: false },
  openrouter: { type: 'openai-chat', baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnv: 'OPENROUTER_API_KEY' },
  lmstudio: { type: 'openai-responses', baseUrl: 'http://127.0.0.1:1234/v1' },
  'lmstudio-anthropic': { type: 'anthropic-messages', baseUrl: 'http://127.0.0.1:1234', authMode: 'none', anthropicVersion: '2023-06-01' },
  ollama: { type: 'openai-responses', baseUrl: 'http://127.0.0.1:11434/v1' },
  'ollama-anthropic': { type: 'anthropic-messages', baseUrl: 'http://127.0.0.1:11434', authMode: 'none', anthropicVersion: '2023-06-01' },
  vllm: { type: 'openai-chat', baseUrl: 'http://127.0.0.1:8000/v1' },
  llamacpp: { type: 'openai-chat', baseUrl: 'http://127.0.0.1:8080/v1' }
};

export const commandPresets = {
  'claude-code': { type:'command', command:'claude', args:['-p','{prompt}','--output-format','json','--permission-mode','acceptEdits','--model','{model}'], parser:'json-auto', probeArgs:['--version'], envPass:['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL'], timeoutMs:900000 },
  codex: { type:'command', command:'codex', args:['exec','--full-auto','--model','{model}','{prompt}'], parser:'text', probeArgs:['--version'], envPass:['OPENAI_API_KEY','CODEX_API_KEY','OPENAI_BASE_URL'], timeoutMs:900000 },
  'grok-build': { type:'command', command:'grok', args:['-p','{prompt}','-m','{model}'], parser:'text', probeArgs:['--version'], envPass:['XAI_API_KEY'], timeoutMs:900000 },
  abacusai: { type:'command', command:'abacusai', args:['-p','{prompt}'], parser:'text', probeArgs:['--help'], envPass:['ABACUS_API_KEY'], timeoutMs:900000 }
};

export function materializeProvider(provider) { const presetName=provider.preset; const preset=presetName?(providerPresets[presetName]||commandPresets[presetName]):undefined; if(presetName&&!preset)throw new Error(`Unknown provider preset: ${presetName}`); return{...(preset||{}),...provider}; }
