---
"@forkpoint/agent-lighthouse-core": patch
"@forkpoint/agent-lighthouse": patch
---

Code hygiene and linter zero-warning hardening:
- Configured `.oxlintrc.json` with ignore pattern for `.astro` templates (which are compiled and verified by `astro check`).
- Resolved all unsafe optional chaining operations, redundant fallbacks in object spreads, and regex character escapes across core audits and test suites.
- Removed unused imports and eliminated all compiler warnings in `content.config.ts`.
- Brought `pnpm lint` and `pnpm typecheck` to 0 errors, 0 warnings, and 0 hints across the entire codebase.
