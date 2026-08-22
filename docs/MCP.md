# MCP interoperability

Universal Gauntlet does not require MCP to remain universal: MCP-capable agents can invoke the `gauntlet` CLI through their approved terminal/tool layer, and Gauntlet can invoke MCP-capable coding CLIs through the command adapter.

The MCP protocol evolves independently of this runtime. Rather than embedding a stale protocol implementation, any direct MCP server bridge should use the current official MCP SDK and expose the stable Gauntlet CLI operations (`providers`, `doctor`, `invoke`, `run`, `render`) as tools. This keeps the core transport-neutral and avoids coupling model orchestration to a protocol revision.
