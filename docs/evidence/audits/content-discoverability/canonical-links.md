---
audit: content-discoverability/canonical-links
audit_id: "1.17"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/canonical-links.ts
slug: canonical-links
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# canonical-links (`1.17`)

> content-discoverability · source `canonical-links.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Canonical link tags tell AI crawlers which URL is the authoritative version of a page, preventing duplicate content issues.

## Code review findings (2026-08-20, 11-agent pass)

Checks each page for a <link rel="canonical"> with a non-empty href. Presence-only: it never validates the value, so the far more damaging real bug — every page emitting a canonical pointing at the homepage, which actively de-indexes the whole site — scores a perfect PASS, while an SPA that injects a correct canonical via JS scores FAIL.

**Required fix:** Validate the value, not just presence: resolve the href against the page URL and flag (a) canonicals pointing to a different page than the one scanned (especially many-to-one collapse onto '/'), (b) multiple conflicting canonical elements, (c) off-domain canonicals. Match rel case-insensitively and token-wise. Where a page is JS-rendered, downgrade a missing canonical to warn rather than fail.

**False-positive risks:**
- `$('link[rel="canonical"]').attr('href')` — presence only. A site where all pages canonicalize to `https://site.com/` (a classic SPA/template bug that deletes the site from indexes) PASSES with 'All N page(s) have canonical link tags'. The audit is blind to the failure mode that matters most.
- CSS attribute selector `[rel="canonical"]` is value-case-sensitive: `rel="Canonical"` or `rel="canonical "` (trailing space) is treated as missing.
- JS-injected canonicals (React Helmet / next/head in client-rendered routes) are absent from the static HTML → false FAIL for pages that agents with a browser would see as canonical.
- `.attr('href')` returns the FIRST matching element; a page with two conflicting canonicals (a genuine defect) is judged on one and passes.
- Relative canonical hrefs (`href="/page"`) — valid but ambiguous — are accepted without comment.
- Cross-domain canonicals pointing off-site (syndicated content) pass silently, though they can hand attribution to another domain.
- No check that the canonical matches the page's own URL, so self-referential correctness is never verified.

**Test gaps:**
- Every page canonicalizing to the homepage — currently a false PASS on a site-killing bug
- rel="Canonical" / trailing whitespace in the rel value
- Two conflicting canonical tags on one page
- Relative canonical href
- Cross-domain canonical
- JS-injected canonical absent from SSR HTML

**Overlaps with:** `1.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
