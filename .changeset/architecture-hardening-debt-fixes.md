---
"@forkpoint/agent-lighthouse-core": minor
---

Hardened CSS selector escaping in parser and operability audits, eliminated false positives/negatives in WAF bot wall detector, and added true offline safety for corpus tests:
- Exported and applied `escapeAttrValue` to prevent Cheerio syntax crashes when HTML attributes (such as form element IDs, `aria-controls`, `aria-describedby`, and `aria-labelledby`) contain quotes or backslashes.
- Fixed 3 WAF classifier defects: prevented `attack-challenge-mode` prose from falsely tripping Kasada, prevented normal PerimeterX telemetry scripts on 200 OK pages from falsely tripping PerimeterX blocks, and added Akamai HTTP 200 soft-block detection for reference-numbered error pages.
- Corrected corpus fixture kinds for `vercel-com-wall-200` (`page`), `walmart-com-wall-200` (`page`), and `tirerack-com-soft-block-200` (`wall`).
- Hermetically stubbed DNS in corpus test suites, guaranteeing offline test reproducibility under `AL_SKIP_NETWORK=1`.
- Resolved documented architectural debts in `docs/architecture/debt.md`.
