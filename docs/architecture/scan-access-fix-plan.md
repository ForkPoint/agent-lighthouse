# Scan access fix plan

Status: 2026-10-16.

| Fix | State                 | Where                                                                       |
| :-- | :-------------------- | :-------------------------------------------------------------------------- |
| F1  | Merged (harness part) | PR #143 (`1b38a27a`) (`www` then `http` fallback in the corpus runners)     |
| F2  | Merged                | PR #144 (`8eb98ae0`)                                                        |
| F3  | Merged                | PR #144 (`8eb98ae0`)                                                        |
| F4  | Merged                | PR #143 (both corpus runners, nightly job included)                         |
| F5  | Merged                | Request log in PR #143; RC13 cause found and fixed in PR #144               |
| F6  | Merged                | Location and `Accept-Language` in PR #143; redirect-loop wording in PR #144 |
| F7  | Merged                | PR #140 (`c97cf1d1`)                                                        |
| F8  | Merged                | PR #144 (`8eb98ae0`)                                                        |
| F9  | Proposed              | `packages/core/src/fetcher.ts` (cookies across redirect hops)               |
| F10 | Proposed              | `hydration-payload-share.ts` (linear string scan)                           |
| F11 | Proposed              | `invisible-instruction-scan.ts` (memoise the hidden verdict)                |
| F12 | Proposed              | `waf-detector.ts` (challenge redirect targets)                              |

Decisions taken while implementing:

- F1 stays out of the scanner. The CLI accepts only absolute URLs (`isValidUrl`)
  and `normalizeUrl` has no caller, so a bare domain never reaches the scan; a
  URL the user typed is scanned as typed, as a browser would load it. The
  corpus runners own the fallback, because the corpus lists bare domains. No
  `www` hint in the core message: it would need a request to another host.
- F5 found RC13's cause. Two corpus sites sit behind the same AWS-hosted apex
  redirector. Scanned at the same time, their root-file bursts pass its
  per-IP limit and it answers an empty HTTP 428 to every request, the homepage
  included. Scanned alone, they pass. An empty 428 on the homepage is now a
  throttle with one retry, like 429.

## Source

A live corpus run scanned 200 sites from `packages/core/test-data/sites/sites.json`.
88 of them were skipped (45) or unscored (43). Each of the 88 was triaged by hand:
the live robots.txt and homepage were re-fetched with the scanner user agent and a
browser user agent, and the WAF detector was run on each response alone.

| Verdict        | Sites | Meaning                                              |
| :------------- | ----: | :--------------------------------------------------- |
| correct        |    55 | The site blocks, throttles or asks for a crawl delay |
| scanner-bug    |     9 | A reachable site is reported unreachable             |
| site-issue     |     8 | The site itself fails from the scan location         |
| false-positive |     7 | The scanner reports a block that does not exist      |
| inconclusive   |     9 | The failure did not reproduce later                  |

Site-level evidence stays outside the repository. This plan names no scanned site.

A second run on 2026-10-16 scanned the other 484 corpus sites (389 scanned,
95 skipped by robots, 116 unscored, 0 invariant violations, average 74). Its
211 problem sites were classified by script, and each fix below was then
tested on the affected sites. See "Corpus confirmation" at the end.

## Root causes

| ID   | Sites | Kind           | Summary                                                                     |
| :--- | ----: | :------------- | :-------------------------------------------------------------------------- |
| RC1  |    31 | correct        | Bot wall blocks every client                                                |
| RC2  |    16 | correct        | WAF blocks the scanner user agent; a browser user agent passes              |
| RC6  |    11 | label bug      | Every status-0 failure is named "Bot Wall"                                  |
| RC7  |    10 | scanner bug    | A bare domain is tried only as `https://<apex>/`                            |
| RC3  |     7 | correct        | Crawl-delay in a group that covers the scanner                              |
| RC5  |     7 | inconclusive   | Transient 403, timeout or budget overrun                                    |
| RC10 |     5 | site issue     | Geo redirect from the scan location to a 404, loop or other site            |
| RC8  |     4 | false positive | One root-file response marks the whole site blocked                         |
| RC9  |     4 | label bug      | WAF provider named wrong                                                    |
| RC4  |     2 | harness skip   | Harness skips a site when robots.txt limits only an AI token (see F4)       |
| RC13 |     2 | inconclusive   | Homepage 428 or timeout only inside a full scan                             |
| RC14 |     1 | scanner bug    | Gateway root page with a meta refresh or canonical is not followed (see F7) |
| RC15 |     1 | false negative | Akamai block page served with HTTP 200 is scored as content (see F8)        |
| RC16 |     3 | intermittent   | Bot wall that lets the scanner in on some runs and blocks it on others      |
| RC11 |     1 | site issue     | Country-selector gateway homepage                                           |
| RC12 |     1 | false positive | A DataDome script reference on a normal page read as a block                |

