# Scan access fix plan

Status: 2026-10-17. F1-F17 are merged and confirmed on the full corpus.
F18 is merged and checked on the site that found it.
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
| Full, request log  | `3f6d916d` (F1-F17) |   684 |    459 | 0 invariant violations, 52 origin fallbacks; 140,254 requests logged           |

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
| F13 | RC20        | #147 (`721d7b39`) | A host that failed to connect is tried once per scan; UA probes skip a URL whose baseline got no answer  | patch     |
| F14 | RC21        | #148 (`105099d6`) | `llms-txt-links-valid` checks at most 20 links, 4 at a time                                              | patch     |
| F15 | RC22        | #149 (`95891cb4`) | The connection-drop reason says what the one homepage attempt saw                                        | patch     |
| F16 | RC23        | #150 (`31339980`) | `x-amzn-waf-action: challenge` or `captcha` names AWS WAF                                                | patch     |
| F17 | RC24        | #151 (`3f6d916d`) | The F7 gateway also follows a target on the `www` or apex twin of the host                               | patch     |
| F18 | RC25        | #152 (`60926eea`) | `robots.txt` goes first and alone; two connect failures mean no other root file is sent                  | patch     |

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

**F13.** `packages/core/src/unreachable-hosts.ts`, one instance per scan,
used by the per-scan `ctx.fetch` in `orchestrator.ts`. Only connect-level
errors count: connect timeout, refused, unreachable, DNS. The scanned site's
own hosts (target, landing host, `www` twin, subdomains) are never marked.
The fetcher reports an error against the requested URL, not the hop that
failed, so this also keeps a redirect from the site to a dead host from
marking the site. In `gatherers/ua-parity.ts`, a URL whose browser baseline
has status 0 gets no crawler probe; `classifyResponse` already reported such
probes as "baseline blocked". The site that found it: score 75 in 67 s,
against no score after 182 s.

**F14.** The audit sent every link in llms.txt at once. One site lists about
300 pages in four languages: 304 page requests in 16 s, after which its WAF
answered 403 to the rest of the scan and later refused connections from the
scan address. Now 20 links spread over the file, 4 in flight, redirects
followed. 401, 403, 429 and no answer are unverifiable, not broken. The
broken list also named the wrong URLs (index taken after a filter). The audit
is informative, weight 0. All of this was the required fix of its 2026-08-20
review.

**F15.** The homepage is fetched once, so "dropped or timed out repeatedly"
was not true. On the 5 corpus sites with this verdict the TLS connection
opened and then the request hung, was reset, or got a 403 that differed by
user agent. The verdict stays; only the wording changed.

**F16.** AWS documents both rule actions: `challenge` with HTTP 202 and
`captcha` with HTTP 405 (source `aws-waf-captcha-challenge-actions`).
`WafProvider.AwsWaf` existed, but no branch produced it.

**F17.** The site that found it answers its apex with only a title and a meta
refresh to `https://www.<site>`. Now scored 66. A subdomain, another scheme,
another port or a look-alike host is still not followed.

**F18.** The root-file phase sent 26 requests at once. undici does not cancel
a request that waits for a connection, so on a host that accepts none each
file waited out the connect timeout in turn. An abort signal did not help:
queued requests still ended at 21 s and 31 s. `robots.txt` now goes first and
alone, with one retry on a connect failure. Two connect failures mean the
other root files are not sent. The site that found it went from about 120 s
to 32 s per origin, same verdict. Cost: one serial request per scan.

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
| RC11 | site issue     |     6 | Country-selector homepage with no readable text                              | kept     |
| RC12 | false positive |     1 | A DataDome script reference on a normal page read as a block                 | F2       |
| RC13 | throttle       |     2 | Shared apex redirector answers an empty 428 under a burst                    | F5       |
| RC14 | scanner bug    |     1 | Gateway root page not followed                                               | F7       |
| RC15 | false negative |     1 | Akamai block page served with HTTP 200 scored as content                     | F8       |
| RC16 | intermittent   |     6 | Bot wall that lets the scanner in on some runs only                          | no fix   |
| RC17 | scanner bug    |     9 | Cookies dropped between redirect hops, so cookie-gated chains loop           | F9       |
| RC18 | scanner bug    |    15 | Synchronous audit work blocks the event loop for every parallel scan         | F10, F11 |
| RC19 | label bug      |     2 | A challenge redirect that ends on an error page is reported as a bare status | F12      |
| RC20 | scanner bug    |     1 | Sitemap URLs on a host that never connects, tried once per URL and per UA    | F13      |
| RC21 | scanner bug    |     1 | Every llms.txt link fetched at once; the burst trips the site's WAF          | F14      |
| RC22 | label bug      |     5 | A single homepage timeout described as repeated                              | F15      |
| RC23 | label bug      |     1 | AWS WAF challenge (empty HTTP 202) reported as too little evidence           | F16      |
| RC24 | scanner bug    |     1 | Gateway meta refresh to the `www` twin not followed                          | F17      |
| RC25 | scanner bug    |     1 | The site's own host never connects; every root-file probe waits it out       | F18      |

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

### `3f6d916d` run: F13-F17 confirmed

Compared with the `b355ab45` run:

- 5 sites newly scored, 2 lost. Both lost sites now stop at a homepage 403
  (Cloudflare, Akamai) within 3 s: intermittent walls (RC16).
- Budget overruns fell from 11 to 1. The remaining site answers every request
  in 4-8 s; 281 requests need 366 s of request time. The verdict is correct.
- No gap over 15 s in the request log in which no request starts or ends.
- The highest per-site burst fell from 523 to 499 GETs in 20 s. About 200
  requests per site in under a minute is the normal scan shape (root files,
  `/.well-known/` probes, feeds, sampled pages), so "over 100 in 20 s" is not
  a useful threshold. The site that found F14 now refuses connections from
  the scan address, so the corpus cannot show its burst; the unit tests pin
  the 20-link, 4-at-a-time limit.
- F15: 4 connection drops now read "The connection opened, but the homepage
  sent no response before the timeout".
- F16: the AWS WAF site reads "AWS WAF refused the scan: challenge rule
  action, HTTP 202".
- F17: the gateway site below the evidence-mass floor is now scored.
- Remaining scans over 170 s: 13 of 14 scored or correctly unscored near the
  budget. The 14th is RC25.

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

## Decisions

- **Country-selector homepages (RC11) stay unscored.** 5 of the 12 sites
  below the evidence-mass floor answer the homepage with a country or
  language picker and no readable text. That is what an agent sees there.
  Following one locale link would need a rule for which locale to pick, and
  would score a page the visitor did not ask for. Decided 2026-10-17.
- **Client-rendered shells stay unscored.** 5 other sites below the floor
  serve a script shell whose text appears only after JavaScript runs. The
  scan does not run a browser, so it has nothing to read.
- **Locale redirect loops are the site's.** One site answers every probe with
  a 302 that adds one more locale folder (`/us/us/us/`). The fetcher follows
  the chain to its hop limit, as a browser would.

## Open items

1. **Smaller synchronous cost.** The `cursor:pointer` check in
   `packages/core/src/audits/operability-safety/_agent-affordances.ts` took
   about 0.7 s of one busy streak. Below the threshold that blocks scans.
2. **Geo redirects (RC10).** These depend on the scan location. A run from
   another country would show which sites redirect only from BG. 6 sites
   still redirect to another site without a permanent redirect.
3. **Intermittent walls (RC16).** No fix. The corpus result for these sites
   depends on the run.
