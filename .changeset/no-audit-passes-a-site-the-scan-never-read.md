---
'@forkpoint/agent-lighthouse-core': major
---

Audits no longer report a verdict about a response the scan cannot attribute to
the site, and four audits whose subject is the failed response can now reach the
finding they exist for.

**Why any of this changed.** `ctx.pages` was never "this site's pages". The
orchestrator admits any response that answered 200 with a body — no
content-type gate, no attribution check — so a domain broker's parking page
reached through a temporary redirect, and a PDF served at the homepage, both
arrive as a `PageContext` an audit reads as though the site had written it.
`ctx.rootFiles` is the same: a parking host answers every path, so
`/robots.txt` and `/llms-full.txt` come back 200 and belong to the broker. On a
walled or throttled origin there is nothing at all, and an audit looping an
empty list found no fault and said so.

**36 audits now decline instead.** Each already named `origin-reachable` in its
`requires` and then assumed the answer. They now read it, via new
`scanReadTheSite()` and `unreadSiteReason()` in `scan-evidence`, and return
`notApplicable` carrying the gate's own reason.

Three classes of verdict change are visible in a report, measured across the
four nothing-obtained scan states:

- **69 pass → na.** The vacuous congratulations this work set out to remove.
- **28 fail → na**, across 13 audits — `no-nofollow`, `no-redirect-chains`,
  `language-attribute`, `single-h1`, `main-element`, `article-element`,
  `header-footer`, `content-depth`, `server-rendered`, `llms-full-txt`,
  `rss-feed`, `content-without-clickthrough`, `descriptive-urls`. These were
  failures asserted about pages the scan never had: "no `lang` attribute" on a
  page that never arrived, "no llms-full.txt" on a scan that was refused.
- **8 warn → na**, across 3 audits — `no-blanket-block` and `crawl-delay`
  ("No robots.txt found" when the fetch was refused, not absent), and
  `https-enabled` (see below).

An `na` leaves the score denominator, so a walled or parked scan now reports
fewer scored checks rather than a score built from invented ones.

**Four audits gain a finding they could not previously reach.** `origin-reachable`
is denied by exactly the conditions these audits report, so
`planAudits({ enforceEvidence: true })` — on by default since 3.0.0 — was
skipping them before they ran. The wall-reporting `fail` released in 3.0.0 was
unreachable for the 403 that produces it. Their `requires` and their entries in
`GATE_EXEMPTIONS` now drop `origin-reachable`:

- `operability-safety/no-blocking-captcha` and
  `access-crawl-control/no-bot-detection` now **fail** a 403-walled scan and
  name the firewall, where both previously reported `na`.
- `access-crawl-control/no-redirect-chains` now **fails** a scan redirected to
  another domain and names the hop. Leaving the site is what denies
  `origin-reachable`, so the one audit whose subject is the redirect was the one
  silenced by it.
- `access-crawl-control/https-enabled` still **fails** a plain-HTTP site whose
  homepage never answered: the scheme is proven by the request. Its
  "Site uses HTTPS but homepage returned status unknown. Possible TLS or server
  error" warn is gone for a scan with no attributable homepage — the
  orchestrator only admits pages that answered 200, so that branch could never
  name a status, and on a bot wall it named a fault that does not exist.

`GATE_EXEMPTIONS` also had a dead key: the entry for `no-bot-detection` was
filed under `operability-safety/`, a category that does not hold it, so it had
been matching nothing.

`content-extraction/server-rendered` is unchanged: its exemption was already
correct, and the client-rendered shell it reports still meets `origin-reachable`.

**How this is now kept true.** A registry-driven suite,
`hostile-state-contract.test.ts`, runs every registered audit against the four
states and forbids `pass`. Its exemption allowlist is empty. Per-audit tests
pin the ordering for the five audits whose subject is the failed response, so a
guard placed above their wall branch fails the build.