## Fixes

Ordered by sites recovered, then by risk.

### F1. Try `www` and `http` when the apex fails (RC7, 32 sites)

Cause: `packages/core/src/url-utils.ts:6` turns a bare domain into
`https://<apex>/`. Nothing tries another origin. On these sites the apex refuses
port 443, times out, or serves an expired or mismatched certificate. The `www`
host, or `http://<apex>/`, answers 200 and redirects to a working origin.

Change:

- Only for input without a scheme. An explicit `https://` URL is the user's
  choice and is never rewritten.
- When the homepage fetch of `https://<apex>/` ends with status 0 (connect
  error, TLS or certificate error, timeout), try `https://www.<apex>/`, then
  `http://<apex>/`. Follow redirects as usual. Stop at the first 2xx/3xx chain.
- Do not fall back on any HTTP status. A 403 or 404 is an answer, not a
  connection failure.
- Record the origin that worked, and the failed attempt, in the scan evidence,
  so the report says "the apex failed TLS; scanned `www`".
- The fallback shares the scan budget. One connect timeout must not use the
  whole 180 s budget: cap the first attempt.

Tests: unit tests with a mocked fetcher for each failure kind (refused, TLS,
timeout), for a 403 that must not fall back, and for explicit `https://` input.

Changeset: patch. A scan that failed now succeeds; no contract changes.

### F2. Judge the WAF verdict from pages, not root files (RC8 + RC12, 12 sites)

Cause: `packages/core/src/waf-detector.ts:37` adds every root-file response
to the verdict input. One response is enough to mark the whole site blocked:

- `:157` reads any 403 with "access denied" as Akamai. An S3 bucket answers a
  missing `/.well-known/*` file with 403 `AccessDenied` XML.
- `:123` matches the Imperva marker `_incapsula_resource` inside a 200
  robots.txt that lists that path.
- `:84` matches the `datadome.co` script URL on a normal 200 HTML page that
  only loads the DataDome tag.
- A Cloudflare rule that blocks one path (a sitemap, `/agents.md`,
  `/.well-known/*`) with 403 marks the whole site as behind a Cloudflare
  challenge, although the homepage and pages answer 200.

Change:

- Decide the block from the homepage and the sampled pages. A root file can
  add evidence only when the homepage itself failed.
- A vendor marker counts only with a block status (403, 429, 503, or a
  challenge redirect) or a challenge-shaped body (challenge form, captcha
  frame, interstitial title). A marker in a 200 page with real content is not
  a block.
- Drop the bare `403 + "access denied"` Akamai rule unless an Akamai header
  (`server: AkamaiGHost`, `akamai-grn`) is present.

Tests: one fixture per false positive above, each with a clean 200 homepage,
and the existing block fixtures must still detect.

Changeset: patch. A false finding is removed.

### F3. Name failures by their cause (RC6 + RC9, 15 sites mislabelled)

Cause: `packages/core/src/waf-detector.ts:211-219` names every status-0
homepage as "Bot Wall / Aggressive Connection Drop". That includes expired
certificates, TLS errors and refused connections. Provider names are also
guessed: the 429 rule at `:45` runs before a Cloudflare challenge is seen, and
an Akamai name is given when no page was fetched.

Change:

- TLS or certificate error: "TLS failure". Connection refused: "connection
  refused". DNS failure: "DNS failure". Name "Bot Wall" only for resets or
  timeouts after a successful connect, seen more than once.
- Name a provider only when its header or its challenge body is present.
- Do not copy raw OpenSSL error text into the reason. It spans several lines
  and breaks line-based log readers.
- Check a challenge (for example `cf-mitigated: challenge`) before the 429
  rate-limit diagnosis.

These sites stay unscored. Only the reason changes.

Changeset: patch. A message is reworded.

### F4. Stop skipping sites on robots.txt (137 sites)

The live harness tests the scanner. It is not a crawler, so a robots.txt
restriction is not a reason to leave a site out of a test run.

Cause: `checkRobots` in `scripts/test-live-sites.ts` skips a site when
robots.txt answers 401, 403 or 429 (`robots-refused`), or when any probed token
is disallowed (`robots-disallow`) or crawl-delayed (`crawl-delay`). Across the
corpus this removed 137 of 684 sites from every run. 11 of them limited only
one AI crawler token.

