---
audit: access-crawl-control/sensitive-paths
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/sensitive-paths.ts
slug: sensitive-paths
evidence_grade: A
disposition: "kept — rewritten to crawl hygiene 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-08-22
signals:
  - name: path-level robots.txt Disallow honoured by named AI crawlers
    grade: A
    domain: crawler-permissions
sources:
  - rfc9309
  - applebot-doc
  - meta-web-crawlers-docs
  - anthropic-crawlers
  - s18
  - perplexity-bots-docs
  - google-common-crawlers
---

# sensitive-paths (`2.23`)

> access-crawl-control · source `sensitive-paths.ts` · evidence grade **A** · tier **scored** (weight 1.0) · rewritten from "sensitive paths" security framing to RFC 9309 crawl hygiene — see below

## What it checks

Whether the low-value URL families a site actually has are kept out of AI crawls by robots.txt. This is crawl hygiene, not security. RFC 9309 states that robots.txt "is not a substitute for valid content security measures", and anything that needs protecting belongs behind HTTP authentication.

The audit looks for five families: cart and checkout, site search, authentication, account areas and admin surfaces. It finds them in the crawled page URLs, the same-origin links on those pages and the sitemap. A family the crawl never observed is never asked for. API paths are not a low-value family. Agents need them, and the audit never asks a site to disallow them.

Each observed path is matched with RFC 9309 rules against six AI crawler tokens: GPTBot, ClaudeBot, Applebot-Extended, meta-externalagent, Google-Extended and PerplexityBot. A path counts as excluded only when all six are disallowed from it.

| State                                                   | Result                                      |
| :------------------------------------------------------ | :------------------------------------------ |
| no low-value family observed                            | `na`                                        |
| robots.txt blocks all six crawlers at the root          | `na` — `no-blanket-block` owns that finding |
| every observed family excluded                          | `pass`                                      |
| some families excluded, others still crawlable          | `warn`, priority `low`                      |
| no observed family excluded, or no robots.txt is served | `fail`, priority `low`                      |

A warn or fail carries the `Disallow` lines that would make the audit pass.

## Evidence

### Signal: path-level robots.txt Disallow honoured by named AI crawlers — grade A (crawler-permissions)

**Mechanism:** AI crawlers apply RFC 9309 path matching, not only a site-level allow or block. A `Disallow` naming a directory therefore keeps the URLs under it out of the crawls those agents perform. That is what makes a per-path rule a usable crawl-hygiene instrument rather than a decorative one.

**Grade: A** — two AI vendors document path-level `Disallow` for their own AI crawlers with literal directory examples, on top of a ratified standard whose matching rule they implement. That is documented consumer behaviour for exactly the signal this audit inspects.

**Evidence:**

- RFC 9309 is the ratified standard, and its matching rule is normative: "The most specific match found MUST be used" — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)
- Apple documents the rule for both of its tokens with a literal directory. For the ordinary crawler: "Applebot doesn't try to crawl documents that are under /private/ or /not-allowed/". For the generative-AI training token: "You can add a rule in robots.txt to disallow Applebot-Extended, as follows: User-agent: Applebot-Extended / Disallow: /private/" — https://support.apple.com/en-us/119829 (verified 2026-08-21)
- Meta documents the same shape for a crawler that "crawls the web for use cases such as training foundation AI models": "User-agent: meta-externalagent / Allow: / # Allow everything / Disallow: /private/ # Disallow a specific directory" — https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ (verified 2026-08-21)
- Anthropic states that "Anthropic's Bots respect 'do not crawl' signals by honoring industry standard directives in robots.txt" for ClaudeBot, Claude-User and Claude-SearchBot, though its own examples are root-level only — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)
- OpenAI directs publishers to robots.txt for GPTBot and OAI-SearchBot opt-outs — https://developers.openai.com/api/docs/bots (verified 2026-08-21)

**Counter-evidence:** The mechanism is real; the audit's original _benefit_ — security and privacy, keeping internal endpoints out of training data — is contradicted by the standard it rests on. RFC 9309 states outright that "The Robots Exclusion Protocol is not a substitute for valid content security measures", and warns that listing paths makes them publicly discoverable, directing operators to HTTP authentication instead. The old guidance therefore told site owners to publish a map of their admin surface. The agent traffic most likely to reach `/admin/` or `/api/` is also exempt. OpenAI states that for `ChatGPT-User`, "Because these actions are initiated by a user, robots.txt rules may not apply". Perplexity states that `Perplexity-User` "generally ignores robots.txt rules" (https://docs.perplexity.ai/guides/bots, verified 2026-08-21). Finally there is a domain-fit limit that shaped the rewrite: `/api/` is precisely the surface an agent wants, so a high-priority failure telling every site to disallow it works against the outcome this project exists to improve. All four points are why the audit was rewritten to crawl hygiene over observed URL families, at low priority, rather than kept as a security check.

## Implementation deviations

- The audit is crawl hygiene, not security. Its copy carries RFC 9309's caveat that robots.txt is not an access control, and its fix points at HTTP authentication for anything that needs protecting. The tag is `crawl-hygiene`.
- `/api/` is not a low-value family. Agents need API surfaces. A test asserts an `/api/`-heavy crawl is not applicable and the result never names `/api/`.
- The families are cart/checkout, site search, authentication, account areas and admin surfaces.
- `guidance.impact` names the user-initiated exemptions for ChatGPT-User and Perplexity-User.
- `defaultPriority` is `low`, and so are the result-level priorities.
- Candidates are discovered, not hardcoded: crawled page URLs, same-origin `<a href>` on those pages, and the shared sitemap tree. Cross-origin and non-HTTP links are ignored.
- A leading two-letter locale segment (`/de/`, `/en-gb/`) is skipped when classifying. Other locale shapes produce no candidate, which fails safe to not applicable.
- Each emitted `Disallow` is a literal prefix of the flagged path, locale included. Rules are deduplicated per rule, not per segment. Tests apply the emitted block back as robots.txt and expect a pass.
- No observed family is not applicable.
- Matching uses `isPathAllowed` from the shared RFC 9309 gatherer. A test pins that an empty `Disallow:` protects nothing.
- Coverage is judged per bot over six tokens: GPTBot, ClaudeBot, Applebot-Extended, meta-externalagent, Google-Extended and PerplexityBot. A rule for one bot does not cover the others.
- A root-level blanket block of all six is not applicable here. `access-crawl-control/no-blanket-block` owns that finding.
- A 200 robots.txt whose body starts with `<` is treated as no robots.txt.
- A missing robots.txt fails when low-value families were observed. A dedicated warn would score deleting robots.txt better than serving an empty one.
- The `sensitive-paths` id is unchanged, though the name no longer describes the check.
- Query-only low-value spaces such as `/?s=term` are not detected. The vendor evidence says nothing about query parameters.
