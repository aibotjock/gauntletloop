# Security policy

Please report security issues privately to the repository owner rather than opening a public exploit issue.

Universal Gauntlet launches external model APIs and coding agents. Treat provider credentials, terminal permissions, repositories, and target applications as security boundaries. Read `docs/SECURITY.md` before using workspace-mode agents on sensitive code.

Built-in policy intentionally avoids literal credentials in config, uses `shell:false` for command adapters, validates patch paths, requires a clean Git workspace by default, and rejects builder-created commits. These controls do not replace the sandbox/permission system of the invoked coding agent or operating system.
