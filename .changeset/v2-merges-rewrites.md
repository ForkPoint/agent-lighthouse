---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

v2 merge wave: the registry lands at 148 audits, and every one the evidence
review flagged for rework was rewritten against its evidence dossier.

**Breaking: the registry is 148 audits, down from 181.** The v2 taxonomy note
described 181 v1 ids carried forward; carrying them forward is not the same as
keeping 181 separate checks. 57 of those ids resolve onto just 24 v2 audits —
33 fewer checks than ids — so the shipped registry is:

| category | audits |
| --- | ---: |
| `access-crawl-control` | 29 |
| `answer-readiness` | 26 |
| `operability-safety` | 24 |
| `content-extraction` | 21 |
| `machine-discovery` | 16 |
| `agent-interfaces` | 16 |
| `structured-data` | 13 |
| `agentic-commerce` | 3 |
| | **148** |

The collapse is 2 consolidations and 22 merge folds, plus 2 splits that move a
signal rather than remove one (one of the two splits, `webmcp-tool-naming`, is
already counted among the 22 folds — its id stops emitting):

- **2 consolidations** — 5 per-bot audits (`bytespider`, `cohere-ai`, `youbot`,
  `diffbot`, `ai2bot`) become one `access-crawl-control/ai-bot-directives`, and
  4 header audits (`hsts-header`, `csp-header`, `content-type-options`,
  `security-txt`) become one `operability-safety/security-header-hygiene`.
  Both are new ids that no v1 audit owned.
- **22 merge folds** — a signal moves into an existing audit and its own id
  stops emitting: `no-noindex` and `meta-robots` into
  `access-crawl-control/robots-directives`, `og-site-name` and `twitter-card`
  into `answer-readiness/core-open-graph`, `fast-response-time` into
  `content-extraction/server-responsiveness`, `cache-headers` into
  `machine-discovery/ai-file-delivery`, and so on.
- **2 splits** — `structured-data/service-schema` keeps the Service half and
  hands the Product half to `structured-data/advanced-product-details`;
  `webmcp-tool-naming` hands its naming rule to
  `agent-interfaces/openapi-operation-ids` and defers its runtime half out of
  v2.0.

A dashboard keyed on a folded id must re-point at the merge target, and several
old series now share one new one. Look every id up in the shipped map rather
than guessing.

**Breaking: `migration-map.json` is all-`renamed`.** The interim `merging`
status and its `interim` field are gone: every surviving v1 id now carries
`status: "renamed"` and a `to` that is registered and running in this release.
Consumers read `to` directly.

```js
import map from '@forkpoint/agent-lighthouse-core/migration-map.json';

const v2IdFor = (v1Id) => {
  const e = map[v1Id];
  if (!e || e.status === 'removed') return null; // gone, drop the series
  return e.to;                                   // live in this release
};
```

The census is unchanged — 207 v1 ids, 26 `removed`, 181 `renamed` — but those
181 point at only 148 distinct v2 ids.

**Breaking: every remaining audit was rewritten to evidence-backed pass
conditions.** A v1 audit passed when a pattern matched; a v2 audit passes when
the dossier says the agent-visible signal is actually present. Pass conditions,
thresholds, `na` handling and priorities all moved, so **the same site will
score differently on the same audit id**. There are no holdovers: the last six
— `agent-interfaces/webmcp-registered-tools`,
`access-crawl-control/ai-content-declaration`, `access-crawl-control/tdm-rep`,
`operability-safety/form-error-messages`, `answer-readiness/direct-definitions`
and `agent-interfaces/cors-api-routes` — were rewritten too, and four of them
changed shape enough to be worth calling out:

- `agent-interfaces/webmcp-registered-tools` no longer reads
  `/.well-known/webmcp`, an invented path with no spec and no IANA
  registration; it reports tools registered at runtime through
  `navigator.modelContext` and returns `na` when it cannot see any, since it
  has no JavaScript runtime. A guaranteed high-priority zero on nearly every
  site becomes `na`. The exported class is renamed `WebmcpManifestAudit` →
  `WebmcpRegisteredToolsAudit`, and `/.well-known/webmcp` is dropped from the
  root-file fetch list, so scans issue one fewer request.
