---
'@forkpoint/agent-lighthouse-core': minor
---

A bot wall served at HTTP 200 is treated as a wall, not as the site's own
markup. Four checks stop reporting a verdict about a Cloudflare challenge page,
and one starts reporting the wall.

**What was wrong.** The attribution guard 36 audits consult,
`scanReadTheSite()`, read `evidence.met['origin-reachable']` — "the response
came from the host the user asked for, with a 2xx and an HTML content type". A
Cloudflare managed challenge satisfies every part of that: it is served at HTTP
200, `text/html`, from the requested host. `origin-reachable` is true, the
interstitial arrives as a `PageContext`, and the audits read it as the owner's
page. `unblocked-fetches` is the key that knows better, and nothing consulted
it: `unblocked-fetches` is dropped from every `access-crawl-control` audit by
design, since being refused is what that category reports.

`scanReadTheSite()` now returns `evidence.judgeable` —
`origin-reachable && unblocked-fetches` — which is the predicate the scan
already used to decide whether to publish a score at all.

**Measured**, released 3.0.0 to this release, on a scan of a site behind a
Cloudflare managed challenge (HTTP 200, `text/html`, `cf-mitigated: challenge`,
requested host), with the evidence gate on as every scan runs it:

- **3 pass → na.** `no-blanket-block` (0.6), `crawl-delay` (informative) and
  `llms-full-txt` (informative) were reading the challenge page served at
  `/robots.txt` and `/llms-full.txt` and reporting what they found there as the
  site's.
- **1 na → fail.** `no-bot-detection` names the firewall. It could not before:
  its own gate exemption is what makes the wall branch reachable, and that
  branch now runs on a 200 wall as it does on a 403.
- **5 stay `na` and change their wording**, from the gate's "Not assessed: this
  scan has no … evidence" stub to the audit's own sentence naming the wall:
  `https-enabled`, `no-nofollow`, `no-redirect-chains`,
  `robots-ai-group-shadowing`, `robots-directives`.

The scan reports no overall score on that state before and after — `judgeable`
was already false there, and the gated evidence-mass share is 0.643 before and
0.599 after, both far past the 0.35 threshold. What changes is the checks
inside the categories: `access-crawl-control` moves 52 → 46 on that state.

Two verdicts this change specifically prevents, both measured on the same
state and neither ever released: `robots-directives` reporting **"1 content
page(s) carry a blocking robots directive, including the homepage"** at
critical priority, and `no-nofollow` reporting **"All 1 scanned page(s) have
nofollow directives"**. The `<meta name="robots" content="noindex,nofollow">`
they were reading is Cloudflare's, on the interstitial — the corpus fixtures
`stackoverflow-thread-wall` and `ebay-com-category-wall` both carry it. Those
two audits dropped `rendered-body` in this release, and `origin-reachable` was
all the protection they had left.

`operability-safety/ghost-clickable-element-ratio` gains the same guard. Its
survey counted the challenge page's one `role="main"` wrapper as a semantic
click target and passed the interstitial at a ratio of 1.00. No released
verdict moves — it declares every evidence key, so the gate already skipped it
there — and the guard is what makes it correct when it is called directly.

**How this is kept true.** `packages/core/src/tests/hostile-states.ts` gains a
sixth state: a Cloudflare managed challenge at HTTP 200 from the requested
host, with the WAF verdict derived from the real `detectWafProtection` rather
than stated. It joins the nothing-obtained tier, where no audit may return
`pass`. Written before the fix, it convicted 14 audits; 13 were fixed by the
predicate and the fourteenth by the guard above. The contract suite's exemption
allowlist is still empty.
