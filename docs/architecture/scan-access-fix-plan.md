# Scan access fix plan

Status: 2026-10-16. F1-F12 are merged and confirmed on the full corpus.
Open items are at the end.

This plan records why corpus sites were skipped or left unscored, what was
wrong in the scanner, and what changed. Site-level evidence stays outside the
repository. This plan names no scanned site.

## Corpus runs

All runs use `packages/core/test-data/sites/sites.json` (684 sites) and the
scan location BG.

| Run                | Code                | Sites | Scored | Notes                                                                          |
| :----------------- | :------------------ | ----: | -----: | :----------------------------------------------------------------------------- |
| First 200          | before the fixes    |   200 |    117 | 42 skipped by robots.txt, 41 unscored; 88 problem sites triaged by hand        |
| Other 484          | before the fixes    |   484 |    273 | 95 skipped by robots.txt, 116 unscored; 211 problem sites classified by script |
| Robots-skipped 137 | robots gate off     |   137 |     12 | 119 stop at a real homepage block                                              |
| Full, request log  | `8eb98ae0` (F1-F8)  |   684 |    443 | 0 invariant violations, 53 origin fallbacks; 140,267 requests logged           |
| Full, request log  | `b355ab45` (F1-F12) |   684 |    456 | 0 invariant violations, 46 origin fallbacks; 143,547 requests logged           |

"Scored" for the two early runs counts scanned sites with a score. Before F4,
robots-skipped sites were not scanned at all.

### `b355ab45` against `8eb98ae0`

- 20 sites moved to scored: 7 redirect loops or hop-limit chains (F9), 11
  budget overruns and 1 homepage timeout (F10, F11), and 1 each of HTTP 500
  and Akamai 403 that answered this time.
- 7 sites moved to unscored:
  - 5 are corrections. Their homepage redirects to `PX-Show` and answers 200
    in both runs. The `8eb98ae0` run scored the PerimeterX challenge page.
    F12 now names the wall.
  - 2 are budget overruns. One site timed out on 34 of 116 requests. The
    other is open item 2.
- The longest window with no request activity is 14.2 s, against 66-92 s
  before. No window is over 15 s.
- 228 sites stay unscored: 202 named WAF walls or throttles, 12 below the
  evidence-mass floor, 4 homepage timeouts, 3 budget overruns, 6 cross-site
  redirects, 1 Akamai redirect loop at 20 hops, and HTTP 401, 404, 409 and
  503 pages with no WAF evidence.

## Fixes

| Fix | Root causes | PR                | Change                                                                                                   | Changeset |
| :-- | :---------- | :---------------- | :------------------------------------------------------------------------------------------------------- | :-------- |
| F1  | RC7         | #143 (`1b38a27a`) | Corpus runners try `https://<apex>/`, then `https://www.<apex>/`, then `http://<apex>/`                  | none      |
| F2  | RC8, RC12   | #144 (`8eb98ae0`) | The WAF verdict reads the pages the scan read; root files count only when the homepage failed            | patch     |
| F3  | RC6, RC9    | #144 (`8eb98ae0`) | Origin failures are no longer a bot wall; providers are named only on their own evidence                 | patch     |
| F4  | RC3, RC4    | #143, #145        | Corpus runners never skip a site because of robots.txt                                                   | none      |
| F5  | RC5, RC13   | #143, #144        | `--request-log` in the corpus runners; an empty HTTP 428 on the homepage is a throttle with one retry    | patch     |
| F6  | RC10, RC11  | #143, #144        | Scan location and a fixed `Accept-Language` in corpus runs; redirect-loop wording in the unscored reason | patch     |
| F7  | RC14        | #140 (`c97cf1d1`) | A gateway root with no readable text gets one hop to its same-origin meta refresh or canonical target    | patch     |
| F8  | RC15        | #144 (`8eb98ae0`) | An Akamai 200 page titled "Access Denied" with under 1000 characters of text is a location block         | patch     |
| F9  | RC17        | #146 (`b355ab45`) | The fetcher sends back cookies set along one redirect chain and follows up to 20 redirects               | patch     |
| F10 | RC18        | #146 (`b355ab45`) | `hydration-payload-share` reads payload strings in one forward pass                                      | patch     |
| F11 | RC18        | #146 (`b355ab45`) | `invisible-instruction-scan` judges each element's hiding once per page, with hiding rules only          | patch     |
| F12 | RC19        | #146 (`b355ab45`) | A homepage chain that ends on `PX-Show` or `DDUser-Challenge` names PerimeterX or DataDome               | patch     |

