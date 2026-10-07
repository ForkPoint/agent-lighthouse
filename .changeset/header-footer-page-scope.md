---
"@forkpoint/agent-lighthouse-core": patch
---

Judge header and footer coverage across every selected page without treating
the first page as a homepage. Mixed coverage now warns in any page order, and
an empty sample returns not applicable. Findings name each affected URL and
its missing elements, with bounded text for large samples.

This is a scope correction in the 7.0.0 workstream. Audit identity, grade, tier,
weight and result mode remain unchanged. Landmark semantics remain a separate
follow-up in the applicability plan.
