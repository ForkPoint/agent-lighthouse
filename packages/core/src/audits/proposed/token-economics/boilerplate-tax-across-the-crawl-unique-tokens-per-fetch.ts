import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Boilerplate tax across the crawl (unique tokens per fetch)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Reuse the existing multi-page crawl. For each sampled URL keep the extracted main content and the
// full delivered token count from the Signal Density check. Build a 5-gram shingle index across the
// sample; mark shingles with document frequency ≥ 0.8 as boilerplate. Per page: boilerplate tokens,
// unique tokens, ratio. Site roll-up: total delivered tokens, total unique tokens, unique-per-fetch
// median. Stratify the sample by URL path depth and by detected template so a large blog does not
// swamp the commerce templates. Present the headline as 'an agent reading 10 pages of this site
// pays N tokens to receive M tokens of distinct information'.
export class BoilerplateTaxAcrossTheCrawlUniqueTokensPerFetchAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch',
    category: 'token-economics',
    title: "Boilerplate tax across the crawl (unique tokens per fetch)",
    failureTitle: "Boilerplate tax across the crawl (unique tokens per fetch)",
    description: "Site-level rather than page-level: sample 10-30 URLs across templates, identify shingles present on ≥80% of sampled pages (the repeated chrome), and report boilerplate token share, unique tokens per fetch, and total tokens an agent must spend to acquire the site's distinct information. Fail if unique content is < 20% of tokens fetched, or if median unique tokens per page < 300 (thin pages that force many fetches for little yield). Emit a cost line in tokens and, optionally, dollars at a user-supplied per-million rate.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "An agent answering a question rarely fetches one page; it fetches several and pays for the site's nav, footer, cookie banner, promo rail and legal boilerplate once per fetch. Per-fetch yield is already the binding constraint for these clients — measured crawler traffic shows roughly a third of AI-crawler fetches landing on 404s, an order of magnitude worse than Googlebot — so a site whose useful payload is a thin slice of each response multiplies an existing efficiency problem. The falsifiable claim: repeated shingles are mechanically identifiable across a sample, and the tokens they occupy are, by construction, information the agent already has after the first fetch. This check is also what makes the llms-full.txt / markdown-alternate recommendation quantitative rather than fashionable — it prices what the alternate would save.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/boilerplate-tax-across-the-crawl-unique-tokens-per-fetch.md',
      'TODO stub',
    );
  }
}