Related clean-ups: #142 removed the multi-page scan leftovers
(`MAX_PAGES_PER_SCAN`, `maxPages`) and the six-page wording in the docs. #145
removed presets and the robots-blocked corpus state. Both are major and land
in 8.0.0.

### What each fix does

**F1.** The fallback lives in `scripts/lib/live-scan.ts` and runs only when the
first attempt got no HTTP status at all (refused port, TLS or certificate
error, timeout). A 403 or 404 is an answer and never falls back. `www` comes
before `http`: the `http` fallback alone recovered 5 of 10 test sites. The
scanner itself does not fall back. The CLI accepts only absolute URLs, so a
URL is scanned as typed, as a browser would load it.

**F2.** In `packages/core/src/waf-detector.ts`, a DataDome or Imperva marker
counts only with a refusal status or on a page without readable text.
"Access denied" names Akamai only beside an Akamai header. Before this, a 403
S3 `AccessDenied` document for one missing `/.well-known/` file, a Cloudflare
rule on one sitemap, or the DataDome tag on an open page marked the whole
site as walled.

**F3.** DNS, refused-port, TLS, certificate and connect-timeout errors return
no WAF verdict. The evidence gate reports "The homepage could not be fetched"
with the error. An OpenSSL error is cut to one line ("TLS error, <reason>").
A challenge is named before a root-file 429. The plan also proposed calling a
timeout a bot wall only when it repeats after a successful connect; that part
is not built (see open items).

**F4.** `SkipReason`, `--ignore-robots`, `--include-blocked` and
`CorpusState.Blocked` are gone. A WAF block still ends a scan, because it
stops the fetch. `scripts/discover-brand-pages.mjs` keeps its robots handling:
it crawls many pages per site to build the corpus.

**F5.** The request log reads undici diagnostics channels and writes one JSON
line per request (method, URL, status, time, user agent). It found RC13: two
corpus sites share an AWS-hosted apex redirector with a per-IP limit. Scanned
at the same time, their root-file bursts pass the limit, and it answers an
empty HTTP 428 to everything. It also found RC18.

**F6.** The scan location comes from the Cloudflare trace endpoint. The
redirect-loop and redirect-limit wording applies only when the chain reached
the fetcher's hop limit (`FETCHER_REDIRECT_LIMIT`, pinned to `MAX_REDIRECTS`).

**F7.** `packages/core/src/gateway.ts`. Only one hop, and only to a
same-origin target. The root keeps its own findings. Of the 684 corpus roots,
1 is a gateway; its target is a client-rendered shell, so it stays unscored.

**F8.** The reason names the location, because the page says the site is not
available from the visitor's country.

**F9.** `packages/core/src/redirect-cookies.ts`. The jar lives for one fetch,
so no state passes between requests or scans, and the first request never
carries a cookie. It handles host-only and Domain cookies, Path, Secure and
removal; a Domain for another site or a bare suffix is refused. The hop limit
went from 5 to 20, the number browsers follow.

**F10.** The scan cuts a payload at 512 KiB. A cut inside a string literal
made the old regex restart at every later quote. An open literal is now read
up to the cut.

**F11.** A rule with no hiding declaration cannot change a verdict, so no
result moved; only the time did.

**F12.** The route is the evidence. The route pages answer 404 with the shop's
error page, or 200 with a script-only challenge.

## Root causes

