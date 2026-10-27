---
audit: access-crawl-control/web-bot-auth-request-tolerance
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/web-bot-auth-request-tolerance.ts
slug: web-bot-auth-request-tolerance
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - s1
  - s3
  - s4
  - s16
  - s2
---

# Signed-agent (Web Bot Auth) request tolerance

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Probes whether the site's edge and origin tolerate requests carrying RFC 9421 HTTP Message Signature headers at all. Some WAFs and origins reject unknown or oversized request headers outright, which means the entire cryptographically-verifiable-bot ecosystem — the one direction both Cloudflare and Google are building toward — cannot reach the site even when the operator wants it to.

## Claimed mechanism (falsifiable)

Web Bot Auth signs outbound requests with three headers: `Signature-Input` (with tag="web-bot-auth", keyid, created, expires, nonce, alg), `Signature`, and `Signature-Agent` pointing at a JWKS directory at /.well-known/http-message-signatures-directory (s1, s3). Cloudflare's verified-bot policy lists 'a cryptographic Web Bot Auth signature' as a first-class self-identification method (s4). Falsifiable claim: adding well-formed signature headers to an otherwise identical request must not change the response adversely. An adverse change is a 400 — the draft's own malformed-header code — or a 403, a 421, or a 431 Request Header Fields Too Large. Where one occurs, the origin path cannot receive signed traffic, and no signed agent can ever be admitted, whoever signed it. The test is _tolerance_, not acceptance: the site is not expected to validate the auditor's key.

## Evidence

- **[HTTP Message Signatures for Automated Traffic Protocol (draft-meunier-webbotauth-httpsig-protocol-02)](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-httpsig-protocol/)** — IETF / Thibault Meunier (Cloudflare), Sandor Major (Google) (draft-spec, URL verified 2026-08-20)
  - ACTIVE draft-02, last updated 2026-08-18. Defines three request headers: Signature, Signature-Input (params: created, expires, keyid, tag), and Signature-Agent (Structured Dictionary of HTTPS URLs, default type="directory"). Defines well-known URI /.well-known/http-message-signatures-directory serving a JWKS with media type application/http-message-signatures-directory+json. Origin MUST parse the three headers, resolve Signature-Agent, validate; MAY return 400 Bad Request on malformed headers and 403 Forbidden when additional signatures are required.
- **[Web Bot Auth — Cloudflare Bots docs](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/web-bot-auth/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Confirms the deployed shape of the three headers: Signature-Input carries tag="web-bot-auth", keyid, created/expires, nonce, alg; Signature-Agent is a structured string such as "https://signature-agent.test". Bots must host a JWKS at /.well-known/http-message-signatures-directory over HTTPS. Cloudflare verifies server-side against its registered bot database; site operators configure nothing themselves — which is exactly why a site can silently reject signed traffic without knowing.
- **[Verified bots policy — Cloudflare](https://developers.cloudflare.com/bots/concepts/bot/verified-bots/policy/)** — Cloudflare (vendor-doc, URL verified 2026-08-20)
  - Two requirements for verified status: (1) "Honest self-identification — it declares who it is deterministically, through a cryptographic Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS." (2) "Non-abusive behavior — it obeys robots.txt and crawl directives...". Establishes that UA-string alone is never trusted, which is the source of the false-positive ambiguity when auditing edge blocks by UA spoofing.
- **[RFC 9421: HTTP Message Signatures](https://www.rfc-editor.org/rfc/rfc9421.html)** — IETF (spec, URL verified 2026-08-20)
  - Ratified standard underlying Web Bot Auth. §4.1 defines Signature-Input, §4.2 defines Signature.
  - §2.3 defines the `tag` parameter: "An application-specific tag for the signature as a String value... used by applications to help identify signatures relevant for specific applications or protocols". web-bot-auth uses tag="web-bot-auth".
  - §5.1 defines the `Accept-Signature` response field, for negotiating signatures in subsequent messages. It is the only standardised way an origin can advertise that it wants signed requests.
- **[Web Bot Auth Architecture (draft-meunier-web-bot-auth-architecture-05)](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/)** — IETF (draft-spec, URL verified 2026-08-20)
  - Version 05, last updated 2026-03-02, now EXPIRED and replaced by draft-meunier-webbotauth-httpsig-protocol. Cite s1, not this, for current header semantics; useful only as the architectural rationale (identifying automated traffic via HTTP Message Signatures).

## Limits

The audit compares two HTTP responses. When the signed request gets no HTTP response, because it was not sent, timed out or failed in transport, the comparison is not possible and the audit returns not applicable with the cause. Such a probe is not evidence that the signature headers were refused.

## Example failure

A site fronted by a strict WAF rule that rejects requests with unrecognised headers returns 200 to the baseline GET and 403 to the identical GET carrying `Signature`, `Signature-Input` and `Signature-Agent`. Every Web Bot Auth-signed agent — precisely the well-behaved, cryptographically identifiable population the operator would want to allow — is rejected before any verification can occur, and nothing in the site's config names this as an AI-access decision.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The id is `web-bot-auth-request-tolerance`. The proposal's slug left no room under the 64-character id cap.
- No key directory is hosted. The tool is a library and a CLI with no origin to host one. The probe signs with an Ed25519 key generated for the scan and thrown away, and `Signature-Agent` names the repository.
- An edge that rejects on the presence of the signature headers rejects an unverifiable key exactly as a verifiable one. Whether an origin would verify a signature is invisible from outside, and the guidance says so.
- The signature base is written out, not templated: the RFC 9421 lines for `("@authority" "@method" "@path")` plus `@signature-params`. A test pins the exact string.
- A 401 or 403 carrying `Accept-Signature` passes. An origin asking for a signature is the opposite of one refusing it.
- 400, 403 and 421 fail. 431 fails with its own message, because a header-size limit is fixed differently. A 2xx whose body falls under 40% of the baseline fails. A differing answer with no `Vary` naming the signature headers warns.

## Deferred

- **Verifying our own signature end to end.** `signedHeaders` throws the private
  key away, so the test checks the signature's shape and length only.
- **Probing more than the site root.** One signed request per scan. A WAF rule
  scoped to another path is not seen.
- **`Signature-Agent` directory resolution.** An origin that tries to fetch the
  agent's key directory finds a repository page.
