---
"@forkpoint/agent-lighthouse-core": major
---

`access-crawl-control/agent-governance` no longer fails a site whose
robots.txt names no AI agents but grants access through its catch-all group.

RFC 9309 §2.2.1 makes a crawler obey the group matching its own product token
and fall back to `*` only when no such group exists, so an open catch-all
already grants every named agent the full access that writing the groups out
would. The audit's own evidence recorded this and stated that the grade
"does not support the audit's pass criterion"; the rule now matches the
standard it cites.

The audit still fails a blanket block with no per-agent exceptions, which is
the one case the sources support: the fallback carries that block onto the
live retrieval agents as well.
