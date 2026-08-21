import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Bot-specific content delta declared, not cloaked".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/bot-specific-content-delta-declared-not-cloaked.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Multi-page, no JS required. 1) Sample 3-5 content URLs (sitemap or internal links), preferring
// article/product pages. 2) For each, fetch with baseline Chrome UA and with GPTBot/1.4, ClaudeBot
// and PerplexityBot, identical headers otherwise. 3) Extract main text with the existing parser;
// normalise whitespace and strip nav/footer. 4) Compute (a) character-count ratio bot/browser and
// (b) 5-gram shingle Jaccard similarity. Flag a delta when ratio < 0.6 or Jaccard < 0.7 — two
// metrics because a stub and a reordered-but-equivalent page look identical on length alone. 5)
// When a delta is found, parse JSON-LD from the browser response and require: a CreativeWork
// subtype (Article, NewsArticle, Blog, WebPage, Course, HowTo, Review, Comment, Message) with
// `isAccessibleForFree: false`, plus a `hasPart` of `@type: WebPageElement` with
// `isAccessibleForFree: false` and a `cssSelector`. 6) Then verify the selector actually resolves —
// run it against the served DOM with cheerio; a selector matching zero elements is a silent no-op
// and should be its own finding. 7) Verdict: pass when there is no delta, or a delta with complete
// and resolving markup. Fail on delta without markup. Separately flag the inverse case (bot text
// materially LONGER than browser text), which indicates a bot-only keyword-stuffed variant.
export class BotSpecificContentDeltaDeclaredNotCloakedAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/bot-specific-content-delta-declared-not-cloaked',
    category: 'bot-auth-access',
    title: "Bot-specific content delta declared, not cloaked",
    failureTitle: "Bot-specific content delta declared, not cloaked",
    description: "Measures whether the site serves materially different content to AI crawler user-agents than to a browser, and — when it does — whether that difference is declared with the structured data Google specifies for restricted content. Undeclared UA-conditional serving is cloaking, and it also means answer engines cite your paywall stub instead of your article.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google states that `isAccessibleForFree: false` with `hasPart`/`cssSelector` markup 'helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies' (s15) — that is, serving a crawler less than a user is sanctioned *only* when declared. Falsifiable and directly measurable: extract main text for URL U under a browser UA and under crawler UA C; if len(text_C)/len(text_browser) falls below threshold (or shingle Jaccard drops below ~0.7), the site conditions content on UA. The declaration is equally checkable — and, importantly, the declared `cssSelector` must match a real element in the served HTML, which is where most implementations silently fail.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/bot-specific-content-delta-declared-not-cloaked.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/bot-specific-content-delta-declared-not-cloaked.md',
      'TODO stub',
    );
  }
}
