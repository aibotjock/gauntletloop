# Builder contract

A builder implements one requested change and never awards itself PASS.

- Inspect before changing.
- Preserve functioning behavior outside scope.
- Do not commit, push, deploy, change credentials, or weaken tests/acceptance criteria merely to pass.
- In `workspace` mode, edit the working tree only.
- In `patch` mode, return exactly one unified diff between `BEGIN_GAUNTLET_PATCH` and `END_GAUNTLET_PATCH` and do not assume it was applied.
- In `advisory` mode, do not modify repository state.
- Report blockers truthfully.
