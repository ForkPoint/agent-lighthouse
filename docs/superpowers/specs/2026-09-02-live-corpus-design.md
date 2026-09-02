# Live corpus: curated list, learned status, smoke tier

Date: 2026-09-02. Status: approved, awaiting implementation plan.

## Problem

`packages/core/test-data/sites/sites.json` holds 1913 domains. 132 are
hand-seeded across 8 categories; 1781 are `unknown`, taken blind from the
Tranco and CrUX top lists. A full pass over the list at concurrency 10 takes
hours, and most of that time is spent on hosts that are not websites: CDN and
ad hosts with no homepage, robots-blocked sites, and walled sites. Nothing
records the outcome, so every run pays for the same dead domains again.

The corpus exists as a regression net for the scanner: many real site shapes,
categorised, so a code change that breaks a verdict shows up. Scores are not
asserted; invariants and verdict stability are.

## Goals

- One full pass in about one hour on a laptop at concurrency 4.
- Every category has enough sites that one dead site does not empty it.
- Five new verticals: small business and local, platform tenants, travel,
  health, and agent-ready exemplar sites.
- The runner learns which domains are dead or blocked and skips them by
  default.
- A smoke tier that runs in about five minutes.

## Non-goals

- Score assertions on live sites. There is no ground truth for third-party
  sites; the runners assert invariants only, as today.
- Automatic pruning. The status file informs a human; it does not edit the
  list.
- CI writing the status file back. The nightly uploads its summary as an
  artifact; a person imports it when wanted.
- A representative sample of the web. The `unknown` slice is for breadth, not
  for statistics.

## Files

| File | Role |
| :-- | :-- |
| `packages/core/test-data/sites/seeds.json` | Hand-curated source of truth. Replaces `categories.json`. |
| `packages/core/test-data/sites/sites.json` | Generated and committed. Same entry shape as today plus optional `tier`. |
| `packages/core/test-data/sites/status.json` | Generated and committed. What each domain did the last time it was scanned. |
| `packages/core/test-data/sites/benchmark-stores.json` | Untouched. |

### `seeds.json`

```json
{
  "smoke": ["bbc.co.uk", "developer.mozilla.org"],
  "categories": {
    "news": {
      "why": "Large newsrooms: paywalls, AMP leftovers, heavy structured data.",
      "domains": ["bbc.co.uk", "theguardian.com"]
    }
  }
}
```

- `smoke` lists the smoke tier: two domains per category, each of which must
  also appear under its category.
- `why` is one sentence on what the category exercises. It is documentation,
  not data; nothing reads it.
- Domains are bare hostnames. The generator refuses anything else, as it does
  today.

### `sites.json`

Entry shape stays `{ domain, source, category, rankBucket }` with one optional
addition, `tier: "smoke"`. `source` is `seed`, `tranco` or `crux`. `category`
is one of the 13 category names or `unknown`. Sorted by domain, so a
regeneration diffs to real changes only.

### `status.json`

```json
{
  "updatedAt": "2026-09-02T18:00:00.000Z",
  "domains": {
    "a-msedge.net": {
      "state": "dead",
      "reason": "The homepage could not be fetched",
      "seenAt": "2026-09-02",
      "runs": 2
    }
  }
}
```

| `state` | Meaning |
| :-- | :-- |
| `ok` | The scan produced a score. |
| `unscored` | The scan ran and reported no score. `reason` is the scan's own `unscoredReason`. |
| `blocked` | `robots.txt` told the runner to stay away. |
| `dead` | No DNS, no connection, or no homepage, on two imports dated on different days. |

`runs` counts imports that reported this domain. `seenAt` is the date of the
latest one. A domain that is `dead` in one import and `ok` in the next goes
back to `ok`; state is the latest observation, and `dead` only needs two
observations to be entered.

## Categories and sizes

| Category | Target | What it exercises |
| :-- | --: | :-- |
| news | 25 | Paywalls, AMP leftovers, NewsArticle schema, huge sitemaps. |
| docs | 25 | Deep static sites, code blocks, llms.txt adopters. |
| saas | 25 | Marketing shells over apps, pricing pages, OpenAPI. |
| government | 25 | Old CMSes, PDFs, accessibility law, no commerce. |
| marketplace | 25 | Heaviest WAFs, product schema at scale. |
| forum | 25 | User content, robots policies, Discourse and Stack shapes. |
| bank | 25 | Walled, no crawl consent, security headers. |
| storefront | 25 | Shopify and Woo stores, product and offer schema. |
| local | 30 | Restaurants, clinics, agencies, hotels, law firms on page builders. |
| tenant | 30 | github.io, pages.dev, vercel.app, netlify.app, myshopify.com, wixsite.com, squarespace. The shared-suffix rules. |
| travel | 15 | Airlines, hotel chains, rail, booking flows. |
| health | 15 | Hospital systems, pharma, health information. |
| exemplar | 25 | Sites that serve `llms.txt`, `agents.json`, or an MCP or ACP manifest. Near-perfect results expected. |
| unknown | 50 | Top-ranked reachable sites not seeded anywhere. Breadth. |

