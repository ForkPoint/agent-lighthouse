---
audit: content-discoverability/navigation-json
audit_id: "1.21"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/navigation-json.ts
slug: navigation-json
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# navigation-json (`1.21`)

> content-discoverability · source `navigation-json.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

A navigation.json file gives AI agents a machine-readable map of your site hierarchy, helping them navigate your site like a human would.

## Code review findings (2026-08-20, 11-agent pass)

Requires a /navigation.json file at the site root. No such standard exists — it is not an IETF well-known URI, not a W3C or schema.org convention, and has no known consumer among any crawler, agent or MCP client. The audit invents a file format (its own ad-hoc {name, items[], children[]} shape appears nowhere else), fails essentially every site on the internet at medium priority, and instructs users to hand-maintain a second copy of their navigation for zero downstream benefit. This is the clearest case in the category of an audit that is net-misleading.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- Fails 100% of real sites, since no site ships /navigation.json — the 'fail' carries no information about the site at all.
- Passing is equally meaningless: `JSON.parse(result.body)` accepts `"x"`, `0`, `null`, `[]` — any valid JSON scalar passes as 'navigation.json exists with valid JSON'. The prescribed items/children structure is never validated.
- No content-type check, so an SPA catch-all returning HTML gives 'invalid JSON' (implying the user has a broken file) rather than 'not found'.
- Any site that happens to host an unrelated /navigation.json (a JS bundle manifest, a CMS export) PASSES on a file that has nothing to do with site navigation.
- Even a perfectly formed file per the sample cannot improve agent outcomes, because nothing fetches it — so a user who does the work sees zero change and loses trust in the whole report.

**Test gaps:**
- Valid-JSON-but-not-navigation bodies ('null', '[]', a scalar) that currently PASS
- HTML soft-404 reported as 'invalid JSON'
- Any evidence that a consumer of this file exists

**Overlaps with:** `1.7`, `1.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/content-discoverability/navigation-json.md](../../deletions/content-discoverability/navigation-json.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
