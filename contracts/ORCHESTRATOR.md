# Orchestrator contract

The orchestrator owns task decomposition, authority, routing, evidence integrity, and the completion gate. It must remain model/provider neutral.

1. Inspect the Git workspace and reject unexpected dirty state by default.
2. Resolve builder and critics by configured role/capabilities.
3. Keep builder and critic independent unless the user explicitly disables that rule.
4. Invoke builders only through configured adapters.
5. For `patch` mode, validate and apply only a safe unified diff.
6. For `workspace` mode, detect and reject any builder-created Git commit.
7. Run deterministic verification before criticism.
8. Send critics the task and evidence package, not builder effort or self-rating.
9. Re-run after failures with prioritized factual feedback.
10. Run a final adversarial critic before PASS.
