---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/stateful-control-introspectability` no longer errors out on
a page whose controls each carry their own state class.

Its summary line named every distinct state class it found. That list comes
from the page, so a storefront whose components each declare their own class
pushed `displayValue` past the schema's 1000-character cap, and the runner
replaced the whole audit with a `scan-error` stub. The line now names three
classes and counts the rest.

Found on a live storefront. The audit-result contract fixture now gives every
element its own class name, so the same overflow fails in CI rather than on a
site.
