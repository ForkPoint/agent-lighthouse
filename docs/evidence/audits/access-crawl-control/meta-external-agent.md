---
audit: access-crawl-control/meta-external-agent
audit_id: "2.7"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/meta-external-agent.ts
slug: meta-external-agent
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# meta-external-agent (`2.7`)

> crawler-permissions · source `meta-external-agent.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Meta-ExternalAgent collects pages for Meta's foundation-model training and for indexing content directly into Meta products, and Meta documents it as respecting robots.txt.

This reads the robots.txt rules that actually apply to the token — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants a named crawler the same access a named group would.

## Code review findings (2026-08-20, 11-agent pass)

Meta-ExternalAgent is a live token (Llama training and Meta AI corpora) so the signal stands, but it inherits every base-class defect and the pass criterion remains the cargo-cult 'explicit Allow: /'. Additional nuance the audit ignores: Meta operates several tokens (Meta-ExternalAgent, Meta-ExternalFetcher, and the legacy facebookexternalhit) with different purposes, and only two are audited — a site can be fully open to the audited pair while blocking the fetcher that actually renders link previews.

**Required fix:** Apply the shared helper fixes from 2.1 (BOM strip, prefix matching, `/*` blanket forms) and add prefix-match so a shorthand `Meta-External*` group is attributed to both Meta tokens.

**False-positive risks:**
- Exact-match miss on `User-agent: meta-externalagent` variants with version suffixes.
- Prefix collision: `User-agent: Meta-External` (a shorthand some sites use to cover both Meta tokens) matches neither audited token, so a deliberate Meta block reads as 'allowed by default'.
- Shared BOM / soft-404 / `Disallow: /*` misreads.
- Cloudflare/edge UA blocking is invisible to the scanner's `AgentLighthouse/1.0` fetch.

**Test gaps:**
- No prefix/shorthand token case.
- No test covering the Meta-ExternalAgent vs Meta-ExternalFetcher distinction.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.17`, `2.22`, `2.28`

## Evidence

### Signal: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer) — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does NOT reliably stop fetches, because Meta reserves a user-request exemption.

**Grade: A** — Meta's web-crawlers page documents `meta-externalagent` as crawling "for use cases such as training foundation AI models or improving products by indexing content directly", with no stated robots.txt exemption, and gives a literal per-directory example. A vendor naming its own token, its purpose and the directive that governs it is the grade-A bar. The grade attaches to this token specifically: the same page reserves a user-request exemption for `meta-externalfetcher`, which "may bypass robots.txt rules", and a security exemption for `facebookexternalhit`. Conflating the three would spend an A on two agents that do not honour the directive.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly' with no stated robots.txt exemption; Meta-WebIndexer (new) 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses' — making Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family that audits must not conflate with meta-externalagent: meta-externalfetcher 'fetches individual links at a user's request' and 'may bypass robots.txt rules'; and facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.
**Consumers:** meta-externalagent, meta-externalfetcher, Meta-WebIndexer, Meta-ExternalAds, facebookexternalhit · **Recommended tier:** scored

**Sources:** [Meta Web Crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) (verified 2026-08-20) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) (verified 2026-08-20)

## Pass-rule correction (contradiction sweep, 2026-08-24)

The audit scored the shape of the file rather than the access it grants.

Inherited from `_crawler-bot-audit.ts`, the rule passed only on
`allowed && explicitly` and warned at score 0.5 on `allowed && !explicitly`. A
site whose robots.txt reads `User-agent: *` / `Allow: /` — every crawler
welcome, nothing blocked — scored half marks at weight 1.0 for not naming the
token. This dossier's own code review names that criterion: "the pass criterion
remains the cargo-cult 'explicit Allow: /'".

Nothing in the evidence supports it. The grade A rests on the mechanism
statement — "Meta states the agent respects robots.txt" — which is a fact about
whether a disallow takes effect, not about whether a group names the token. RFC
9309 §2.2.1 makes a crawler obey the group matching its own product token and
fall back to `*` only when no such group exists, so the catch-all case and the
named case grant identical access. Scoring them differently contradicts the
standard the audit relies on.

The rule now asks one question: do the rules that apply to Meta-ExternalAgent
permit `/`? Allowed by its own group, allowed through the catch-all, and allowed
because no group applies all pass. A disallow that reaches the token — its own
group, or a blanket catch-all block with no group naming it — still fails, which
is the one state the sources cover. The `warn` band is gone from this audit.

An unreadable robots.txt is not applicable rather than a warn: missing, non-200,
an empty body, or a 200 that parses to no groups and no directives, which is the
shape of an HTML error page served at `/robots.txt`. A file that parses but
carries no group applying to the token — a `Sitemap:`-only file — passes, because
the crawl state is the same as any other file with no matching group. This
follows the disposition `access-crawl-control/agent-governance` took on the same
branch.

**Prefix matching was rejected, and the rejection is deliberate.** The 2026-08-20
code review asked for a prefix match so a shorthand `Meta-External*` group would
be attributed to this token. The evidence forbids it. Meta documents
`meta-externalfetcher` as a separate agent that "fetches individual links at a
user's request" and "may bypass robots.txt rules", and this dossier's own
counter-evidence calls these "Two documented robots.txt exemptions in the same
family that audits must not conflate with meta-externalagent", adding that a
fetcher disallow "should therefore be reported informatively, not scored as an
effective control". A prefix match would import a fetcher-scoped rule straight
into a scored verdict. Matching stays on the RFC 9309 product token, which does
accept a version suffix such as `Meta-ExternalAgent/1.0`. Two tests pin the
shorthand and the fetcher group as non-matches; revisit them only if evidence
appears that Meta honours prefix groups.

**One user-facing claim was withdrawn.** The old failure text said blocking the
agent "prevents your content from appearing in AI-powered search results and
answers". This dossier assigns that role to a different token: Meta-WebIndexer
"navigates the web to improve Meta AI search result quality for users" and helps
"cite and link to your content in Meta AI's responses", making Meta-WebIndexer
the allow-side visibility token and meta-externalagent the training-side block
token. The failure now states what the block actually does — exclusion from the
training corpus and from direct product indexing — and its priority drops from
`high` to `medium`, matching `defaultPriority`, because the `high` rested on the
visibility claim just withdrawn.

Grade, tier and weight are unchanged at A, scored, 1.0. What was wrong was the
pass condition, not the grade.

Two residues worth recording. `guidance.code` still shows the
`User-agent: Meta-ExternalAgent` / `Allow: /` snippet, and `toCheckResult`
stamps it onto every row including passing ones; it is the correct remedy for
the only state this audit now fails, so it stays, but it is not a requirement
and the description no longer implies it is. And the audit now behaves
differently from its twenty `CrawlerBotAudit` siblings on the same robots.txt.
That is intended — only this one has a recorded pass-rule finding, and
`chatgpt-user` and `anthropic-ai` are handled separately — but a reader
comparing two bot rows in one report will see one pass where another warns. The
passing messages carry the reason.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-24 — contradiction sweep: pass rule narrowed from the explicit-group criterion to the access state RFC 9309 defines.
