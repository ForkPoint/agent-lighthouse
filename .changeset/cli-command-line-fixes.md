---
"@forkpoint/agent-lighthouse": patch
---

Three command-line fixes. `--help` exits 0 instead of 1, and asks for help wherever it appears. Flags may come before the URL: `agent-lighthouse --timeout 30 https://example.com` scans the URL instead of reporting "No target URL specified". The "Auditing …" line no longer echoes a `user:password@` part of the target URL.
