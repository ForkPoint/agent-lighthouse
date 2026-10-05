# Contributing to Agent Lighthouse

Thank you for your interest in contributing to Agent Lighthouse! Whether you are a human developer or an AI agent pair programming on the codebase, we welcome your contributions.

Agent Lighthouse audits whether AI agents, LLM crawlers, MCP clients, and agentic browsers can discover, parse, cite, and act on a website.

---

## The First Law of Agent Lighthouse

Every check in this repository is governed by one rule:

> **An audit may only claim what a source documents.** If no vendor documents a consumer, the check does not affect a site's score. Ever.

When contributing audits or modifications, verify that every claim has verifiable documentation or ratified standards behind it.

For detailed contributor rules, audit architecture, and dossier requirements, read **[`AGENTS.md`](./AGENTS.md)**.

---

## Getting Started

### Prerequisites

- **Node.js**: v22.22.2+ (22.x), v24.15.0+ (24.x), or 26+
- **pnpm**: v10.34.6 (the version pinned in `package.json`)

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/agent-lighthouse.git
   cd agent-lighthouse
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

---

## Development Workflow

### Key Commands

```bash
pnpm build              # Build every package (packages/core, packages/cli, etc.)
pnpm test               # Run vitest across the repository
pnpm typecheck          # Run TypeScript checks across packages & scripts
pnpm lint               # Run oxlint across the repo
pnpm format             # Format files using Prettier
pnpm check:dossiers     # Verify audit registry <-> evidence dossier agreement
pnpm check:requires     # Verify audit `requires` matches what sources read
pnpm check:audit-map    # Verify audit map agreement
pnpm changeset          # Generate a changeset for user-visible changes
```

> **Note on Tests**:
> Some integration tests scan live sites. When working offline or on metered networks, you can skip live network scans by setting:
>
> ```bash
> export AL_SKIP_NETWORK=1
> pnpm test
> ```

---

## Contributing Audits

Every audit in Agent Lighthouse consists of three pieces that must strictly agree:

1. **The audit implementation**: `packages/core/src/audits/<category>/<slug>.ts`
2. **The test suite**: `packages/core/src/audits/<category>/<slug>.test.ts`
3. **The evidence dossier**: `docs/evidence/audits/<category>/<slug>.md`

See [`AGENTS.md`](./AGENTS.md) for full instructions on writing audits, weights, scoring tiers, and evidence dossiers.

---

## Changesets

Agent Lighthouse uses [@changesets/cli](https://github.com/changesets/changesets) for versioning and package releases.

If your pull request introduces any user-visible changes (features, bug fixes, audit weight/scoring changes, CLI options):

```bash
pnpm changeset
```

Follow the interactive prompts to select the affected package(s) and specify the semver bump type (`patch`, `minor`, `major`).

---

## Pre-Commit Verification

Before submitting a pull request, run the verification pipeline:

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint && pnpm check:dossiers && pnpm check:requires && pnpm check:audit-map
```

All checks must pass.

---

## Submitting a Pull Request

1. Create a feature branch: `git checkout -b feature/my-new-feature`.
2. Commit your changes with clear, descriptive commit messages.
3. Push your branch: `git push origin feature/my-new-feature`.
4. Open a pull request against the `main` branch.
5. Fill out the pull request template completely.

## Code of Conduct

All contributors are expected to uphold the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).

### Compiler and lint compatibility

The root workspace and the four public packages use TypeScript 7. `tsup` builds
JavaScript only; `tsc -p tsconfig.build.json` emits declaration files afterward.
The website alone aliases `typescript` to Microsoft's `@typescript/typescript6`
package for Astro's JavaScript compiler API. It uses `astro check` for type checks.
TypeScript 7 is pinned to a patch range (`~7.0.2`) because
`scripts/check-audit-boundaries.mjs` uses its `unstable` API, which a minor
release may change.

Oxlint keeps correctness and suspicious checks as errors. The migration removes
`no-return-await`, which upstream retired. It leaves the new array-copy,
function-placement, shadowing, and underscore-naming rules off to preserve the
previous style policy. Revisit those rules as a separate source-code change;
do not mix a repository-wide style rewrite into a tool version upgrade.