Change: scan every site. Make the current `--ignore-robots` behaviour the
default and remove the skip reasons from the summary. A WAF block still ends a
scan, because it stops the fetch; that is reported as unscored, as today.

Harness change only. No changeset.

### F5. Retry and log transient failures (RC5 + RC13, 9 sites)

- Add an opt-in request log to the live harness (method, URL, status, timing,
  user agent) to find what in a full scan triggers a 428 or a homepage timeout
  that single requests and a 25-request burst do not.

### F6. Record the scan location (RC10 + RC11, 6 sites)

- Write the egress country to the corpus result file.
- Use a fixed `Accept-Language` for corpus runs.
- When a redirect loop ends the fetch, say "redirect loop" in the reason
  instead of the last status code.

### F7. Follow a gateway root to the real homepage (RC14) — done, PR #140

Cause: the scan reads only the URL it is given. `runScan` in
`packages/core/src/orchestrator.ts` builds its page set from that URL and
explicit page overrides (`allPageUrls`, about line 465). Some sites serve a
splash or language-gateway page at `/`: a few words of text, a
`<meta http-equiv="refresh" content="N;url=/en/">`, and a
`<link rel="canonical">` that points at the real homepage. That page has fewer
than 50 words and 200 characters, so `textIsReadable`
(`packages/core/src/scan-evidence.ts:195-198`) rejects it. `RenderedBody` is
not met, 116 audits get no evidence, and the scan ends unscored.

Reproduction: a site whose `/` answers 200 with 6 visible words, a 4-second
meta refresh to `/en/` and a canonical to `/en/`. The scan of `/` is unscored
("could not feed 55% of the registry's evidence mass"). The scan of `/en/`
scores 86.

Change:

- Only when the requested page has no readable text.
- Take the target of a same-origin meta refresh first, then a same-origin
  canonical that differs from the requested URL. Ignore a cross-origin target.
