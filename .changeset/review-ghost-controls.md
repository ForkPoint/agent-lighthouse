---
"@forkpoint/agent-lighthouse-core": patch
---

Keep missing-role findings for decorative descendants and for inline handlers that stop propagation inside controls. An observing handler, such as an analytics call, stays part of its control. Roles resolve case-insensitively to the first recognized token, and gridcell and scrollbar wrappers count as holding a control.