About 365 domains. At 40 s per site and concurrency 4, one pass is about one
hour. The smoke tier is 26 domains, about five minutes.

Today's 132 seeded domains are kept unless the probe finds them dead.

## Runners

Both `scripts/test-live-sites.ts` and `scripts/scan-site-list.ts`:

- Read `status.json`. Domains in state `dead` or `blocked` are left out of
  the selection by default. `--include-dead` and `--include-blocked` put them
  back. A missing `status.json` means nothing is excluded.
- `--tier=smoke` selects the smoke tier only. It combines with `--category`
  and `--domains` as an intersection.
- `--stratified` samples evenly across all 13 categories plus `unknown`.

The nightly window grows from 200 to the whole list. 365 sites at 63 s over
two workers is about 190 minutes, inside the script's 240-minute deadline.
CI's `--limit=0` smoke stays as it is.

## Status tooling

`scripts/corpus-status.ts` with two commands:

- `import <summary.json>`: reads a runner summary, either format, and merges
  it into `status.json`. Maps each outcome to a state: a score to `ok`; a
  robots skip to `blocked`; an `unscoredReason` that names DNS, connection or
  a missing homepage to `dead`, else to `unscored`. Applies the two-import
  rule for `dead`. Rewrites `updatedAt`.
- `report`: prints domains grouped by state and, within `unscored` and `dead`,
  by reason, with `seenAt` and `runs`. This is what a person reads before
  editing `seeds.json`.

The mapping from a summary outcome to a state lives in
`packages/core/src/tests/corpus-status.ts` so it can be unit-tested without a
file. The script is flags and file I/O only, like `build-site-list.ts`.

## Generator

`scripts/build-site-list.ts`:

- Reads `seeds.json` instead of `categories.json`. Every seeded domain enters
  as `source: "seed"` with its category; smoke domains get `tier: "smoke"`.
- Reads `status.json` if present and builds an exclusion set of `dead` and
  `blocked` domains.
- Adds a ranked slice from Tranco and CrUX, default 50, of domains that are
  neither seeded nor excluded. `--limit` names the slice size, not the total.
- `buildSiteList` in `packages/core/src/tests/site-list.ts` gains an `exclude`
  parameter, a set of hostnames it never emits.
- A seeded domain that is `dead` in `status.json` is still emitted, and the
  generator prints it as a warning. Removing it is a human decision made in
  `seeds.json`.

## Curation

Before the list is regenerated:

1. Candidate domains are drafted per category, aiming above the target so
   probe losses leave the target met.
2. `scripts/probe-corpus.ts` fetches each candidate's homepage once, with the
   scanner user agent, and records status and final URL. For `exemplar`
   candidates it also fetches `/llms.txt`, `/.well-known/agents.json` and
   `/.well-known/mcp.json`, and keeps the domain only if at least one answers
   200.
3. Domains that do not answer 200 are dropped from the draft. The probe result
   is imported into `status.json` as the first observation.
4. `seeds.json` is written from what survived. Categories that end below
   target are noted in the PR, not padded with guesses.

## Tests

`packages/core/src/tests/site-list.test.ts`:

- Size bound becomes 250 to 500.
- Every category in `sites.json` other than `unknown` has at least 10 domains.
- Every smoke-tier domain is a seed and each category has exactly 2.
- No domain in `sites.json` is `dead` in `status.json`, except seeds, which
  the generator warns about.
- Existing checks stay: bare hostnames, no duplicates, both ranked sources,
  seed rank ordering, sorted by domain.

`packages/core/src/tests/corpus-status.test.ts`:

- Outcome-to-state mapping for each of the four states.
- Import merges with an existing file and increments `runs`.
- `dead` needs two imports on different days; one is `unscored`.
- An `ok` after a `dead` returns the domain to `ok`.
- Report groups by state and reason.

`scripts/probe-corpus.ts` and the two runners are not unit-tested; they fetch.
CI's `--limit=0` keeps them loading.

## Documentation

- `docs/evidence/corpus.md`: the nightly section says the window is the whole
  list, names `status.json`, and points to `corpus-status.ts report`.
- `scripts/test-live-sites.ts --help` lists `--tier`, `--include-dead` and
  `--include-blocked`.
- One `patch` changeset. Scan output is unchanged; only test data and scripts
  move.

## Decisions taken

- Curated list over filtered big list: the big list had no consumer that
  wanted breadth over speed.
- One status file over per-runner memory: both runners see the same facts.
- Two-import death rule: a single failed night must not remove a site.
- `unknown` keeps its name: honest, and no consumer needs to change.
- Seeds that go dead stay listed with a warning: removal is a curation
  decision, and the file that records it is `seeds.json`.
