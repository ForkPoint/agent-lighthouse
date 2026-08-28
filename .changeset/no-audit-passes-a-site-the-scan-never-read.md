---
'@forkpoint/agent-lighthouse-core': minor
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

Measured with the gate held open — the contract suite calls every audit
directly, which is what a caller passing `enforceEvidenceGate: false` gets —
across the five nothing-obtained scan states: **90 pass → na**, **33 fail →
na**, **9 warn → na**. Those are the vacuous congratulations and the invented
faults this work set out to remove: "no `lang` attribute" on a page that never
arrived, "no llms-full.txt" on a scan that was refused.

**Almost none of that is visible in a released report, and this is the honest
version of a claim an earlier draft of this changeset got wrong.** The evidence
gate has been on for every scan since 3.0.0, and in each of these states it
already skipped those audits before they ran: the same `na`, tagged
`skipped:no-evidence`, with a different sentence attached. What actually moves
in a report, measured 3.0.0 to this release with the gate on, is seven cells
across the five states:

- **4 na → fail.** `no-bot-detection` on a 403 wall and on a 200 challenge,
  `no-blocking-captcha` on a 403 wall, `no-redirect-chains` on a scan
  redirected to another domain. These are the findings recovered below.
- **3 pass → na**, all on a 200 bot challenge, and all from the predicate
  change described in the sibling changeset about a wall served at 200.
- **18 cells keep the status `na` and change their wording**, from the gate's
  "Not assessed: this scan has no … evidence" stub to the audit's own sentence.

An `na` leaves the score denominator either way, so what a walled or parked
scan reports is unchanged in shape: fewer scored checks, and no overall score.

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
  name a status, and on a bot wall it named a fault that does not exist. That
  branch is now reached in one state, and it says what that state is: the
  homepage answered over HTTPS and the response carried no document, so nothing
  could be read over a connection that was itself fine. It names no status:
  `origin-reachable` accepts any 2xx while the orchestrator admits a page only
  at 200, so a homepage answering 204, 203 or 206 lands there too, and the
  audit holds no homepage response to read the real status from.

`GATE_EXEMPTIONS` also had a dead key: the entry for `no-bot-detection` was
filed under `operability-safety/`, a category that does not hold it, so it had
been matching nothing.

`content-extraction/server-rendered` is unchanged: its exemption was already
correct, and the client-rendered shell it reports still meets `origin-reachable`.

**How this is now kept true.** A registry-driven suite,
`hostile-state-contract.test.ts`, runs every registered audit against the five
nothing-obtained states and forbids `pass`. Its exemption allowlist is empty.
Per-audit tests pin the ordering for the five audits whose subject is the
failed response, so a guard placed above their wall branch fails the build.
