---
audit: access-crawl-control/bravebot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bravebot.ts
slug: bravebot
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - none-confirmed (Brave states its crawler uses no differentiated UA; a Bravebot/1.0 UA is observed in third-party directories)
signals:
  - name: BraveBot / Bravebot allow/block state in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - brave-search-crawler
  - knownagents-bravebot
---

# bravebot (`2.18`)

> crawler-permissions · source `bravebot.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Bravebot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Token is real (Brave Search's crawler) but the value is thin: Brave Search builds its index substantially from the anonymized Web Discovery Project rather than crawl alone, and Brave Leo's citation surface is small. Keeping it at weight 1.0 — equal to GPTBot — overstates its importance. The token string should also be verified against Brave's current crawler documentation before shipping guidance that tells users to hand-write it into robots.txt; an incorrect token in the `code` block produces a directive that does nothing while the audit reports a pass for having written it.

**Required fix:** Verify the token against Brave's current crawler documentation and add a `docsUrl` so it is auditable. Reduce `weight` to reflect the small citation surface. Apply the shared helper fixes from 2.1.

**False-positive risks:**
- If the documented token differs from `Bravebot`, the audit passes sites that added a no-op line and fails sites that used the correct token — a self-confirming loop where the tool grades its own string rather than reality. Nothing in the code or tests validates the token against Brave's docs (note the audit ships without a `docsUrl`, unlike GPTBot/PerplexityBot/Amazonbot).
- Exact-match miss on versioned tokens.
- Weight 1.0 equal to GPTBot despite a far smaller citation surface.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- No verification that the token matches Brave's published crawler UA.
- Template-only coverage; same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: BraveBot / Bravebot allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A 'Bravebot' disallow is intended to block Brave Search's crawler, but Brave's own documentation states its crawler deliberately does not advertise a differentiated user agent — so the token has no vendor-confirmed consumer and the rule is likely a no-op.

**Evidence:** Known Agents lists a Bravebot entry with UA 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Bravebot/1.0; +https://search.brave.com/help/brave-search-crawler) Chrome/W.X.Y.Z Safari/537.36' and only 2% top-website blocking as of 2026-08-19 — the lowest of any token in this set, indicating near-zero operator recognition.

**Counter-evidence:** The vendor refutes this directly: Brave's own crawler help page states 'The Brave Search crawler does not advertise a differentiated user agent because we must avoid discrimination from websites that allow only Google to crawl them.' Brave further states 'robots.txt is not used to prevent a page from being indexed. A site owner can delist a page by using the robots noindex directive' — i.e. Brave directs publishers to noindex, not to a robots.txt token. Brave's page makes no mention of AI training, data licensing, or Brave Leo in connection with the crawler. Given the vendor contradicts the token's existence and blocking adoption is 2%, this should never be scored; consider demoting the audit toward deletion unless a Brave-published token is confirmed.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
