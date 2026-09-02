---
"@forkpoint/agent-lighthouse-core": minor
"agent-lighthouse-monorepo": patch
---

Hardened script typechecking, bot wall evidence gating, and API deprecation:
- Added `tsconfig.scripts.json` and integrated script typechecking into root `pnpm typecheck`.
- Corrected evidence requirements for `access-crawl-control/sensitive-paths` and `access-crawl-control/rsl-licensing-terms-conformance` to require `unblocked-fetches`, preventing false scored `fail` verdicts when a scan is blocked by a bot wall.
- Marked `MAX_CONCURRENT_REQUESTS` in `constants.ts` as `@deprecated`.