| ID   | Kind           | Sites | Summary                                                                      | Fixed by |
| :--- | :------------- | ----: | :--------------------------------------------------------------------------- | :------- |
| RC1  | correct        |    31 | Bot wall blocks every client                                                 | —        |
| RC2  | correct        |    16 | WAF blocks the scanner user agent; a browser user agent passes               | —        |
| RC3  | correct        |     7 | Crawl-delay in a robots group that covers the scanner                        | F4       |
| RC4  | harness skip   |     2 | Robots.txt limits only an AI token, and the harness skipped the site         | F4       |
| RC5  | inconclusive   |    14 | Budget overrun, timeout or transient 403                                     | F5, RC18 |
| RC6  | label bug      |    11 | Every status-0 failure named "Bot Wall"                                      | F3       |
| RC7  | scanner bug    |    32 | A bare domain tried only as `https://<apex>/`                                | F1       |
| RC8  | false positive |    11 | One root-file response marks the whole site blocked                          | F2       |
| RC9  | label bug      |     4 | WAF provider named wrong                                                     | F3       |
| RC10 | site issue     |     6 | Geo redirect from the scan location to a 404, a loop or another site         | open     |
| RC11 | site issue     |     1 | Country-selector gateway homepage                                            | open     |
| RC12 | false positive |     1 | A DataDome script reference on a normal page read as a block                 | F2       |
| RC13 | throttle       |     2 | Shared apex redirector answers an empty 428 under a burst                    | F5       |
| RC14 | scanner bug    |     1 | Gateway root page not followed                                               | F7       |
| RC15 | false negative |     1 | Akamai block page served with HTTP 200 scored as content                     | F8       |
| RC16 | intermittent   |     6 | Bot wall that lets the scanner in on some runs only                          | no fix   |
| RC17 | scanner bug    |     9 | Cookies dropped between redirect hops, so cookie-gated chains loop           | F9       |
| RC18 | scanner bug    |    15 | Synchronous audit work blocks the event loop for every parallel scan         | F10, F11 |
| RC19 | label bug      |     2 | A challenge redirect that ends on an error page is reported as a bare status | F12      |

Site counts come from the run that found or confirmed each cause. RC5 is the
14 sites that RC18 later explained. RC18 counts the 11 budget overruns and 4
homepage timeouts of the `8eb98ae0` run that fell inside a stall.

### RC18 in detail

The request log of the `8eb98ae0` run showed 5 windows of 66-92 s in which no
request started or ended in any of the 6 parallel scans. Every budget overrun
and every homepage timeout of the run fell in one. Three in-flight requests
ended within 2 ms of each other when one window closed. CPU profiles named
two causes: the payload regex of F10 (41 s on one payload, and no strings
read) and the per-ancestor CSS matching of F11 (busy streaks of 8-11 s per
page).

### Verdicts checked and found correct

- 7 sites reset the HTTP/2 stream for the scanner user agent only. A browser
  user agent gets an answer. "Connection drop" is the right reading.
- `challenge-platform` in a 200 page is the Cloudflare background script on a
  normal page. It is not a block and must not become a marker.
- No scored scan was built on a blocked page. Every scan reads one page: the
  target URL, plus declared pages and the F7 gateway target.
- 62 scored sites saw some HTTP 403 for the scanner user agent. On every site
  checked, the homepage answered 200. The 403s fell on root files,
  `/.well-known/` paths and sampled pages, which read as absent or unread.

## Open items

1. **UA probes on a host that never answers.** `sharedUaProbes` in
   `packages/core/src/gatherers/ua-parity.ts` probes every crawler user
   agent even when the browser baseline got no response at all (status 0).
   `classifyResponse` then reports "baseline blocked" and ignores the probe.
   One corpus site lists sitemap URLs on a load-balancer host that refuses
   connections. Each URL cost one 10 s connect timeout per user agent, one
   after the other, and the scan ran out of its 180 s budget with the CPU
   idle for 197 s. Proposed fix: skip the agent probes for a URL whose
   baseline has status 0. Check `ai-crawler-edge-parity` (all baselines
   blocked) and `machine-actionable-402-paid-access` (probe-only 402) before
   the change: both read probe entries whose baseline failed.
2. **12 sites below the evidence-mass floor.** The homepage answers 2xx
   without rendered text. Not yet triaged. One answers HTTP 202, which can be
   an AWS WAF challenge.
3. **Timeout label.** A homepage timeout is still named "Bot Wall /
   Aggressive Connection Drop" after one attempt. 3 of the 4 timeout sites
   timed out in both full runs, and the second run had no stall, so these
   are not stall victims. The F3 proposal to require a repeat after a
   successful connect is not built.
4. **Request volume.** One site answered 403 to 408 of 667 requests in one
   scan: 486 page GETs in 16 s across four locale folders. Another site got
   requests for paths with a locale folder repeated four times
   (`/us/us/us/us/`). The code path that builds these URLs is not traced yet.
5. **Smaller synchronous cost.** The `cursor:pointer` check in
   `packages/core/src/audits/operability-safety/_agent-affordances.ts` took
   about 0.7 s of one busy streak. Below the threshold that blocks scans.
6. **Geo redirects (RC10, RC11).** These depend on the scan location. A run
   from another country would show which sites redirect only from BG. 6
   sites still redirect to another site without a permanent redirect.
7. **Intermittent walls (RC16).** No fix. The corpus result for these sites
   depends on the run.
