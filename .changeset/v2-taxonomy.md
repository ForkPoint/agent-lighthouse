---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": major
"@forkpoint/agent-lighthouse": major
"@forkpoint/agent-lighthouse-mcp": major
---

v2 taxonomy: 8 agent-journey categories, `category/slug` ids, 8 more sunsets.

**Breaking: the 10 v1 categories are replaced by 8 built around what an agent
actually does with a site.** Gone: `content-discoverability`,
`crawler-permissions`, `meta-tags`, `semantic-html`, `technical-readiness`,
`answer-engine`, `generative-engine`, `agent-tools`, `accessibility`,
`structured-data` as v1 defined it. In their place:

| category | what it answers |
| --- | --- |
| `access-crawl-control` | can an agent reach the site at all |
| `content-extraction` | can it get clean content out of a page |
| `machine-discovery` | can it find the machine-readable surfaces |
| `structured-data` | is the meaning explicit rather than inferred |
| `answer-readiness` | is a page answerable without the rest of the site |
| `agent-interfaces` | is there something an agent can call |
| `agentic-commerce` | can an agent transact |
| `operability-safety` | is the site safe and stable to operate against |

Membership changed with the names: an audit keeping its slug did not
necessarily keep its home (`technical-readiness/fast-response-time` is scored
under `content-extraction`, `structured-data/website-search-action` under
`agent-interfaces`). Category scores are not comparable across the major.

**Breaking: numeric ids are gone.** v1 identified audits by a `major.minor`
number whose major half encoded the old taxonomy. `CheckResult.id` is now a
`category/slug` path — `machine-discovery/llms-txt-exists` — validated by
`AUDIT_ID_PATTERN`. Nothing in a v2 report, CLI output or MCP payload carries a
numeric id, and `--debug-audit` takes a slug id.

**Translate v1 ids with the shipped map.**
`@forkpoint/agent-lighthouse-core/migration-map.json` is keyed by v1 numeric id
and carries all 207 of them: 147 `renamed` (one-for-one, use `to`), 34 `merging`
(signal folds into another audit later, read `interim` today), 26 `removed`
(nothing to re-point at). Every surviving entry links its evidence dossier.

```js
import map from '@forkpoint/agent-lighthouse-core/migration-map.json';

const v2IdFor = (v1Id) => {
  const e = map[v1Id];
  if (!e || e.status === 'removed') return null; // gone, drop the series
  return e.interim ?? e.to;                      // what runs today
};
```

**Breaking: 8 more audits are removed as not-a-factor**, on top of the 18 sunset
in 1.0.0 — 26 v1 audits are now gone in total. The 2026-08-21 grading pass
graded these D (or, for `1.18` mobile-friendly, `unrated`), and the adversarial
evidence review could not name a consumer:

`1.18` mobile-friendly, `1.23` commerce-links, `7.22` marquee, `8.14`
no-render-blocking, `8.15` image-dimensions, `8.16` lcp-not-lazy, `8.19`
privacy-policy, `8.20` terms-of-service.

They no longer run, no longer appear in any report, and no longer emit a
`CheckResult`. Dashboards keyed on those ids need the series dropped. Rationale
and sources:
[docs/evidence/sunset/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/README.md).

**Breaking: `SECTION_GROUPS` is regrouped** onto the v2 categories. The three
group keys and labels are unchanged, but membership and the flattened
`CATEGORY_ORDER` every surface renders from are not — notably `structured-data`
now reports under **AI Search Optimization** rather than Technical Foundation:

- **Agentic Readiness** — `access-crawl-control`, `machine-discovery`,
  `agent-interfaces`, `agentic-commerce`
- **AI Search Optimization** — `content-extraction`, `structured-data`,
  `answer-readiness`
- **Technical Foundation** — `operability-safety`

Consumers pinning section membership or category ordering must be updated.

The full upgrade guide is
[MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md);
the audit-by-audit v1 → v2 table, with the reasoning behind every move, merge
and split, is in
[docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md).
