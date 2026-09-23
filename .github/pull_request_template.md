## Description

Please include a summary of the changes and the problem or feature they address.

Fixes #(issue)

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature or audit (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature causing existing functionality or scoring to change)
- [ ] 📝 Documentation update
- [ ] 🧹 Refactor or internal chore

## Affected Packages

- [ ] `@forkpoint/agent-lighthouse` (CLI)
- [ ] `@forkpoint/agent-lighthouse-core`
- [ ] `@forkpoint/agent-lighthouse-report`
- [ ] `@forkpoint/agent-lighthouse-mcp`
- [ ] `packages/website`
- [ ] GitHub Action or root configuration

## Checklist

Before submitting this PR, please ensure all applicable steps have been completed:

- [ ] `pnpm build` completed successfully.
- [ ] `pnpm test` passed locally (`AL_SKIP_NETWORK=1 pnpm test` if offline).
- [ ] `pnpm typecheck` passed with no TypeScript errors.
- [ ] `pnpm lint` passed with oxlint.
- [ ] `pnpm check:dossiers` passed (for any audit addition or modification).
- [ ] `pnpm check:requires` passed (audit `requires` matches source reads).
- [ ] `pnpm check:audit-map` passed.
- [ ] `pnpm changeset` was run for user-visible changes (features, fixes, scoring alterations).
- [ ] Code follows the style guide and adheres to the Golden Rule: _An audit may only claim what a source documents_.
