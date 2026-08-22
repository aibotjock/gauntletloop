# Adding an adapter

Implement `invoke({provider, agent, prompt, system, cwd})` and `probe({provider, agent, cwd})` in `src/adapters/`. Normalize invoke output to `{text, raw, usage?, latencyMs}`. Register the type in `src/adapters/index.mjs` and `PROVIDER_TYPES` in config validation. Add mock-server tests before adding a preset.

Prefer protocol-compatible adapters over vendor-specific code. A new vendor using an existing protocol usually needs only a preset.
