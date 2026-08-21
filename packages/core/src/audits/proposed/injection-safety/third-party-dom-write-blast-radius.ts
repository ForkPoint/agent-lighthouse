import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Third-Party DOM-Write Blast Radius".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/third-party-dom-write-blast-radius.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Parse Content-Security-Policy from both the response header and <meta http-equiv>. Evaluate
// script-src (falling back to default-src): does it exist; does it use nonce-, sha256/384/512-, or
// 'strict-dynamic'; does it contain 'unsafe-inline', 'unsafe-eval', a bare *, data:, or https: as a
// scheme-wide source (all of which reduce it to decorative). Enumerate <script src> and <link
// rel=stylesheet> whose host differs in eTLD+1 from the document, group by registrable domain, and
// record which carry integrity=. Enumerate cross-origin <iframe> and record whether each has a
// sandbox attribute and whether its dimensions suggest rendered text rather than a tracking pixel.
// Score: FAIL when >=1 third-party script origin exists AND script-src is absent or
// non-constraining AND no third-party script carries integrity. WARN by tier on the count of
// uncontrolled origins (1–3 / 4–9 / 10+). Always emit the actual origin list — the deliverable is
// 'these eleven companies can each write text into what agents read on your site', which is the
// finding a site owner can act on. Headless-browser tier extends this to tags injected at runtime
// by tag managers, which is where the real count usually lives.
export class ThirdPartyDomWriteBlastRadiusAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/third-party-dom-write-blast-radius',
    category: 'injection-safety',
    title: "Third-Party DOM-Write Blast Radius",
    failureTitle: "Third-Party DOM-Write Blast Radius",
    description: "Quantify how many independent parties can inject text into the DOM that an agent will read: count distinct third-party script origins lacking integrity= pinning, evaluate whether a CSP script-src actually constrains them, and enumerate cross-origin iframes lacking sandbox whose text contributes to page reads.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "An agent reads the page after load, so every origin that can execute script on it can decide what the agent sees at read time. SRI exists precisely because 'if an attacker gains control of the third-party host, then they can inject arbitrary malicious content into its files', and CSP script-src exists to bound which scripts run at all. A page with a dozen unpinned, unconstrained third-party tags has a dozen independent parties who can each publish instructions on the owner's domain to every visiting agent, with the owner unable to observe or audit it. Falsifier: a page whose script execution is nonce- or hash-gated and whose third-party subresources are hash-pinned has no unaudited DOM-write path.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/third-party-dom-write-blast-radius.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/third-party-dom-write-blast-radius.md',
      'TODO stub',
    );
  }
}
