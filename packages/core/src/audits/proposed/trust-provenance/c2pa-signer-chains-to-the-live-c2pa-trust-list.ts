import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "C2PA signer chains to the live C2PA Trust List".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Reuse the manifest stores extracted by the pipeline-survival check. 2) Run validation via
// c2patool or c2pa-rs bindings and read the validation status codes; treat any signingCredential
// untrusted/expired/revoked status as FAIL. 3) Pin the trust list at build time: the C2PA
// Conformance Explorer publishes the C2PA Trust List, TSA Trust List and Conforming Products List
// as JSON on GitHub — resolve the exact path once from c2pa.org/conformance/ and vendor the JSON
// with a refresh job rather than hardcoding a guessed URL. 4) Classify each manifest: TRUSTED
// (chains to C2PA TL), LEGACY_ITL (chains only to the frozen interim list — WARN, will not be
// renewed), UNTRUSTED (self-signed / unknown root — FAIL). 5) Also assert the timestamp authority
// is on the TSA trust list, so credentials stay valid past certificate expiry. 6) Bonus signal:
// report presence of a CAWG identity assertion, which binds a named creator identity rather than
// only a signing tool.
export class C2paSignerChainsToTheLiveC2paTrustListAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list',
    category: 'trust-provenance',
    title: "C2PA signer chains to the live C2PA Trust List",
    failureTitle: "C2PA signer chains to the live C2PA Trust List",
    description: "A manifest that exists is not a manifest that verifies. Grades the signing certificate behind each Content Credential: trusted (on the official C2PA Trust List), legacy (Interim Trust List, frozen 2026-01-01), or untrusted (self-signed, expired, or unknown CA) — and separately reports whether a CAWG identity assertion binds a real named creator.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Conforming C2PA validators resolve the signing certificate against the published C2PA Trust List. The Interim Trust List was frozen on 2026-01-01: no new entries are accepted and legacy ITL certificates are not renewed, and C2PA explicitly urges products to distinguish ITL-era credentials from conforming-product credentials. Therefore an asset signed with a self-signed or ITL-legacy certificate will surface as untrusted/unknown-signer in any conforming validator, regardless of how well-formed the manifest is. FALSIFIABLE: extract the x5chain from the COSE signature and attempt a chain build to the trust list; the check is wrong if untrusted-signer manifests validate cleanly in conforming tools.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/c2pa-signer-chains-to-the-live-c2pa-trust-list.md',
      'TODO stub',
    );
  }
}
