---
"@forkpoint/agent-lighthouse-core": patch
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
---

Widen the oxlint surface from `correctness` alone to `correctness` plus
`suspicious`, and add the `import` and `promise` plugins.

`.oxlintrc.json` previously declared nothing but an ignore pattern, so oxlint
ran its default set: the `correctness` category over the default plugins. The
config now names the plugin list explicitly — `eslint`, `typescript`,
`unicorn`, `oxc`, `import`, `promise` — enables `suspicious` as an error
category, and turns on three rules that the categories leave off:
`no-return-await`, `unicorn/no-unnecessary-await` and
`unicorn/prefer-regexp-test`. Rule count rises from 96 to 113.

The five findings the wider set surfaced are fixed, none of them behavioural:

- `agent-interfaces/openapi-servers`, `operability-safety/engine/dom` and
  `operability-safety/engine/table` each imported one module twice. The second
  import in the two engine files carried a comment calling itself lazy; an ESM
  import is hoisted either way, so the comment described something the module
  graph never did. Merged into the single import at the top.
- `getGaugeColor` in the HTML renderer was declared inside
  `generateHtmlReport` and captured nothing from it. Moved to module scope.
- `isValidUrl` in the CLI constructed a `URL` purely for its throw. The
  construction is now `void`-marked so the intent reads as a parse probe.
- `metaRefresh` in the a11y engine called `String#match` on a non-global regex
  and used only its truthiness. Now `RegExp#test`.

`pnpm lint` stays at 0 errors and 0 warnings.

`promise/prefer-await-to-then` was evaluated and left off: its 16 hits are
almost all top-level `main().catch()` entry points, where `then`/`catch` is the
correct shape. `import/no-cycle` was also left off; the a11y engine has 7
deliberate cycles that need untangling before the rule can be an error.
