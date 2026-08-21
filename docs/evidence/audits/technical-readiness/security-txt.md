---
audit: technical-readiness/security-txt
audit_id: "8.7"
category: technical-readiness
source_file: packages/core/src/audits/technical-readiness/security-txt.ts
slug: security-txt
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "informative, weight 0 (approved 2026-08-21)"
reviewed: 2026-08-21
---

# security-txt (`8.7`)

> technical-readiness · source `security-txt.ts` · review verdict **delete** · evidence grade **C** · disposition: **informative, weight 0 (approved 2026-08-21)**

## What it checks

AI trust-scoring systems check for security.txt as a signal of responsible disclosure practices. Its presence contributes to a higher overall trust score for your site in enterprise AI frameworks that evaluate site maturity before recommending it in answers.

## Code review findings (2026-08-20, 11-agent pass)

Checks `ctx.rootFiles['/.well-known/security.txt']` for a 200 and fails otherwise, justified by 'AI trust-scoring systems check for security.txt as a signal of responsible disclosure practices … making your content more likely to be recommended in AI-generated answers'. RFC 9116 security.txt is a real, healthy convention — for security researchers. It is read by vulnerability reporters and some ASM scanners, and by nothing in the AI stack: no crawler, retrieval pipeline, or answer engine parses it or weights citations by it. Inside an AI-readiness tool it is a pure trust-score fabrication, and the check is content-blind on top of that.

**Required fix:** Delete from technical-readiness. If the maintainer wants to keep it for general site-maturity reporting, move it out of the scored set (return `na`-style informational), require an actual parse — `Contact:` present and `Expires:` in the future — and try the legacy /security.txt location before failing.

**False-positive risks:**
- Status-only, content-blind: `file.status === 200` with no parsing. An SPA/Netlify/Vercel rewrite that serves index.html for unknown paths returns 200 for /.well-known/security.txt, so the site passes with an HTML page that contains no Contact field. Conversely a real, valid but EXPIRED security.txt (RFC 9116 requires `Expires`; an expired file must be treated as invalid) also passes.
- No `Contact` requirement: the guidance says 'at minimum a Contact field' but the code never looks for it, so the pass condition and the stated requirement disagree.
- WAF interference: bot protection commonly 403s /.well-known/* paths for non-browser user agents (`SCANNER_USER_AGENT`), producing a fail on sites that publish a perfectly good security.txt.
- Only the /.well-known/ location is fetched; the RFC's legacy top-level /security.txt fallback is never tried.

**Test gaps:**
- No test for a 200 that is actually the SPA HTML fallback (soft-404).
- No test for an expired `Expires:` value or a file missing `Contact:` — both currently pass.
- No test for a 403 from bot protection.
- No test for the legacy /security.txt location.

**Overlaps with:** `8.19`, `8.20`, `8.2`, `8.3`, `8.5`, `8.6`

## Evidence

### Signal: security.txt (/.well-known/security.txt) — grade C (technical-infra)

**Mechanism:** CLAIM UNDER TEST: AI agents read /.well-known/security.txt to identify the site operator or a disclosure contact, and its presence improves how agents treat the site. FALSIFIABLE FORM: a named AI agent or crawler fetches /.well-known/security.txt and its output changes as a result.

**Evidence:** security.txt is a real, published IETF document (RFC 9116) with a well-defined location, media type (text/plain, UTF-8, HTTPS-only) and required fields (Contact, Expires), and it has genuine — if small — adoption: roughly 0.7% of the top 1M domains in April 2024 rising to about 1.25% in 2025, with a broader count of ~573,000 domains by 2026. That is enough real-world deployment to make it a defensible 'good operator hygiene' marker rather than a fiction.

**Counter-evidence:** Three separate problems for treating this as an AI signal. (1) RFC 9116 is INFORMATIONAL, explicitly 'not an Internet Standards Track specification'. (2) Its stated consumers are human security researchers and vulnerability-notification tooling; the RFC itself cautions researchers to review the file before acting on it in an automated fashion. No AI vendor documentation mentions security.txt at all. (3) Conformity is poor — analyses find only a minority of deployed files pass RFC validation, so presence alone is weak evidence of anything. The mechanism for AI agents is plausible-by-analogy (agents like discoverable well-known metadata) but entirely unproven. Keep it informative; do not let it move a score.
**Consumers:** security researchers, vulnerability-disclosure scanners, none-known among AI agents · **Recommended tier:** informative

**Sources:** [RFC 9116 — A File Format to Aid in Security Vulnerability Disclosure](https://www.rfc-editor.org/rfc/rfc9116.html) · [security.txt Revisited: Analysis of Prevalence and Conformity in 2022](https://seclab.cs.hm.edu/assets/pdf/th-sectxt-2023.pdf)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/technical-readiness/security-txt.md](../../deletions/technical-readiness/security-txt.md). Outcome: **dead-but-informative-candidate**, grade C.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
