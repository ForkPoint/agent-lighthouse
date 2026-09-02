---
"@forkpoint/agent-lighthouse-core": major
---

The overall score weights each category by the mass it assessed. `runAudits` now sets `assessedMass` and `registryMass` on every category it builds, so `calculateOverallScore` no longer falls back to registry mass on every scan. A category that could assess little of its registry moves the overall score by what it assessed, as `conditions.coverage` already reported. Overall scores change on any site where a category's assessed mass differs from its registry mass, which is most sites.
