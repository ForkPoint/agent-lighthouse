import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Synthetic-media disclosure is valid and self-consistent".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) For each raster image, extract the XMP packet: JPEG APP1 with the http://ns.adobe.com/xap/1.0/
// identifier; PNG iTXt keyed XML:com.adobe.xmp; or scan for <?xpacket begin ... ?> ... <?xpacket
// end?>. 2) Read Iptc4xmpExt:DigitalSourceType in namespace
// http://iptc.org/std/Iptc4xmpExt/2008-02-29/. 3) Fetch and cache the concept list from
// https://cv.iptc.org/newscodes/digitalsourcetype/ ; assert the value is an exact member. Emit a
// targeted FAIL for the near-miss classes: bare conceptId with no URI prefix, https:// where the
// vocabulary uses http://, trailing slash, or a free-text string. 4) Cross-check with C2PA: if the
// asset carries a manifest whose actions assert digitalSourceType trainedAlgorithmicMedia while XMP
// declares digitalCapture (or vice versa), emit a HIGH contradiction finding — the two provenance
// channels on one asset disagree about whether a human took the photo. 5) Report declaredCoverage
// across images as INFO. 6) SCOPE HONESTLY: detecting *undisclosed* synthetic imagery requires a
// classifier and belongs on the roadmap as llm-assisted; this check only grades declarations that
// exist and their internal consistency.
export class SyntheticMediaDisclosureIsValidAndSelfConsistentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent',
    category: 'trust-provenance',
    title: "Synthetic-media disclosure is valid and self-consistent",
    failureTitle: "Synthetic-media disclosure is valid and self-consistent",
    description: "Audits AI-generated-content disclosure at the only layer that is machine-readable and interoperable: the IPTC Iptc4xmpExt:DigitalSourceType XMP property. Catches the two failure modes that make disclosure worthless — malformed values outside the controlled vocabulary, and XMP that contradicts the C2PA manifest on the same asset.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "IPTC types DigitalSourceType as [URI <External>], meaning the value must be a full NewsCodes URI from the ratified controlled vocabulary (base http://cv.iptc.org/newscodes/digitalsourcetype/, note the http scheme), not a bare token. A consumer matching against the vocabulary therefore silently ignores 'AI-generated', 'trainedAlgorithmicMedia' (bare), or an https-scheme variant — the publisher believes it disclosed and every machine reader sees nothing. FALSIFIABLE: parse the XMP packet and test membership in the fetched vocabulary; separately, compare against the digital source type asserted in the asset's C2PA manifest, where a disagreement is a hard contradiction one of the two pipelines produced.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/synthetic-media-disclosure-is-valid-and-self-consistent.md',
      'TODO stub',
    );
  }
}
