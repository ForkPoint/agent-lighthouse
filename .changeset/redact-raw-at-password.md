---
"@forkpoint/agent-lighthouse-core": patch
---

Log redaction removes a URL password that contains a raw `@` in full. `https://user:p@ss@host/` was logged as `https://[redacted]@ss@host/`, leaking the rest of the password at debug level and in `--log-file` output.
