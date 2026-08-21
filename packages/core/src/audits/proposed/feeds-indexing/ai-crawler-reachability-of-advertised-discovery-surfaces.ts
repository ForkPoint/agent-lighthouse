import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "AI-crawler reachability of advertised discovery surfaces".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/ai-crawler-reachability-of-advertised-discovery-surfaces.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Fetch /robots.txt; parse into UA groups with correct longest-match group selection and
// longest-match rule precedence, including $ and * wildcards, and record whether a named group
// exists per UA (named group present => '*' rules do not apply). 2) UA panel: GPTBot,
// OAI-SearchBot, OAI-AdsBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot,
// Perplexity-User, Google-Extended, Googlebot, Bingbot, Amazonbot, Applebot-Extended,
// meta-externalagent, CCBot, Bytespider. 3) Collect advertised surfaces: every Sitemap: URL,
// /sitemap.xml, and every <link rel="alternate"
// type="application/rss+xml|application/atom+xml|application/feed+json"> href on the homepage and
// on one article page. 4) Reservoir-sample 50 URLs from the sitemap tree. 5) For each UA emit:
// sitemap_file_allowed (bool), feed_files_allowed (bool per feed), sitemap_url_coverage (% of the
// 50 allowed). 6) FAIL conditions: any UA where a Sitemap: directive advertises a path that the
// same robots.txt disallows for that UA (explicit self-contradiction — report the exact conflicting
// lines); any UA in the panel with sitemap_url_coverage < 50% while the '*' group would have
// allowed them (i.e. the named group is strictly more restrictive); any feed advertised via <link
// rel=alternate> but disallowed. 7) WARN when a named AI group exists with Disallow: / — that is a
// deliberate opt-out, so report it as a policy statement, not a defect, and suppress downstream
// AI-readiness scoring for that agent.
export class AiCrawlerReachabilityOfAdvertisedDiscoverySurfacesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/ai-crawler-reachability-of-advertised-discovery-surfaces',
    category: 'feeds-indexing',
    title: "AI-crawler reachability of advertised discovery surfaces",
    failureTitle: "AI-crawler reachability of advertised discovery surfaces",
    description: "Evaluates robots.txt per named AI user-agent against the exact URLs the site advertises for indexing — the Sitemap: targets, the autodiscovered RSS/Atom feeds, and a sample of URLs listed inside the sitemap — and flags the self-contradiction of advertising a discovery surface that the same file forbids.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The robots.txt Sitemap: directive is host-global and user-agent independent, but the sitemap file itself, the feed files, and every URL they list are subject to per-UA Disallow rules, and under the group-matching rule a crawler that matches a named group ignores the '*' group entirely. OpenAI documents the consequence at the extreme: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' Falsifiable claim: for any UA whose named group disallows the advertised sitemap/feed path or a majority of the URLs it lists, the site's entire pull-indexing surface is unreachable by that agent regardless of sitemap quality. The high-frequency real-world trigger is a broad pattern (Disallow: /*.xml$, Disallow: /feed/, Disallow: /) added to an AI-bot group by a bot-blocking plugin while the site simultaneously advertises those exact paths.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/ai-crawler-reachability-of-advertised-discovery-surfaces.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/ai-crawler-reachability-of-advertised-discovery-surfaces.md',
      'TODO stub',
    );
  }
}
