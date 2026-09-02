---
"@forkpoint/agent-lighthouse-core": patch
---

A failed fetch logs one warning line instead of the error object with its stack. The object is still there at `LOG_LEVEL=debug`. A scan of a walled site no longer prints a screen of frames per request.
