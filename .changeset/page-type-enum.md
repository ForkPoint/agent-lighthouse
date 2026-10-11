---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse": minor
---

Export every string union in the public types as an enum-style constant, so code can name a value instead of repeating a magic string: `PageType`, `PageTypeSource`, `ClassificationConfidence`, `CheckStatus`, `CheckPriority`, `FixEffort`, `ScoreDisplayMode`, `EvidenceGrade`, `AuditTier`, `EvidenceKey`, `ScoreTier`, `FieldStatus`, `CoverageProvenance`, `AttemptOutcome`, `PhaseId`, `LogLevel`, `PresetName`, `HttpMethod`, `AuditOutcome` and `WafProvider` (for example `CheckStatus.Pass`, `PageType.Product`). `OUTPUT_FORMATS` lists the report formats a config file accepts, with the `OutputFormat` type. `PAGE_TYPES` lists every page type. Each type keeps its name and its string values, so code that passes plain strings such as `"pass"` or `"product"` still type-checks. The Zod schemas now read their allowed values from these constants, so a type and its schema cannot drift apart. `AuditMetaSchema` now validates `applicablePageTypes` and `pageTypes` against the page-type enum instead of accepting any string.
