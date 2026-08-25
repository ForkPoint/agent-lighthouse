---
audit: operability-safety/security-header-hygiene
category: operability-safety
source_file: packages/core/src/audits/operability-safety/security-header-hygiene.ts
slug: security-header-hygiene
evidence_grade: C
disposition: "narrowed 2026-08-24 (contradiction sweep, Part 2 Task 11) — security.txt only, informative, weight 0"
reviewed: 2026-08-24
recommended_tier: informative
consumers:
  - security researchers
  - vulnerability-disclosure scanners
  - none-known among AI agents
signals:
  - name: "Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals"
    grade: D
    domain: technical-infra
  - name: "HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect)"
    grade: B
    domain: technical-infra
  - name: security.txt (/.well-known/security.txt)
    grade: C
    domain: technical-infra
  - name: Correct Content-Type for llms.txt and .md files
    grade: C
    domain: technical-infra
sources:
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
  - google-ai-features-trust
  - s21
  - openai-apps-sdk-security
  - mcp-spec-authorization
  - rfc9116
  - security-txt-prevalence-study
  - llmstxt-spec-link
---

# security-header-hygiene (`8.7`)

> operability-safety · source `security-header-hygiene.ts` · v1 8.7 (security-txt) · evidence grade **C** · tier **informative** (weight 0)

