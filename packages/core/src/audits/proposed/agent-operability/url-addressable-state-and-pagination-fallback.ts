import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "URL-Addressable State and Pagination Fallback".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/url-addressable-state-and-pagination-fallback.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Multi-page crawl. For each listing/collection page: (1) count items present in the initial HTML
// and compare against a declared total (result-count text, or schema.org numberOfItems); (2) look
// for real pagination — <a href> page links, <link rel="next">, or a URL parameter matching
// /page|offset|start|p=|from=/ that changes results when varied; (3) detect infinite-scroll
// machinery (IntersectionObserver sentinel div near the list end, class matching
// /infinite|load-more|sentinel/, or a 'Load more' button) and fail when it is present with no
// href-based fallback. Note that a 'Load more' <button> scores better than a pure scroll sentinel
// but worse than href pagination, since it is at least a discrete action. Separately, for faceted
// listings, fetch the page with each facet's declared value as a query parameter and verify the
// server returns filtered results (facet is URL-addressable) versus identical unfiltered HTML
// (facet is client-only). Headless tier extends this to tabs and modals by clicking each and
// asserting location.href changed. Report the deepest item index reachable by URL alone.
export class UrlAddressableStateAndPaginationFallbackAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/url-addressable-state-and-pagination-fallback',
    category: 'agent-operability',
    title: "URL-Addressable State and Pagination Fallback",
    failureTitle: "URL-Addressable State and Pagination Fallback",
    description: "Checks that every distinct content state a task might need to reach — page N of a listing, an applied filter set, a selected tab, an opened detail view — is reachable by navigating to a URL, and that infinitely-scrolled collections expose a crawlable/enumerable alternative.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: an agent's dominant recovery primitive is re-navigation. When a step fails, context is truncated, or a fresh session resumes a task, the agent re-enters the state by going to a URL; if the state lives only in JS memory, recovery requires replaying the entire interaction sequence from the homepage, consuming the step budget. WebVoyager attributes 44.4% of all failures to navigation-stuck, explicitly citing exhausted step budgets and difficulty locating the correct scrollable area. Test: expose ?page=N and filter params on the same listing; the number of actions to reach item #180 drops from ~30 scroll-and-wait cycles to one navigation.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/url-addressable-state-and-pagination-fallback.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/url-addressable-state-and-pagination-fallback.md',
      'TODO stub',
    );
  }
}
