# Architecture

Universal Gauntlet is split into six boundaries:

1. **Core** — config, role/capability routing, rounds, critic voting, final adversarial review.
2. **Adapters** — translate one normalized invoke/probe contract into Responses, Chat, Messages, Gemini, or terminal commands.
3. **Mutation modes** — workspace, validated patch, advisory.
4. **Verification** — deterministic commands plus workload-specific evidence collectors.
5. **Profiles** — WebUI is the first profile and uses Chromium/Playwright; future API/security/research profiles can reuse the same core.
6. **Authority** — Git, secret, path, command, and human approval boundaries stay above model execution.

The normalized agent result is text + raw result + latency/usage metadata. The orchestrator never needs provider-specific response shapes.

## Provider neutrality

Presets are conveniences, not architectural dependencies. Any service implementing one supported protocol can be configured directly. New native protocols add one adapter and one mapping in `src/adapters/index.mjs`; core orchestration should not change.

## Evidence flow

Builder output → safe mutation → deterministic verification → evidence package → independent critic → corrections. A candidate that passes receives one additional final adversarial review. No evidence means no PASS.
