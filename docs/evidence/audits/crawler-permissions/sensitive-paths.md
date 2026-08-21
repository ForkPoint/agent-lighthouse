---
audit: crawler-permissions/sensitive-paths
audit_id: "2.23"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/sensitive-paths.ts
slug: sensitive-paths
review_verdict: delete
severity: high
evidence_grade: A
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# sensitive-paths (`2.23`)

> crawler-permissions · source `sensitive-paths.ts` · review verdict **delete** · evidence grade **A** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

Without robots.txt, AI crawlers can access sensitive paths like /api/ and /admin/. This may expose internal endpoints, admin panels, or debug information in AI training data and search results.

## Code review findings (2026-08-20, 11-agent pass)

Net-misleading on three independent grounds and should be removed. (1) The matching logic inverts on the most common robots.txt idiom: `path.startsWith(r.path)` is always true when `r.path` is the empty string, so `User-agent: *\nDisallow:` — which means 'nothing is disallowed' — produces a PASS reading 'Sensitive paths are protected: /api/, /admin/'. It reports maximum protection on a file that protects nothing. (2) The premise is wrong for most sites: it hardcodes `['/api/', '/admin/']` and FAILs any site lacking those literal paths, so a WordPress site shipping the default `Disallow: /wp-admin/` fails for not protecting `/admin/` — a path that does not exist on it. (3) The guidance is a security anti-pattern: robots.txt is a public file and is not an access control; listing `/admin/` in it advertises the endpoint to attackers while doing nothing to stop the malicious crawlers the audit invokes. Telling users this reduces 'security and privacy risks' at high priority is actively wrong advice, and it belongs in a security category rather than crawler-permissions in any case.

**Required fix:** Delete. If the maintainer insists on retaining a robots.txt hygiene check, it must (a) drop the `path.startsWith(r.path)` clause and implement real longest-prefix matching per RFC 9309, (b) discover candidate paths from the crawl (links and sitemap entries actually observed) instead of hardcoding two, (c) return `notApplicable` when no such paths exist on the site, and (d) reframe the guidance to state explicitly that robots.txt is not an access control and that listing private paths discloses them.

**False-positive risks:**
- `return ruleNorm === pathNorm || r.path.startsWith(path) || path.startsWith(r.path);` — with `r.path === ''` from a bare `Disallow:`, `'/api/'.startsWith('')` is true, so an unprotected site PASSes. Concrete inverted result on an extremely common file.
- Same clause with `r.path === '/'`: a blanket-blocked site reports all sensitive paths 'protected' and PASSes here while 2.22 FAILs critical — the report contradicts itself on one input.
- Same clause with any short rule: `Disallow: /a` makes `/api/` 'protected' via `'/api/'.startsWith('/a')`.
- Hardcoded `/api/` and `/admin/` FAIL every site using `/wp-admin/`, `/administrator/`, `/dashboard/`, `/v1/`, or a headless/subdomain API — i.e. most of the real web.
- `checkSensitivePaths` filters to `g.userAgent === '*'` only, so a site that disallows `/admin/` under bot-specific groups is reported unprotected.
- SPA soft-404 serving HTML at /robots.txt yields a high-priority FAIL 'No sensitive paths are protected' on a site with no robots.txt at all.

**Test gaps:**
- No `Disallow:` (empty value) fixture — the exact input that inverts the result.
- No `Disallow: /` fixture showing the contradiction with 2.22.
- No `/wp-admin/` or other real-world admin path.
- No site legitimately lacking /api/ and /admin/ entirely.
- No bot-specific-group case, no soft-404 case.

**Overlaps with:** `2.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/crawler-permissions/sensitive-paths.md](../../deletions/crawler-permissions/sensitive-paths.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