- Fetch that target once, as the homepage. Do not chain a second hop.
- Record the hop in the scan conditions and the report ("root is a gateway;
  scanned `/en/`"). Keep the root's own findings, such as the meta-refresh
  audit, on the root.
- The country-selector homepage of RC11 is the same pattern when its links
  name one default locale. Treat it here only if that target is unambiguous.

Tests: a gateway fixture with meta refresh, one with canonical only, one with a
cross-origin target (no hop), and one with readable text (no hop).

Changeset: patch. A scan that was unscored now reads the site's real homepage.

Related doc check: the CLI and config docs claimed a scan covers up to five
pages discovered from the sitemap and navigation. The page set that feeds the
evidence gate holds only the requested URL, declared pages and the gateway
target; sitemap pages that single audits fetch
(`packages/core/src/gatherers/sampled-pages.ts`) do not count toward
`RenderedBody`. PR #140 corrected the docs. PR #142 (`862c93b2`) removed the
unused `MAX_PAGES_PER_SCAN`, `DEFAULT_SCAN_LIMIT` and `maxPages` leftovers and
the remaining six-page wording.

### F8. Detect a block page served with HTTP 200 (RC15, 1 site)

Cause: the Akamai branch of `detectWafProtection`
(`packages/core/src/waf-detector.ts`, around line 151) marks a block only on
status 403, on zero fetched pages, or on a soft-block phrase it knows
("this page is currently unavailable", "you don't have permission to access",
or "access denied" together with an `akamai-grn` header). One site answers
every client with HTTP 200, `server: AkamaiGHost`, no `akamai-grn`, a page
titled "Access Denied", and the text "This site is not accessible from your
current location". The scan reads that page as the homepage and scores it 63.

Change:

- With an Akamai header (`server: AkamaiGHost`, `akamai-request-bc`,
  `x-akam-sw-version`), a 200 page whose `<title>` is "Access Denied" and
  whose readable text is short is a block.
- Report it as a geo block when the text names the visitor's location, so the
  report says the site refuses the scan location, not the scanner.
- Keep the rule on the title and the text length. A normal page that
  mentions "access denied" in its body must still score.

Tests: the geo-block fixture (200, Akamai headers, "Access Denied" title), a
normal Akamai-served page that contains the phrase in body copy (no block),
and the existing Akamai fixtures.

Changeset: patch. A false score is removed; the site becomes unscored with a
block reason.

## Order of work

1. F1 and F2: separate branches, separate PRs. Together they recover 36 of
   684 corpus sites (26 + 10), and give 7 more a correct block reason.
   With F4, the harness tests 137 more sites per run; 12 of them score today.
2. F3 after F2, because both edit `waf-detector.ts`.
3. F4, F5 and F6 are harness and reporting changes. They can go in one PR.
   F4 is the cheapest change and adds the most sites to every test run.
4. F7 is done (PR #140).
5. F8 goes with F2 or F3, because all three edit `waf-detector.ts`.

Each PR runs the full pre-commit gate from `CLAUDE.md`, and then re-scans the
affected corpus sites to confirm the verdict changed.

## Corpus confirmation

All 684 corpus sites were scanned once. The table counts unique sites across
both runs.

| Fix | Sites hit | Test                                                                      | Result                                                                                                                                                                                      |
| :-- | --------: | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  |        32 | Re-fetch apex, then full scan of `https://www.<apex>/`                    | 32/32 apex still fail with status 0. 32/32 `www` reachable. 26 score (69-83); 6 unscored for other reasons                                                                                  |
| F1  |         7 | Same, `www` answers 403                                                   | Still unscored, but the reason becomes the real block instead of "Bot Wall"                                                                                                                 |
| F1  |        10 | `http://<apex>/` fallback on the first 10                                 | Works on 5/10 only. `www` must be tried first                                                                                                                                               |
| F2  |        10 | Full scan with a temporary homepage-first patch (reverted, not committed) | 10/10 score (68-83). An 11th case, found later in the F4 run, was not rescanned                                                                                                             |
| F2  |        31 | Homepage-only verdict on the confirmed bot walls                          | 31/31 still detected. No real block is lost                                                                                                                                                 |
| F2  |         1 | DataDome marker on a 200 homepage                                         | Homepage alone still trips. The marker rule needs a block status as well                                                                                                                    |
| F4  |       137 | Full scan with `--ignore-robots` of every robots-skipped site             | 137/137 scan with 0 invariant violations. 12 score (average 72). 119 stop at a real homepage block. 6 others: 1 more F2 case, 1 HTTP 428, 1 geo loop, 1 HTTP 401, 2 budget or evidence mass |

Not yet explained: 14 sites that ran out of budget or evidence mass, and now
answer 200 to a single homepage fetch (RC5). They need the request log of F5.

## Scored-but-blocked review

All 422 sites that received a score were scanned again with every page
attempt recorded, and each homepage was fetched as the scanner and as a
browser and checked for challenge markers.

- Every scan reads exactly one page: the target URL, plus declared pages
  and, since F7, a gateway target. No scored scan had a non-200 page or a
  WAF verdict. A score is never built on a partly blocked page set.
- 1 false negative (RC15): an Akamai geo-block page served with HTTP 200 is
  scored 63. See F8.
- 3 intermittent bot walls (RC16): scored in the corpus run, HTTP 403
  challenges in the rerun. When they scored, the page read was real content.
  No fix; the corpus result for these sites depends on the run.
- 12 sites were unscored in the rerun by budget or timeouts (RC5), 1 by a
  certificate that does not match the apex (RC7), and 1 by a redirect loop.
- `challenge-platform` in a 200 page is the Cloudflare background script on a
  normal page. It is not a block and must not become a detector marker.
- Sitemap pages that single audits sample and that answer 403 are measured
  in the full run on main below.

## F7 corpus check

Of the 684 corpus roots, 1 is a gateway by the F7 rule. The hop works there,
but the target is a client-rendered shell: 5 server-rendered words, the rest
inside scripts. The scan of the target alone is unscored on main too, so the
unscored result is correct and not caused by F7.

## Full corpus run on main

Run of 2026-10-16 on `8eb98ae0` (F1-F8 merged), all 684 sites, concurrency 6,
scan location BG, with the request log (140,267 requests).

| Measure                | Value                                                   |
| :--------------------- | :------------------------------------------------------ |
| Scanned                | 684 (0 invariant violations)                            |
| Origin fallbacks       | 53                                                      |
| Scored                 | 443 (earlier runs: 390)                                 |
| Unscored, now scored   | 53                                                      |
| Scored, now unscored   | 12                                                      |
| Unscored, WAF verdict  | 179 (Cloudflare 82, Akamai 58, PerimeterX 17, other 22) |
| Unscored, other reason | 62                                                      |

The 12 that lost their score:

- 4 ran out of the 180 s budget, and 1 timed out on the homepage. All 5 fall
  inside an event-loop stall (RC18).
- 3 hit a bot wall that let them in on the earlier run (RC16).
- 2 hit a cookie redirect loop (RC17).
- 1 got the Akamai location block page (F8 works as designed).
- 1 answered HTTP 500 once; it answers 200 now.

The 62 other unscored sites:

| Reason                                  | Sites | Verdict                                                                                                                    |
| :-------------------------------------- | ----: | :------------------------------------------------------------------------------------------------------------------------- |
| Evidence mass below the floor           |    12 | Not yet checked. The homepage answers 2xx without rendered text. One answers HTTP 202, which can be an AWS WAF challenge   |
| Scan budget ran out                     |    11 | Scanner bug (RC18). Single requests take 78-92 s only because the event loop is blocked                                    |
| Connection drop, timeout, HTTP/2 reset  |    12 | Correct. Seven reset the HTTP/2 stream for the scanner user agent only; a browser user agent gets an answer                |
| Redirect loop or redirect limit         |     9 | Scanner bug (RC17). Seven of seven sampled loops end with a cookie jar                                                     |
| Redirect to another site                |     6 | Site issue (RC10). Geo redirects from the scan location                                                                    |
| Homepage HTTP 401, 404, 409, 500 or 503 |     8 | Two are a PerimeterX challenge redirect that ends on a 404 (RC19). One is a geo redirect to a 404. The rest are site state |
| HTTP 429                                |     4 | Correct. Throttle                                                                                                          |

### RC17. Cookies are dropped between redirect hops

The fetcher walks redirects itself (`fetcher.ts`, the loop after the first
`request`). It sends no cookies. Some storefronts set a session or locale
cookie on the first hop and redirect until the cookie comes back. Without it
they loop.

Proof: `curl -L` without a cookie jar loops on all 7 sampled sites. With
`-c`/`-b` all 7 end on HTTP 200: 5 on the homepage, 2 on a DataDome challenge
page. 2 of the 7 need 6 hops, one more than `MAX_REDIRECTS` (5).

### RC18. Synchronous audit work blocks the event loop

The request log shows 5 windows of 66-92 s in which no request started or
ended in any of the 6 parallel scans. Every budget overrun and every homepage
timeout of the run falls in such a window. Three requests that were in
flight ended within 2 ms of each other when one window closed.

CPU profiles of single scans name two causes:

- `unescapedStrings` in
  `packages/core/src/audits/content-extraction/hydration-payload-share.ts`.
  The scan cuts a payload at 512 KiB. When the cut falls inside a string
  literal, the regex `/"((?:[^"\\]|\\.)*)"/g` finds no closing quote and
  restarts at every later quote. On one RSC flight payload this takes 41 s
  and returns no strings at all. The same payload uncut takes 2 ms.
- `hidingTechnique` in
  `packages/core/src/audits/operability-safety/invisible-instruction-scan.ts`.
  For every text element it re-tests every ancestor against every CSS rule.
  Busy streaks of 8-11 s per page.

### RC19. A challenge redirect that ends on an error page

Two storefronts redirect the scanner to their platform's PerimeterX challenge
route (`PX-Show`), which answers HTTP 404. The scan reports "HTTP 404, fetched
no pages". A browser user agent gets the same chain, so the block is real,
but the provider is not named. The DataDome route `DDUser-Challenge` behaves
the same way once cookies are kept (RC17).

### Sampled pages that answer 403

62 scored sites saw at least one HTTP 403 for the scanner user agent. On every
site checked, the homepage answered 200. The 403s fall on root files,
`/.well-known/` paths, hreflang alternates and sampled pages. They are read as
absent or unread, which is correct. One site answered 403 to 408 of 530
requests, nearly all hreflang alternates: the scan fetches every alternate,
which is a request-volume question, not a verdict error.

### F9. Keep cookies across redirect hops (RC17, 9 sites)

Keep a cookie jar for one redirect chain only. Send back what the chain set,
scoped by host and path. Never share it across fetches or scans, so no state
leaks between requests. Raise `MAX_REDIRECTS` to match browsers (the Fetch
standard follows 20) and keep `FETCHER_REDIRECT_LIMIT` pinned to it. Test with
a stub server that loops until its cookie returns.

### F10. Scan payload strings in linear time (RC18)

Replace the regex in `unescapedStrings` with a single forward pass. An
unterminated literal at the cut is read up to the cut instead of being lost.
Test with a 512 KiB payload cut inside a literal and a time bound.

### F11. Memoise the hidden verdict per element (RC18)

Cache "this element hides its subtree" per element, so each ancestor is
tested once per page and not once per text node below it. Test on a deep tree
with many text nodes and a time bound.

### F12. Name challenge redirect targets (RC19, 2 sites)

When the final URL of the homepage chain is a known challenge route
(`PX-Show`, `DDUser-Challenge`), report the provider instead of the bare
status.

### Order

1. F10 and F11 first. They decide whether the scan finishes at all, and they
   also slow every parallel scan in a corpus run.
2. F9, then rescan the 9 loop sites.
3. F12 after F9, because F9 changes where those chains end.
4. Check the 12 evidence-mass sites by hand before proposing anything.
