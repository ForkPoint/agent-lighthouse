import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Markdown alternate: discoverable, resolvable, faithful, cheaper".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// For each audited URL: HEAD/GET url+'.md'; GET url with Accept: text/markdown; inspect response
// Link header and <link> elements. Assert Content-Type per RFC 7763 (accept a charset and optional
// variant parameter; reject text/plain and text/html). Tokenize the markdown body and the HTML body
// at o200k_base for the savings ratio. Fidelity: run readability on the HTML, extract headings via
// a markdown AST (remark), compare heading sets and 5-gram shingle recall. Tolerate MDX/JSX
// component tags in the markdown body when computing fidelity (real-world alternates contain them)
// but flag them separately as a minor deduction, since unresolved custom components are content the
// agent cannot interpret.
export class MarkdownAlternateDiscoverableResolvableFaithfulCheaperAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper',
    category: 'token-economics',
    title: "Markdown alternate: discoverable, resolvable, faithful, cheaper",
    failureTitle: "Markdown alternate: discoverable, resolvable, faithful, cheaper",
    description: "Audit the per-page markdown alternate as four independently reported assertions rather than a presence check. (a) Discoverable: an HTTP `Link: <...>; rel=\"alternate\"; type=\"text/markdown\"` header or a <link rel=alternate type=text/markdown> element, or the URL is listed with a .md extension in llms.txt. (b) Resolvable: url+'.md' (and, separately, GET with Accept: text/markdown) returns 200 with Content-Type text/markdown and, for negotiated responses, a Vary: Accept header. (c) Faithful: title matches, ≥90% of h1/h2 headings from the HTML extraction are present, and ≥0.8 body shingle recall — i.e. not a stub, not a 404 SPA shell served as 200. (d) Cheaper: markdown tokens ≤ 35% of raw HTML tokens. Report the measured savings percentage as the headline number.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The convention is specified (clean markdown at the same URL with .md appended) with an explicitly token-economic rationale — every wasted token costs time and money — and it is deployed in production by at least one docs platform and a major AI vendor's own documentation, including header-based advertisement. The falsifiable claim is per-assertion: a .md that 404s, or returns text/html, or returns a 12-token stub, or is not linked from anywhere, provides no token savings to any agent, and each of those failure modes is detectable with two HTTP requests. Failure (c) is the one that actually bites in the field: sites generate .md alternates from a template and silently ship empty or truncated bodies.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/markdown-alternate-discoverable-resolvable-faithful-cheaper.md',
      'TODO stub',
    );
  }
}
