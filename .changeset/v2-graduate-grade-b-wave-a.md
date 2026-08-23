---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

Plan 5b Wave A: 12 grade-B proposals graduate into `operability-safety`. The
registry grows from 172 to 184 audits.

Each carries evidence grade B — a documented consumer path, proved in its
dossier under `docs/evidence/audits/operability-safety/` — so each lands in the
scored tier at weight 0.6, except
`operability-safety/first-contact-consent-gate-operability`, which is
informative at weight 0: its honest finding is an action cost, not a defect.

New in this release:

- **Agent operability**: drag-and-slider-dependency,
  ghost-clickable-element-ratio, hover-only-content-and-navigation,
  stateful-control-introspectability,
  url-addressable-state-and-pagination-fallback,
  first-contact-consent-gate-operability
- **Injection safety**: agent-ua-content-divergence-diff,
  reflected-parameter-injection-canary, third-party-dom-write-blast-radius,
  ugc-trust-boundary-markers, unicode-covert-channel-scan,
  unsafe-agent-triggerable-affordances

`operability-safety` gains 6.6 evidence mass, so its share of the overall score
rises and every other category's share falls. A site that scored well on the
172-audit registry is not guaranteed the same number here. That is the intended
effect of adding proven checks, not a regression.

`operability-safety/reflected-parameter-injection-canary` sends at most five
read-only GET probes to the scanned origin, carrying a random per-scan canary
token, to find out whether a query parameter is reflected into the fields an AI
answer lifts verbatim. It never probes an authenticated path and never sends
anything but GET.

`operability-safety/agent-ua-content-divergence-diff` adds one request per
compared URL: an unrecognised control bot, so a reduced page served to every
unknown client is reported as bot management rather than as AI-crawler
branching. Its crawler-UA probes reuse the per-scan cache the
`access-crawl-control` audits already fill.
