import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Root text-file resolution integrity (IndexNow key-file precondition)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) GET https://{host}/{32 lowercase hex}.txt with a cache-busting random name, no-cache headers,
// following <=3 redirects. Assert final status in {404,410}. 2) Repeat once with a second random
// name to exclude a coincidental real file. 3) If either returns 2xx, classify: body starts with
// '<' or contains '<html' in the first 512 bytes -> 'SPA/HTML catch-all'; Content-Type is text/html
// -> 'wrong content type'; body identical between the two random probes -> 'static catch-all'. 4)
// Positive control: GET /robots.txt and assert 200 with Content-Type starting 'text/plain' (some
// CDNs rewrite it to application/octet-stream or text/html, which breaks strict parsers). 5) Emit a
// derived flag 'discovery_probe_reliable' consumed by every other probe-based audit in the tool, so
// llms.txt/ai.txt/security.txt checks downgrade to INDETERMINATE instead of falsely passing. PASS =
// both random probes 404 AND robots.txt is text/plain.
export class RootTextFileResolutionIntegrityIndexnowKeyFilePreconAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon',
    category: 'feeds-indexing',
    title: "Root text-file resolution integrity (IndexNow key-file precondition)",
    failureTitle: "Root text-file resolution integrity (IndexNow key-file precondition)",
    description: "Proves the origin can actually serve and correctly 404 root-level .txt resources — the physical precondition for IndexNow key verification and for every other .txt-based agent discovery surface (llms.txt, ai.txt, security.txt, ads.txt). Sites behind SPA rewrites, WAF challenge pages, or HTML-404-with-200 handlers silently fail all of them.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "IndexNow proves ownership by fetching https://host/{key}.txt and byte-comparing the body to {key}; a non-matching body yields HTTP 403 ('key not found in file') and the submission is discarded by every participating engine (Bing, Yandex, Naver, Seznam, Yep, Amazon). Falsifiable claim: if GET https://host/<random-32-hex>.txt returns 200 rather than 404, the origin has a catch-all that returns non-key content for arbitrary root .txt paths — so key rotation, key removal, and key-file health are undetectable, and the same catch-all makes every probe-based discovery file (llms.txt, ai.txt, security.txt) indistinguishable from a soft-404. Predicts: sites failing this probe cannot be given a trustworthy 'llms.txt present' verdict either, because a 200 response there carries no information.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/root-text-file-resolution-integrity-indexnow-key-file-precon.md',
      'TODO stub',
    );
  }
}
