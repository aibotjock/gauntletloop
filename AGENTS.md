# AGENTS.md — Universal Gauntlet Runtime

This repository is the provider-neutral Gauntlet engine. Preserve vendor neutrality: core orchestration must never depend on one model company, SDK, CLI, or cloud.

## Required reading

1. `docs/ARCHITECTURE.md`
2. `docs/SECURITY.md`
3. `docs/PROVIDERS.md`
4. `contracts/ORCHESTRATOR.md`, `contracts/BUILDER.md`, `contracts/CRITIC.md`

## Non-negotiable rules

- Keep provider-specific behavior behind adapters/presets.
- Never claim a provider/model/tool was used unless it actually ran.
- Prefer independent builder and critic identities; do not expose builder self-evaluation to critics.
- Never award PASS when required tests/evidence are missing.
- `workspace` agents may edit but may not commit.
- `patch` agents must return a unified diff that passes path and `git apply --check` validation.
- Never place API keys in repository configuration.
- Never add `shell:true` to execute LLM-generated commands.
- WebUI visual claims require real browser rendering when enabled.
- Respect legal, licensing, security, privacy, and human-authorization boundaries.

Run `npm run validate` before completion. Run `npm run test:browser` for changes to browser evidence code.
