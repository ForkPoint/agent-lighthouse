---
audit: content-discoverability/no-redirect-chains
audit_id: "1.16"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/no-redirect-chains.ts
slug: no-redirect-chains
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-redirect-chains (`1.16`)

> content-discoverability · source `no-redirect-chains.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Redirect chains waste AI crawler budget and slow down content discovery. Each page should resolve in a single redirect at most.

## Code review findings (2026-08-20, 11-agent pass)

BROKEN — always passes. It compares `page.fetchResult.url` with `page.fetchResult.finalUrl`, but fetcher.ts sets `finalUrl: targetUrl` unconditionally (its own comment: 'undici doesn't expose final URL after redirects easily'). The two values are equal by construction on every real scan, so the audit reports 'All N page(s) resolve without redirects' even for a site where every single URL 301s. The tests hide this by hand-assigning finalUrl to a value production can never produce.

**Required fix:** Make the fetcher record the redirect chain: either drop the redirect interceptor for this purpose and follow hops manually (`followRedirects: false`, loop on Location, cap at 5), or capture undici's redirect history and expose `redirectChain: string[]` plus a real `finalUrl` on FetchResult. Then fail on chains of length >= 2, warn on a single hop, and ignore pure http→https / trailing-slash normalizations. Rewrite the tests to drive the real fetcher against a stub server instead of assigning finalUrl by hand.

**False-positive risks:**
- `if (requestUrl !== finalUrl)` can never be true in production: `fetcher.ts` returns `finalUrl: targetUrl` in both the success and error paths. Guaranteed false PASS on 100% of scans.
- Even if finalUrl were populated, comparing start vs end URL detects *a* redirect, never a *chain* — the audit's stated subject (multi-hop) is unmeasurable this way. The undici redirect interceptor is configured with maxRedirections: 5 and the hop count is discarded.
- Cosmetic normalizations (http→https, adding a trailing slash, bare→www) would be reported as defects identically to genuine legacy chains, once finalUrl worked.
- `redirected.length > ctx.pages.length / 2` on a one-page scan means a single redirect is a site-wide FAIL.
- The tests set `p.fetchResult.finalUrl` manually, so the suite is green while the audit is inert — the coverage gives false confidence.

**Test gaps:**
- Any test exercising the REAL fetcher — the entire suite fakes finalUrl, concealing that the audit cannot fail
- Multi-hop chain (the audit's stated subject) vs a single hop
- http→https and trailing-slash normalization (should not be a defect)
- Cross-host redirect (bare → www)
- Redirect loop / exceeding maxRedirections

**Overlaps with:** `1.20`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
