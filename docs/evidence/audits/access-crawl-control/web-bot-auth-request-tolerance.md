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

Web Bot Auth signs outbound requests with three headers: `Signature-Input` (with tag="web-bot-auth", keyid, created, expires, nonce, alg), `Signature`, and `Signature-Agent` pointing at a JWKS directory at /.well-known/http-message-signatures-directory (s1, s3). Cloudflare's verified-bot policy lists 'a cryptographic Web Bot Auth signature' as a first-class self-identification method (s4). Falsifiable claim: adding well-formed signature headers to an otherwise identical request must not change the response adversely. An adverse change is a 400 — the draft's own malformed-header code — or a 403, a 421, or a 431 Request Header Fields Too Large. Where one occurs, the origin path cannot receive signed traffic, and no signed agent can ever be admitted, whoever signed it. The test is *tolerance*, not acceptance: the site is not expected to validate the auditor's key.

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

## Competitor coverage

Entirely absent from every tool. Lighthouse 13.3's Agentic Browsing category is a client-side, single-render audit and never issues a second signed request. Cloudflare documents Web Bot Auth from the bot operator's side only; no product tells a site owner whether their own stack survives a signed request. This is the roadmap check that ages best, since draft-02 is co-authored by Cloudflare and Google and was refreshed 2026-08-18.

## Implementation sketch

Static-fetch, two requests plus optional key hosting. 1) Baseline: GET / with a neutral UA; record status, length, and headers. 2) Signed probe: identical request plus `Signature-Input: sig1=("@authority" "@method" "@path");created=<now>;expires=<now+300>;keyid="<JWK thumbprint>";alg="ed25519";nonce="<b64>";tag="web-bot-auth"`, `Signature: sig1=:<base64 sig>:`, and `Signature-Agent: "https://<tool-directory-host>"`. Sign with Ed25519 over the RFC 9421 signature base — node:crypto covers this natively; the signature base construction is ~80 lines. Agent Lighthouse should host its own JWKS at /.well-known/http-message-signatures-directory with media type application/http-message-signatures-directory+json so the probe is honest and resolvable. 3) Compare: fail when the signed request's status is 400, 403, 421 or 431 while the baseline is 2xx, or when signed body length collapses relative to baseline. Report 431 as a distinct finding — it means a header-size limit, fixed differently from a WAF rule. 4) Positive credit (informational, not scored): if the origin answers 401 or 403 carrying an `Accept-Signature` field (RFC 9421 §5.1), it is actively negotiating signatures and is genuinely signed-agent ready. 5) Also check `Vary`: if the site varies behaviour on signature headers without listing them in Vary, a CDN can serve the rejected variant to everyone. 6) Note in guidance that a pass here means 'the door is not nailed shut', not 'signatures are verified' — verification is invisible from outside.

## Example failure

A site fronted by a strict WAF rule that rejects requests with unrecognised headers returns 200 to the baseline GET and 403 to the identical GET carrying `Signature`, `Signature-Input` and `Signature-Agent`. Every Web Bot Auth-signed agent — precisely the well-behaved, cryptographically identifiable population the operator would want to allow — is rejected before any verification can occur, and nothing in the site's config names this as an AI-access decision.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed.** `signed-agent-web-bot-auth-request-tolerance` makes a 64-character
id — exactly at the cap, with no room for the category prefix to change. It
ships as `web-bot-auth-request-tolerance`.

**No hosted key directory.** The sketch says Agent Lighthouse should host its
own JWKS at `/.well-known/http-message-signatures-directory` so the probe is
resolvable. This tool is a library and a CLI, not a service: it has no origin to
host anything at, and a URL in a `Signature-Agent` header pointing at a
directory that does not exist would be a claim the tool cannot back.

The probe therefore signs with an Ed25519 key generated for the scan and thrown
away, and `Signature-Agent` names the repository. The question the audit asks is
unaffected: it is whether an origin refuses a request *because* it carries
RFC 9421 signature headers, and an edge that rejects on the presence of those
headers rejects an unverifiable key exactly as it rejects a verifiable one. What
the probe cannot tell you — and the guidance says so — is whether an origin that
lets the request through would have verified the signature. That is invisible
from outside.

**The signature base is written out, not templated.** The bytes signed are the
four lines RFC 9421 specifies for `("@authority" "@method" "@path")` plus
`@signature-params`. A test pins the exact string, because a signature over
almost-the-right-base is a signature no verifier accepts.

**A 401 or 403 carrying `Accept-Signature` passes.** The sketch calls it
informational positive credit. An origin asking for a signature it can verify is
the opposite of one refusing signatures, so treating it as a failure would
report the best-configured sites as the worst.

**Statuses.** 400, 403 and 421 fail; 431 fails with its own message, because a
header-size limit is fixed by raising a limit rather than by changing a WAF
rule; a 2xx whose body falls under 40% of the baseline fails; a differing answer
with no `Vary` naming the signature headers warns.

## Deferred

- **Verifying our own signature end to end.** `signedHeaders` throws the private
  key away, so the test asserts the signature's shape and length rather than
  round-tripping it. Returning the key to make that possible would put a private
  key in an audit's return value.
- **Probing more than the site root.** One signed request per scan. A WAF rule
  scoped to a path this probe does not touch is not seen.
- **`Signature-Agent` directory resolution.** RFC 9421 §5.1 lets an origin fetch
  the agent's key directory. Nothing here hosts one, so an origin that tries
  finds a repository page.