Narrowed on 2026-08-24 to the security.txt signal alone. The three security-header rows this audit used to report — `Strict-Transport-Security` (8.2), `Content-Security-Policy` (8.3) and `X-Content-Type-Options` (8.4) — were removed as not-a-factor; see [Narrowed to security.txt](#narrowed-to-securitytxt-contradiction-sweep-2026-08-24) below. The check id is unchanged for now, so the audit is still registered as `operability-safety/security-header-hygiene` even though it now measures one file and no headers; renaming it is a separate, central change.

## Claimed mechanism (falsifiable)

**Falsifiable claim:** *none is made about AI agents.* `/.well-known/security.txt` is a vulnerability-disclosure file whose stated consumers are human security researchers and vulnerability-notification tooling. The evidence review found no AI crawler, retrieval pipeline or answer engine documented to read it, so the audit makes no claim that publishing one changes AI-agent behaviour. It reports the file's RFC 9116 conformance at weight 0, and never fails the site.

What the audit does claim, and what is testable, is narrower. RFC 9116 defines what a security.txt must contain. A *published* file with no `Contact`, no `Expires`, an unparseable `Expires`, or an `Expires` in the past does not conform — and it advertises a disclosure route that no longer works. That claim is about the file, not about agents, which is why the tier is informative.

## What it checks

One root file, one signal.

| State | Result |
| :--- | :--- |
| a 200 response whose body is not HTML, carrying a `Contact` field and an `Expires` date in the future | `pass` |
| a published file that returns HTML at 200 (SPA soft-404), or has no `Contact`, no `Expires`, an unparseable `Expires`, or an `Expires` that has passed | `warn`, priority `low` |
| no security.txt published (non-200 at both locations) | `na` |
| the location was never fetched, so nothing was measured | `na` |

`/.well-known/security.txt` is the location checked; the legacy top-level `/security.txt` is accepted as a fallback and named as such in the result. Detection is parse-not-probe by design — this dossier's own evidence records that only a minority of deployed files pass RFC validation, so presence alone proves nothing.

**`fail` is never returned**, and `scoreDisplayMode: 'informative'` with `weight: 0` keeps every outcome out of the category score, the readiness vitals and the top-fails list.

## Why the four were consolidated

*Historical record, 2026-08-22. Three of the four signals described below were removed on 2026-08-24 — see [Narrowed to security.txt](#narrowed-to-securitytxt-contradiction-sweep-2026-08-24).*

The approved v2 map row for 8.2 rules the consolidated signal "weight 0, never fails a site" (`docs/evidence/v2-audit-map.md`, §5 consolidation, audits 8.2–8.7). The four v1 audits levied four independent penalties for one unproven mechanism:

- **8.2 hsts-header** — presence-only, priority `high`, motivated by a fabricated claim that AI crawlers waste a redirect hop and that enterprise RAG pipelines reject non-HSTS sites. HSTS is browser-enforced state; GPTBot and ClaudeBot maintain none.
- **8.3 csp-header** — presence-only, priority `high`, motivated by "AI trust-scoring systems check for CSP headers". No such system is documented. Its own detection failed static hosts that ship CSP as a meta tag and passed `default-src *`.
- **8.4 content-type-options** — stated its mechanism backwards: `nosniff` makes clients *stricter* about the declared `Content-Type`, so its absence rescues a misdeclared file rather than breaking it. What actually determines whether an agent parses `llms.txt` or JSON-LD is the `Content-Type` itself, which `machine-discovery/ai-file-delivery` (v1 8.10) measures.
- **8.7 security-txt** — status-only, motivated by an AI trust score that does not exist. RFC 9116 is Informational and its documented consumers are security researchers and vulnerability-notification tooling.

Consolidating also let each source audit's code-review fixes land in one place rather than four: `max-age` parsing, meta/report-only CSP delivery, an exact `nosniff` token compare, a parsed security.txt (Contact + unexpired Expires, legacy `/security.txt` fallback, SPA soft-404 guard), and an `na` result when no page response was captured instead of v1's confident "header is missing" failure.

## Scoring

*Superseded on 2026-08-24: the audit's grade is now **C**, taken from the security.txt signal it still measures. The argument below is the 2026-08-22 record of why it was B, and is kept as history — see [Narrowed to security.txt](#narrowed-to-securitytxt-contradiction-sweep-2026-08-24) for why that grade did not survive.*

**B — the strongest proven consumer path among the four sources, not the average.**

The security-headers signal shared by 8.2, 8.3 and 8.4 grades **D**. No AI vendor documents any agent reading those headers, so nothing supports shipping the check at all. security.txt (8.7) grades **C**: a real RFC, with real but small adoption of about 1.25% of the top 1M in 2025, and zero AI consumers. The HTTPS/transport-security signal behind HSTS grades **B**: MCP, RFC 9116 and Chromium-based agent surfaces all mandate TLS, which is a documented, testable requirement even though no crawler vendor documents HSTS itself.

Grade B therefore prices the evidence, and `tier: informative` prices the *claim*: `weightForGrade('B', 'informative') === 0`. The grade records what the evidence supports; the tier records that nothing here may move a score. A future task that finds a documented AI consumer for any of these headers can promote the tier without re-grading the evidence.

## Evidence

### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** The claim under test: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies run in the opposite direction from the v1 audits. First, CSP `frame-ancestors` and `X-Frame-Options` can stop a page being embedded in an agent surface, so a strict policy is an agent-readiness negative rather than a positive. Second, OpenAI's Apps SDK shows the agent host imposing CSP on its own widget iframe, which is a property of the app and not of the publisher's site. Third, `X-Content-Type-Options: nosniff` matters only in a browser, and only makes a wrong `Content-Type` more fatal — so it belongs to the content-type signal, not here.

### Signal: HTTPS requirement (TLS, valid certificate, HTTP→HTTPS redirect) — grade B (technical-infra)

**Mechanism:** Serving the site over HTTPS with a valid certificate is a precondition for AI-agent surfaces to retrieve or act on the site. Agent-protocol specs mandate HTTPS outright. Well-known agent and security files are defined as HTTPS-only. Browser-based agents inherit Chromium's mixed-content and HTTPS-First behaviour.

**Evidence:** MCP (2025-11-25) states plainly: 'All authorization server endpoints MUST be served over HTTPS' and 'All redirect URIs MUST be either localhost or use HTTPS'. RFC 9116 requires security.txt to be 'accessed exclusively via HTTPS'. Browser-resident agents (ChatGPT Atlas, Comet, Gemini-in-Chrome, Claude in Chrome) run on Chromium and inherit mixed-content blocking, so an HTTP-only page degrades for the fastest-growing agent class.

**Counter-evidence:** No AI crawler vendor documents HTTPS as a requirement, and HSTS specifically has no documented AI consumer at all — the header is a browser-state mechanism layered on top of the TLS the agents actually need. This is why the B grade lives on the transport signal while the audit that reports the header stays informative. The scored HTTPS check itself is `access-crawl-control/https-enabled` (v1 8.1), which this audit does not duplicate.

### Signal: security.txt (/.well-known/security.txt) — grade C (technical-infra)

**Mechanism:** The claim under test: AI agents read /.well-known/security.txt to identify the site operator or a disclosure contact, and its presence improves how agents treat the site.

**Evidence:** security.txt is a real, published IETF document (RFC 9116). It has a well-defined location, a media type (text/plain, UTF-8, HTTPS-only) and required fields (Contact, Expires). Adoption is genuine, if small: roughly 0.7% of the top 1M domains in April 2024, rising to about 1.25% in 2025, with a broader count of about 573,000 domains by 2026.

**Counter-evidence:** RFC 9116 is INFORMATIONAL, explicitly 'not an Internet Standards Track specification'. Its stated consumers are human security researchers and vulnerability-notification tooling; no AI vendor documentation mentions security.txt at all. Conformity is poor — analyses find only a minority of deployed files pass RFC validation, so presence alone is weak evidence of anything. Hence the parse-not-probe detection in this audit, and the informative tier.

### Signal: Correct Content-Type for llms.txt and .md files — grade C (technical-infra)

Carried here only to record where the `nosniff` sub-signal belongs. `X-Content-Type-Options: nosniff` removes a browser's ability to recover from a wrong `Content-Type`; what an agent actually needs is the correct type, which `machine-discovery/ai-file-delivery` (v1 8.10) measures on the AI files themselves. This audit reports `nosniff` on the homepage response as hygiene and makes no parsing claim.

## Source dossiers

The four absorbed dossiers are kept verbatim as the record of why each signal moved:

- [hsts-header (8.2)](../../merged/operability-safety/hsts-header.md) — grade B
- [csp-header (8.3)](../../merged/operability-safety/csp-header.md) — grade D
- [content-type-options (8.4)](../../merged/operability-safety/content-type-options.md) — grade C
- [security-txt (8.7)](../../merged/operability-safety/security-txt.md) — grade C

## Narrowed to security.txt (contradiction sweep, 2026-08-24)

**Reason:** the contradiction sweep (`docs/evidence/CONTRADICTION-SWEEP.md`, Class A row `1/3 · none-known 1 · B / informative / 0`), plus a Class B pass-rule marker found while reading this file. Plan Part 2, Task 11.

### What the sweep found

Two things in this dossier disagreed with what shipped.

The first was the grade. The audit carried `evidenceGrade: 'B'`, and the [Scoring](#scoring) section above explains that honestly enough — "the strongest proven consumer path among the four sources, not the average" — but the B belongs to the HTTPS/transport signal, and this dossier also says, in the same breath, that the audit does not measure it: "The scored HTTPS check itself is `access-crawl-control/https-enabled` (v1 8.1), which this audit does not duplicate." So the badge priced a signal that lives somewhere else. Of the signals the audit actually reported, HSTS, CSP and `X-Content-Type-Options` are one researched signal, graded **D**, `Consumers: none-known · Recommended tier: delete`; only security.txt was recommended for shipping, at **C**, `Recommended tier: informative`. Once these pages publish, a grade-B header sitting above an evidence block that reads "none-known / delete" refutes itself in the reader's own view.

The second was the pass rule. `pass` required all four rows to be `ok`, so a site with a perfectly valid security.txt was warned for a missing `Content-Security-Policy` — a header whose researched signal recommends deletion. And a site with no security.txt at all was warned, although RFC 9116 is Informational, publishing the file is optional, and this dossier puts adoption at roughly 1.25% of the top 1M. That is a warning on about 99% of the web for not doing an optional thing that no AI agent reads.

### What the audit no longer does

It no longer reads any response header. The `Strict-Transport-Security`, `Content-Security-Policy` and `X-Content-Type-Options` rows are gone, along with the four-row table, the `max-age` threshold, the permissive-CSP patterns, the `<meta http-equiv>` CSP reader and the `nosniff` token compare. The homepage response is not an input at all any more: the audit reads `ctx.rootFiles` and nothing else. Nothing in the product replaces those rows, and nothing should.

The `## What it checks` section above has been rewritten to describe what remains. The [Claimed mechanism](#claimed-mechanism-falsifiable) has been rewritten for the same reason. Everything under [Why the four were consolidated](#why-the-four-were-consolidated), [Scoring](#scoring) and [Evidence](#evidence) is left exactly as written on 2026-08-22 — it is the research record, and correcting it in place would erase the reason this change was necessary.

### What changed

The grade drops **B → C**, the grade the security.txt signal actually carries. The tier stays `informative` and the weight stays 0: `weightForGrade('C', 'informative')` is 0, exactly as `weightForGrade('B', 'informative')` was, so no site's score moves in either direction and the scored set is unchanged. The demonstration of "grade prices the evidence, tier prices the claim" that this audit used to provide is retired here; grade and tier now say the same thing.

The security.txt detection itself is untouched. The parse-not-probe ladder — well-known location, legacy top-level fallback, SPA soft-404 guard, `Contact`, `Expires`, unparseable `Expires`, expired `Expires` — is the part this dossier justifies ("Conformity is poor — analyses find only a minority of deployed files pass RFC validation, so presence alone is weak evidence of anything. Hence the parse-not-probe detection in this audit"), and it survives intact.

What changed around it is when the audit speaks. A site that publishes no security.txt is now `notApplicable`, not `warn`: RFC 9116 defines conformance for a file that exists, it does not require a site to have one. A context in which the location was never fetched is also `notApplicable`, with a different message, so "we did not look" and "there is nothing there" stay distinguishable. A published file that fails RFC 9116 still warns, at priority `low`. A valid file passes. `fail` is still never returned — the approved v2 map row for 8.2 ruled the consolidated signal "weight 0, never fails a site", and that survives the narrowing.

The audit's title and description follow the measurement: `title` is now "security.txt (RFC 9116)" and `failureTitle` "security.txt does not conform to RFC 9116", which read true on `pass`, `warn` and `na` alike. The guidance covers the file only, and its `docsUrl` points at RFC 9116 rather than the MDN header index.

### Why the three header signals were removed rather than kept as unscored context

They follow the two headers from the same researched signal that were already removed. `technical-readiness/referrer-policy` (8.5) and `technical-readiness/permissions-policy` (8.6) are named in the same D-graded signal as HSTS, CSP and `X-Content-Type-Options`, and both were removed outright in v2 with `status: "removed", reason: "not-a-factor"`. Keeping three of the five and sunsetting two was an inconsistency, not a distinction.

One line of the D-signal counter-evidence, recorded in full in the source dossiers ([hsts-header](../../merged/operability-safety/hsts-header.md), [csp-header](../../merged/operability-safety/csp-header.md), [content-type-options](../../merged/operability-safety/content-type-options.md)), reads the other way — "They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible" — and that sentence is what produced the four-row table in the first place. It is overridden here for the same reason it was overridden for 8.5 and 8.6: `POLICY.md` gives grade D exactly two destinations, experimental behind a flag with an active draft-spec trajectory, or rejected. These have no trajectory.

The counter-evidence line about CSP `frame-ancestors` preventing a page from being embedded in an agent surface is *not* part of this justification, although it was in the first draft of the proposal. It is scoped to embedding policy, and the CSP row never parsed `frame-ancestors`. The D grade and `Recommended tier: delete` carry the removal on their own.

### What is deliberately not lost

No signal the research recommends scoring is discarded by this narrowing, which is the test a Class A fix has to pass. The scored recommendation in this dossier is HTTPS — qualified in the tier line itself as "scored (for HTTPS itself, not for HSTS)" — and it already ships at grade A, tier `scored`, weight 1.0, as `access-crawl-control/https-enabled`. Splitting it out here would have duplicated 8.1 and double-counted TLS.

The two header measurements that do have an evidenced purpose also already live elsewhere and are untouched. The one place `nosniff` changes a parsing outcome is inside `machine-discovery/ai-file-delivery`, whose dossier records it: nosniff removes a client's ability to recover from a wrong `Content-Type`, so a mis-typed file served with it is worse off. And CSP is still parsed from both the response header and `<meta http-equiv>` by `operability-safety/third-party-dom-write-blast-radius` (grade B, scored), to count how many separate companies can write into the DOM an agent reads — that audit is now the only CSP reader in the registry. What ends here is only the claim that the presence of these headers is itself an AI-readiness signal, which is the claim this dossier never supported.

### What was left for a central change

Three things this task deliberately did not do, because they touch shared files:

- **The rename.** The natural name for what is left is `operability-safety/security-txt`, with the source file, the dossier and the class renamed to match. That moves the registry index, `migration-map.json`, the migration-map and orchestrator tests and this dossier's path, so it is handled centrally rather than here. Until then the check id reads `security-header-hygiene` while the audit measures security.txt, and the summary line at the top of this page says so.
- **Retiring 8.2, 8.3 and 8.4.** Their rows in `migration-map.json` still read `status: "renamed"` into this audit. They should become `status: "removed", reason: "not-a-factor"` with their dossiers moved from `docs/evidence/merged/operability-safety/` to `docs/evidence/sunset/technical-readiness/` and a section each on `NOT-A-FACTOR.md`, exactly as 8.5 and 8.6 were handled. The hsts-header entry must record that only the header is removed and that the grade-B HTTPS/TLS signal in that dossier survives, scored, as `access-crawl-control/https-enabled`.
- **The prose that cites this audit.** `docs/evidence/audits/machine-discovery/ai-file-delivery.md`, `docs/evidence/audits/agent-interfaces/openapi-exists.md` and `docs/evidence/merged/README.md` all cite `security-header-hygiene` as the precedent for a grade-B audit shipping at tier informative. That precedent no longer exists at B, and those three sentences need to stand on their own evidence.

### Not done here

RFC 9116 also requires the file to be served as `text/plain` with UTF-8 and to be "accessed exclusively via HTTPS". Neither is checked today and neither is added now: this task removes a contradiction, and adding checks would be an expansion. Both are candidates for a later pass if the file's conformity signal is ever worth strengthening.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on the four source audits.
- 2026-08-21 — dispositions approved: 8.2/8.4 merge, 8.7 informative weight 0, 8.3 fix-then-fold.
- 2026-08-22 — consolidated into this audit (Plan 4, Task 3); registry 177 → 174.
- 2026-08-24 — contradiction sweep: narrowed to security.txt; the HSTS, CSP and X-Content-Type-Options rows removed; grade B → C, tier and weight unchanged; a site with no security.txt became `na` instead of `warn`.