- `access-crawl-control/ai-content-declaration` stops demanding a meta tag that
  does not exist and stops claiming GPTBot and ClaudeBot read it. It passes on
  an AIPREF `Content-Usage` header or robots.txt rule, warns on
  `noai`/`noimageai` with the "no documented consumer" caveat, and is `na`
  otherwise.
- `access-crawl-control/tdm-rep` reports `tdm-reservation` 1 (rights reserved)
  and 0 (mining permitted) as distinct outcomes rather than one shared pass,
  validates the well-known file against the spec's array-of-objects shape
  behind a content-type and leading-`<` guard, reads the `tdm-reservation`
  response header, and returns `na` when nothing is declared instead of a
  `warn` on nearly every scan (the audit is weight 0, so no score moved).
  `audit()` is now synchronous.
- `agent-interfaces/cors-api-routes` probes the endpoints the OpenAPI document
  declares (`servers[].url` plus concrete paths, `isSafeUrl()`-gated) instead of
  a hardcoded `/api/`, requires an `Access-Control-Allow-Origin` that admits a
  third-party origin, and is `na` for any site that publishes no OpenAPI
  document.

`operability-safety/form-error-messages` and `answer-readiness/direct-definitions`
moved too — see the list below.

The changes that move the most results:

- `access-crawl-control/robots-directives` now warns on `nosnippet`,
  `noarchive` and `max-snippet:0` — no v1 audit did. Sites with a deliberate
  AI-snippet policy will see a new warn.
- `access-crawl-control/sensitive-paths` fails, instead of warning, when the
  crawl observed low-value URL families (cart, checkout, search, login,
  account, admin) and none of them is disallowed for AI crawlers — including
  when no `robots.txt` is served at all; warning would have scored deleting the
  file above shipping an empty one. A site whose crawl surfaced no such family
  returns `na` before `robots.txt` is read, so a missing file alone never
  fails this audit.
- `answer-readiness/dates-on-content` warns on publication-only dates that
  claim to be current, and `answer-readiness/review-signals` warns when review
  counts come from a third-party widget rather than markup.
- `agent-interfaces/openapi-exists` returns `na` (not `fail`) when a site
  exposes no API surface at all, and ships informative at weight 0 until a
  documented consumer exists. `agent-interfaces/ai-catalog-metadata` and
  `ai-catalog-urls` return `na` when there is no manifest, which removes two
  guaranteed zeros from every no-catalog scan and raises `agent-interfaces`
  scores accordingly.
- `content-extraction/server-responsiveness` scores TTFB on pinned 800 ms /
  2500 ms bands, absorbing the old `fast-response-time` signal.
- `content-extraction/aside-element` goes from a binary to a three-state
  result, and `operability-safety/security-header-hygiene` never returns
  `fail` — it is informative at weight 0 by design.
- `operability-safety/form-error-messages` stops passing a whole site on one
  input carrying `aria-describedby`. It reports coverage as a ratio over the
  fields the server rendered as `aria-invalid`, or — the normal case on a GET —
  over the required fields, accepts `aria-errormessage` on equal terms, counts
  fields outside a `<form>`, and is `na` when nothing declares a constraint. A
  site with one wired input among many now warns; a site using
  `aria-invalid` + `aria-errormessage` now passes instead of being warned.
- `answer-readiness/direct-definitions` drops its bold-colon branch, which
  every `<strong>Note:</strong>` satisfied, gates on definitional intent
  detected structurally and in eleven languages, counts CJK definitions
  correctly, and reports prose definitions instead of failing them. It never
  returns `fail`.

**Breaking: `_a11y.ts` is gone, split into 17 per-rule audit files.** The
accessibility rules were a single module behind a shared base class; each rule
is now its own file under `operability-safety/` with its own dossier, and the
exported audit classes lost their `A11y` prefix (`A11yLandmarkUniqueAudit` →
`LandmarkUniqueAudit`, and so on). Audit ids and metadata are unchanged — only
importers of the class symbols are affected.

Every id, every fold and the reasoning behind each one is in the audit-by-audit
table at
[docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md);
the per-audit evidence, grades and sources are in
[docs/evidence/audits/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/README.md);
the upgrade guide is
[MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md).
