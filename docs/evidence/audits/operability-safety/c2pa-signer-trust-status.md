---
audit: operability-safety/c2pa-signer-trust-status
category: operability-safety
source_file: packages/core/src/audits/operability-safety/c2pa-signer-trust-status.ts
slug: c2pa-signer-trust-status
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - c2pa-spec-2-4
  - c2pa-trust-lists
  - google-c2pa-transparency
---

# C2PA signing certificate status

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

A manifest that exists is not a manifest that verifies. For each sampled image that carries a C2PA manifest store, the audit reads the signing certificate out of the store and reports what the certificate itself states. It sorts each signer into one of these outcomes:

- **Fails:** the certificate is self-signed, or its validity period has not started, or its validity period is empty, or it has expired and the store carries no time-stamp.
- **Warns:** the certificate is CA-issued and has expired, but the store carries a time-stamp. The audit does not read the time-stamp, so it cannot tell whether the signature was made inside the validity period.
- **Warns:** the certificate is CA-issued and inside its validity period, but the store carries no time-stamp.
- **Warns:** a manifest is present but no certificate can be read from it.
- **Passes:** the certificate is CA-issued, inside its validity period, and the store carries a time-stamp.

The audit does not check whether the issuing CA is on the C2PA Trust List. A CA-issued certificate that passes here can still be untrusted by a conforming validator.

## Claimed mechanism (falsifiable)

A conforming C2PA validator builds a chain of trust from the signing certificate to a trust anchor. If it cannot, the specification says the claim "shall be rejected with a failure code of `signingCredential.untrusted`". The anchors on the C2PA Trust List are certification authorities, and a validator "shall not be pre-configured" with any individual signing credentials. A self-signed certificate therefore has no default path to an anchor. A signature made outside the certificate's validity period fails with `claimSignature.outsideValidity`, and "manifests without time-stamps cease to be valid when the signing credential expires or becomes revoked". A time-stamp changes the clock: when one is "present, trusted, and validated", validators "shall use the attested time, and not the current time" to judge the certificate's validity. An expired certificate with a time-stamp can therefore still validate. The specification tells consumers not to display data from manifests that are not valid. Google states it will validate content against the C2PA Trust List.

FALSIFIABLE: the claim is wrong if a conforming validator, with its default configuration, accepts a manifest signed by a self-signed certificate, or by an expired certificate with no time-stamp.

## Evidence

- **[C2PA Technical Specification 2.4](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html)** — C2PA (spec, verified 2026-10-17)
  - Validation: "If a chain of trust cannot be verified, the claim shall be rejected with a failure code of signingCredential.untrusted." That code means "The signing credential is not listed on any of the validator's applicable trust lists."
  - Private credential store (14.4.3): a user may trust an individual signer by hand, but "A validator shall not be pre-configured with any entries in a private credential store."
  - `claimSignature.outsideValidity`: "The claim signature referenced in the claim was created outside the validity period of the signing credential."
  - Time-stamps (10.3.2.5.1): "manifests without time-stamps cease to be valid when the signing credential expires or becomes revoked." Time-stamps sit in the COSE header labelled `sigTst` or `sigTst2`.
  - Validating the time-stamp (15.8.2): "when a time-stamp is present, trusted, and validated, validators shall use the attested time, and not the current time, when determining the time validity of the signing certificate". Without a usable time-stamp, the manifest is valid only "if the current time at validation is within the validity period of the signer's certificate". That is why an expired signer with a time-stamp warns rather than fails.
  - Display (15.3): "Manifest Consumers should not display data from manifests which are not Valid".
  - Certificates (14.5): the `x5chain` header carries the signer's certificate first, then the certificates that issued it. This is where the audit finds the certificate.
- **[Trust lists](https://opensource.contentauthenticity.org/docs/conformance/trust-lists)** — Content Authenticity Initiative, C2PA conformance docs (vendor-doc, verified 2026-10-17)
  - The C2PA Trust List is "a list of X.509 certificate trust anchors". Conforming validators must "refer to the C2PA trust list to determine whether" Content Credentials were signed with a valid certificate.
  - The Interim Trust List was frozen on January 1, 2026. Content signed during an ITL certificate's validity period stays valid under the legacy trust model.
- **[How we're increasing transparency for gen AI content with the C2PA](https://blog.google/innovation-and-ai/products/google-gen-ai-content-transparency-c2pa/)** — Google (announcement, verified 2026-10-17)
  - "We will ensure that our implementations validate content against the forthcoming C2PA Trust list, which allows platforms to confirm the content's origin." The named surfaces are "About this image" in Google Images, Lens and Circle to Search, and Google's ad systems.

**Counter-evidence:** The audit checks only what the certificate states about itself. It does not build a chain to the C2PA Trust List, check revocation, or validate the time-stamp, so a pass is necessary rather than sufficient. An expired certificate with a time-stamp only warns, because the audit cannot tell whether the attested time falls inside the validity period; a time-stamp made after expiry would fail in a real validator. Self-signed is judged by the subject and issuer names matching. The Google source is a 2024 announcement in the future tense. No source documents an AI agent that fetches a page and validates the C2PA signer of its images.

## Scoring

**Grade: B** — the C2PA specification is a published, versioned industry specification with a conformance programme and trust list, not a ratified standards-body document. Its validation rules are normative for conforming validators, and Google names its consumer surfaces and states it validates against the trust list. That meets the policy's B bar: a draft-status standard with meaningful adoption. It falls short of A because no vendor documents an AI agent consuming the signal.

The audit fails when any sampled signer is self-signed, not yet valid, never valid, or expired with no time-stamp. It warns when a certificate cannot be read, when an expired CA-issued certificate carries a time-stamp, or when a valid CA-issued certificate has no time-stamp. A site with no image carrying a manifest is `notApplicable`.

## Example failure

A brand runs an in-house signing script with a self-generated certificate. Every product photo carries a well-formed manifest, and internal tooling shows a green check because it trusts the company's own root. A conforming validator with its default configuration finds no chain to a trust anchor and rejects the signer as `signingCredential.untrusted`, so the provenance claim carries no third-party weight.

## Implementation deviations

- The original proposal title, "C2PA signer chains to the live C2PA Trust List", promised more than the audit delivers. The dossier title now names what it checks.
- The audit reports only what the signing certificate states: self-signed or CA-issued, inside or outside its validity window, and whether a timestamp token is present. A test asserts no output claims the certificate is trusted or chains to anything.
- Certificates are found by DER shape, not by decoding COSE. The audit scans the store for the `30 82` SEQUENCE header and hands each candidate to Node's `X509Certificate`, which rejects anything else.
- A CA-issued certificate with no RFC 3161 timestamp warns rather than passes. Without one the credential stops validating when the certificate expires.
- An expired CA-issued certificate warns, not fails, when the store carries a `sigTst` or `sigTst2` label (spec 15.8.2). The time-stamp token is not decoded, so the attested time cannot be compared with the validity period. A certificate whose `notAfter` precedes its `notBefore` was never valid, so no time-stamp can save it; it still fails.
- The self-signed message says no validator trusts the certificate "by default". Spec 14.4.3 lets a user trust one signer by hand in a private credential store.
- Image fetches are shared with `c2pa-manifest-survives-delivery` through the per-scan cache in `gatherers/media.ts`.

## Deferred

- Trust List membership. It needs the C2PA Trust List, the TSA Trust List and the Conforming Products List vendored with a refresh job, plus an X.509 path builder.
- The LEGACY_ITL classification. It depends on the vendored lists.
- CAWG identity assertions. They need a real JUMBF parse.
- Revocation. No OCSP or CRL check is made.
