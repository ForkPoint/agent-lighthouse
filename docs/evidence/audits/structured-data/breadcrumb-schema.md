---
audit: structured-data/breadcrumb-schema
audit_id: "3.5"
category: structured-data
source_file: packages/core/src/audits/structured-data/breadcrumb-schema.ts
slug: breadcrumb-schema
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# breadcrumb-schema (`3.5`)

> structured-data · source `breadcrumb-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.

## Code review findings (2026-08-20, 11-agent pass)

BreadcrumbList is a real, still-consumed signal, but the applicability gate is a raw URL-segment count that has no relationship to site hierarchy, and the 'nothing to assess' branch returns warn (0.5) instead of notApplicable, docking flat-URL sites for a structure they do not have.

**Required fix:** Return `this.notApplicable(...)` when no deep pages exist. Drive applicability off `pageType` (product/category/content) rather than segment count, resolve depth from `fetchResult.finalUrl`, and strip a leading locale segment (`/xx/` or `/xx-yy/`) before counting. Additionally require `itemListElement` to be a non-empty array with sequential `position` values before passing.

**False-positive risks:**
- `urlDepth(p.url) > 1` is pure URL shape. A locale-prefixed site (`/en-us/about`, `/de/kontakt`) has depth 2 on every page and is required to carry breadcrumbs even though it is logically flat — a false fail driven entirely by an i18n path segment.
- Conversely a genuinely deep site using flat slugs (`/blue-running-shoe`) is exempted from breadcrumbs entirely, so the audit passes sites that most need the fix.
- Uses `p.url` rather than `p.fetchResult.finalUrl`. After a `/category/sub-page` → `/sub-page` redirect the page is still counted as deep and required to have breadcrumbs describing a hierarchy that no longer exists.
- The no-deep-pages branch returns `this.warn(...)` (score 0.5), not `this.notApplicable(...)`, so a single-level marketing site takes a permanent half-point deduction for a check the base class explicitly documents as an `na` case (audit.ts:38-46).
- Only `@type === 'BreadcrumbList'` is accepted, with no check that `itemListElement` exists or that positions are sequential — an empty `"itemListElement": []` BreadcrumbList counts as a pass.
- Which pages count as 'deep' depends entirely on which URLs the crawler happened to sample, so the same site can score pass/warn/fail across runs with different page discovery.

**Test gaps:**
- No test for a locale-prefixed URL (`/en-us/about`) being wrongly classed as deep
- No test where `url` and `fetchResult.finalUrl` differ (redirect)
- No test for a BreadcrumbList with an empty or malformed `itemListElement`
- No test asserting the no-deep-pages branch should be `na` rather than `warn`
- No Microdata/RDFa breadcrumb test (`itemtype=".../BreadcrumbList"` is very common on legacy commerce platforms)

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
