# WebUI profile

Enable `verification.webui.enabled` and supply `--target-url` (or `verification.webui.targetUrl`). Every required route and viewport is opened in real Chromium.

Evidence includes screenshots, console/page errors, failed requests, horizontal overflow, keyboard-focus observations, baseline semantic/accessibility heuristics, timing/performance data, and interaction-state screenshots. The verifier requires every configured route × required viewport base capture.

The built-in interaction DSL is intentionally constrained to deterministic actions: click, fill, press, waitForSelector, and bounded waitForTimeout. It does not execute arbitrary JavaScript from configuration.
