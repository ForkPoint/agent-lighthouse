---
"@forkpoint/agent-lighthouse-mcp": patch
---

The `agent-lighthouse-mcp` command starts again on macOS and Linux. The published file had no `#!/usr/bin/env node` line, so the shell ran it as a shell script and failed with `use strict: command not found`. The command also turns on source maps before the server loads, so stack traces and the `caller` field of log lines name the source file, such as `orchestrator.ts:815`, not the bundle.
