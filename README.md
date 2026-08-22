# Universal Gauntlet Runtime

**One adversarial engineering loop for local and cloud LLMs, APIs, coding CLIs, terminal agents, and browser-tested WebUIs.**

Universal Gauntlet separates the quality-control method from the model that executes it. Builders and critics can come from different companies or runtimes while sharing one fail-closed evidence loop:

`BUILD → VERIFY → EVIDENCE → INDEPENDENT CRITIC → REVISE → FINAL ADVERSARIAL REVIEW`

It is intentionally provider-neutral. A model can participate through a supported HTTP protocol, a coding CLI, or a custom command adapter. The runtime does not require the builder and critic to use the same vendor.

## Supported integration families

- **OpenAI Responses-compatible:** OpenAI, xAI/Grok, Abacus RouteLLM Responses, LM Studio, Ollama, AWS Bedrock Mantle, Azure OpenAI (with endpoint/header configuration), and other compatible gateways.
- **OpenAI Chat-compatible:** Mistral, OpenRouter, Abacus RouteLLM Chat, vLLM, llama.cpp, and compatible servers.
- **Anthropic Messages-compatible:** Anthropic, Abacus RouteLLM Messages, LM Studio, Ollama, and compatible gateways.
- **Native Gemini:** Google Gemini `generateContent`.
- **Terminal/coding agents:** Claude Code, Codex, Grok Build, Abacus AI CLI, plus arbitrary explicitly configured commands.

Compatibility is capability-based rather than brand-based. Version-sensitive CLI presets can be overridden in config.

## Three execution modes

- `workspace` — a coding CLI works directly in the checked-out Git workspace. The runtime forbids a builder-created commit by detecting any HEAD change.
- `patch` — an API/local model returns a unified diff. Gauntlet validates paths and applies it with `git apply --check` before modification.
- `advisory` — no repository mutation; intended for architects and evidence-only critics.

This is what makes ordinary API models first-class builders rather than limiting the loop to coding agents.

## Quick start

```bash
npm install
npm test
cp config/gauntlet.example.json config/gauntlet.json
export OPENAI_API_KEY=...
gauntlet doctor
gauntlet run --task "Implement the requested change"
```

For WebUI evidence:

```bash
npx playwright install chromium
gauntlet run --config examples/webui.json --target-url http://127.0.0.1:3000
```

## Provider examples

See `examples/` for:

- Claude Code builder + GPT critic;
- fully local LM Studio + Ollama;
- Abacus RouteLLM + Grok;
- Codex + Claude visual critic for WebUI work.

Run `gauntlet providers` to inspect built-in presets and `gauntlet doctor` to probe configured agents before a run.

## Custom compatible endpoint

You do not need a named preset:

```json
{
  "type": "openai-responses",
  "baseUrl": "http://127.0.0.1:9000/v1",
  "apiKeyEnv": "MY_LLM_KEY"
}
```

Available adapter types are `openai-responses`, `openai-chat`, `anthropic-messages`, `gemini-generate-content`, and `command`.

## Safety model

Universal execution must not mean unlimited authority.

- Secrets are referenced by environment-variable name, never embedded in config.
- Command agents use `spawn(..., shell:false)`; Gauntlet does not execute model-generated shell strings.
- Patch builders are path-validated and blocked from `.git`, credentials, keys, and configured protected paths.
- Workspace builders may edit files but may not create commits; HEAD changes fail the round.
- Existing dirty workspaces are rejected by default.
- Critics are independent from builders by default.
- Missing required verification is failure, not a silent PASS.
- WebUI PASS requires real Chromium evidence when WebUI verification is enabled.

Read `docs/SECURITY.md` before enabling highly autonomous terminal agents.

## WebUI Gauntlet profile

The original WebUI workflow is preserved as a profile, not hard-coded into the core. Playwright captures real screenshots plus console errors, page errors, failed network requests, horizontal overflow, keyboard focus evidence, basic accessibility heuristics, and performance data. Required route × viewport evidence is fail-closed.

## Files for agent ecosystems

- `AGENTS.md` — shared coding-agent instructions.
- `CLAUDE.md` — Claude Code entry point.
- `.github/copilot-instructions.md` — GitHub Copilot instructions.
- `.agents/skills/universal-gauntlet/SKILL.md` — cross-agent skill layout.
- `skills/universal-gauntlet/SKILL.md` — reusable source skill.

## Architecture

See `docs/ARCHITECTURE.md` and `docs/PROVIDERS.md`.

## Status

`1.0.0` is the initial provider-neutral runtime. The repository includes unit, adapter, patch-safety, orchestrator, and browser smoke tests plus GitHub Actions CI.

## Attribution and legal boundary

The implementation is newly written. The Gauntlet method is an adaptation of publicly described builder/critic and evidence-loop ideas associated with Matt Shumer and related open implementations. Reference applications are quality bars, not code or asset sources. See `NOTICE.md`.

## License

MIT.
