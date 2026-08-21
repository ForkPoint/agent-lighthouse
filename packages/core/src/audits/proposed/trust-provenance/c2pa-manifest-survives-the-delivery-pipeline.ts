import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "C2PA manifest survives the delivery pipeline".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Collect candidate image URLs from <img src>, every <img>/<source> srcset candidate,
// og:image/twitter:image, and JSON-LD image/logo/primaryImageOfPage. 2) For each, GET the bytes
// (Range-limited first pass is unsafe — JPEG APP11 can sit mid-file per C2PA spec, so fetch fully
// but cap at ~5MB). 3) Detect the manifest store per container: JPEG scan APP11 (0xFFEB) segments
// for the 'JP' identifier wrapping a JUMBF box; PNG scan for the C2PA chunk carrying the JUMBF
// store; WebP scan RIFF for the C2PA chunk; AVIF/HEIF scan BMFF for the C2PA uuid box. Prefer
// shelling out to c2patool / binding c2pa-rs via its C API rather than reimplementing JUMBF+COSE.
// 4) Derive origin-vs-variant pairs: for /_next/image?url=X and /cdn-cgi/image/<opts>/X, decode X
// as the origin; for WordPress -WxH.jpg suffixes, strip to the base upload. 5) Emit
// manifestCoverage = signed images / total images, and strippedInTransit = pairs where origin has a
// manifest and variant does not. 6) Report a HIGH finding for strippedInTransit > 0, INFO when the
// whole site has zero manifests (nothing to strip). Sample 2-3 images per page template rather than
// every asset.
export class C2paManifestSurvivesTheDeliveryPipelineAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/c2pa-manifest-survives-the-delivery-pipeline',
    category: 'trust-provenance',
    title: "C2PA manifest survives the delivery pipeline",
    failureTitle: "C2PA manifest survives the delivery pipeline",
    description: "Detects the single most common provenance failure: a publisher signs images at creation, then the CDN/image optimizer silently discards the Content Credentials, so every byte an agent or crawler actually downloads is unsigned. Compares provenance on origin assets against the transformed variants that are really served (srcset candidates, /_next/image, /cdn-cgi/image/, imgix/Cloudinary renditions).",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Image transformation pipelines strip C2PA manifests by default. Cloudflare states it outright: 'When this setting is disabled, any existing Content Credentials will always be discarded' — preservation is an opt-in toggle. Therefore, for any site whose images pass through a transformation layer without explicit preservation enabled, the served variant carries no manifest even when the origin asset does. FALSIFIABLE: fetch the origin asset and the served variant; if the origin contains a C2PA manifest store and the variant does not, the pipeline is stripping provenance. The check fails if variants are found to retain manifests without any preservation setting, or if origin and variant provenance always agree.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/c2pa-manifest-survives-the-delivery-pipeline.md',
      'TODO stub',
    );
  }
}
