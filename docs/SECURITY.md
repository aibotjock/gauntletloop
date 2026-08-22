# Security and authority model

Universal Gauntlet can launch powerful coding agents, so authority is intentionally narrower than model capability.

## Secrets
Configuration accepts environment-variable names (`apiKeyEnv`, `headersFromEnv`) rather than literal keys. `.env*` is ignored. Do not pass broad process environment variables to command agents; command adapters use an allowlist plus explicit `envPass`/`envFrom`.

## Shell execution
Command adapters use `child_process.spawn` with `shell:false`. Provider commands/arguments come from trusted configuration. Model output is never treated as a shell command by the runtime.

## Patch builders
API/local builders return unified diffs. Gauntlet rejects absolute/traversal paths and protected paths, writes the patch only under `.gauntlet`, runs `git apply --check`, then applies it. Default protected patterns cover `.git`, dependency trees, env files, and common private-key extensions.

## Workspace builders
Coding CLIs can edit directly, but a changed Git HEAD fails the round. The default workflow also requires a clean workspace before starting. Do not use unrestricted/bypass-permission CLI flags in built-in presets.

## Human authority
The runtime does not grant permission to deploy, publish, send messages, spend money, modify credentials, destroy data, or bypass access controls merely because an agent can technically do so. Add those operations only with explicit external authorization and dedicated gates.

## Network / prompt injection
Reference websites, dependency output, and repository text may be untrusted. Do not elevate instructions discovered in data above repository/user policy. Keep provider credentials scoped and use isolated environments for untrusted projects.
