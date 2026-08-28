---
'@forkpoint/agent-lighthouse-core': major
---

36 audits no longer congratulate a site the scan never read.

`ctx.pages` was never "this site's pages". The orchestrator admits any response
that answered 200 with a body — no content-type gate, no attribution check — so
a domain broker's parking page reached through a temporary redirect, and a PDF
served at the homepage, both arrive as a `PageContext` an audit reads as though
the site had written it. `ctx.rootFiles` is the same: a parking host answers
every path, so `/robots.txt` and `/llms-full.txt` come back 200 and belong to
the broker. On a walled or throttled origin there is nothing at all, and an
audit looping an empty list found no fault and passed.

Every one of the 36 already named `origin-reachable` in its `requires`. They now
read that decision instead of assuming it went their way: `scan-evidence` gains
`scanReadTheSite()` and `unreadSiteReason()`, and each audit returns
`notApplicable` with the gate's reason attached rather than a verdict about
somebody else's page.

Affected: `access-crawl-control/no-nofollow`, `no-redirect-chains`,
`no-blanket-block`, `crawl-delay`, `robots-directives`, `no-bot-detection`,
`https-enabled`, `robots-ai-group-shadowing`;
`content-extraction/server-responsiveness`, `language-attribute`, `single-h1`,
`main-element`, `article-element`, `header-footer`, `data-tables`,
`content-depth`, `figure-figcaption`, `token-ratio`, `fake-headings`,
`server-rendered`, `css-hidden-ghost-content`, `preamble-tax`,
`extraction-determinism`; `machine-discovery/llms-full-txt`, `rss-feed`;
`answer-readiness/unique-meta`, `content-without-clickthrough`,
`descriptive-urls`, `snippet-gate-coverage`, `extractor-survival-recall`;
`operability-safety/no-blocking-captcha`, `invisible-instruction-scan`,
`aria-layer-injection-scan`, `unicode-covert-channel-scan`,
`third-party-dom-write-blast-radius`, `unsafe-agent-triggerable-affordances`.

Where the missing response is itself the finding the verdict is unchanged:
`no-blocking-captcha` and `no-bot-detection` still fail a scan the site walled,
and `server-responsiveness` still reports that it could not measure one.

A new registry-driven suite, `hostile-state-contract.test.ts`, runs every
registered audit against four scan states that obtained nothing — blocked,
throttled, redirected away, non-HTML — and forbids `pass`. It is what found
these. Its exemption allowlist is empty.
