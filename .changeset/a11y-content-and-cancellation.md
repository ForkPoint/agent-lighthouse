---
"@forkpoint/agent-lighthouse-core": patch
---

Preserve page content after style end tags containing HTML whitespace, a slash or attributes, such as `</style >`, `</style/>` and `</style x>`. Accessibility and text extraction now read the following markup instead of losing it to a later style block.

Stop canceled accessibility jobs before DOM construction. The HTTP scan passes its caller/budget signal and snapshot assessment passes its caller signal to the queue. Canceled waiters release their place and listeners, and the runner permits cancellation between pages. Synchronous analysis already in progress remains non-preemptible.
