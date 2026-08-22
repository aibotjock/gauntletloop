# Providers and runtimes

Built-in presets are listed by `gauntlet providers`.

## HTTP protocols
- `openai-responses`: OpenAI and compatible Responses endpoints.
- `openai-chat`: OpenAI-style Chat Completions endpoints.
- `anthropic-messages`: Anthropic-style Messages endpoints.
- `gemini-generate-content`: native Google Gemini generateContent.

Named presets currently include OpenAI, Anthropic, xAI, Gemini, Mistral, Abacus RouteLLM (three protocol variants), OpenRouter, Azure OpenAI, AWS Bedrock Mantle, LM Studio, Ollama, vLLM, and llama.cpp.

For Azure set `AZURE_OPENAI_BASE_URL` to an endpoint ending in `/openai/v1` and `AZURE_OPENAI_API_KEY`. For Bedrock set `BEDROCK_OPENAI_BASE_URL` to the region-specific OpenAI-compatible `/v1` endpoint and `BEDROCK_API_KEY`.

## Command runtimes
Built-in command presets: Claude Code, Codex, Grok Build, Abacus AI CLI. Presets are deliberately editable because CLI flags evolve.

A custom command provider needs `command`, `args[]`, and optionally `parser`, `promptMode`, `envPass`, `envFrom`, and `timeoutMs`. Tokens `{prompt}`, `{model}`, `{workspace}`, and `{agent}` are interpolated into arguments without invoking a shell.

## Local-first examples
LM Studio, Ollama, vLLM, and llama.cpp can run without cloud credentials if their local server is reachable. Use distinct local models for builder and critic when possible to reduce correlated failure.

## Capability routing
Agents declare arbitrary capability strings such as `filesystem`, `terminal`, `vision`, `reasoning`, or `long-context`. Workflow requirements can select only agents satisfying the requested capability set.
