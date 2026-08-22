import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

/** Scored: the four properties Meta's and Slack's crawlers document reading. */
const OG_CORE = ['og:title', 'og:description', 'og:image', 'og:url'] as const;

/**
 * Recommended, absorbed from v1 4.8 `og-site-name`. Google's site-names doc
 * names it as one input among several, so a miss is a warn — never the hard
 * fail the standalone audit produced.
 */
const OG_SITE_NAME = 'og:site_name';

/**
 * Values that are present in the markup but carry no site name: the audit's own
 * sample copied verbatim, and unrendered template tokens.
 */
const PLACEHOLDER_SITE_NAMES = new Set(['your site name', 'site name', 'sitename', 'your website']);
const TEMPLATE_TOKEN = /\{\{|\}\}|\{%|\$\{|<%/;

/**
 * Every content-bearing `twitter:*` tag has a documented Open Graph fallback
 * (X Cards Markup Tag Reference, archived Dec 2023), so a missing twitter tag
 * is not a defect when its counterpart is present. Reported, never scored.
 */
const TWITTER_FALLBACK: ReadonlyArray<readonly [string, string]> = [
  ['twitter:card', 'og:type'],
  ['twitter:title', 'og:title'],
  ['twitter:description', 'og:description'],
  ['twitter:image', 'og:image'],
];

type MetaBag = Record<string, string> | undefined;

function tag(meta: MetaBag, name: string): string {
  return (meta?.[name] ?? '').trim();
}

/** True when og:site_name is present but says nothing about the site. */
function isPlaceholderSiteName(value: string): boolean {
  if (TEMPLATE_TOKEN.test(value)) return true;
  return PLACEHOLDER_SITE_NAMES.has(value.toLowerCase());
}

/**
 * The informational half of the merged audit: the twitter:* state of the page,
 * expressed through the og:* fallback rather than as a list of missing tags.
 * Never contributes to the status, the score or the priority.
 */
function twitterReport(meta: MetaBag): string {
  const lines: string[] = ['Twitter Card tags (informational — not scored):'];

  for (const [twitter, fallback] of TWITTER_FALLBACK) {
    const value = tag(meta, twitter);
    if (value) {
      lines.push(`  ${twitter}: present ("${value}")`);
      continue;
    }
    if (tag(meta, fallback)) {
      lines.push(`  ${twitter}: absent — falls back to ${fallback}`);
      continue;
    }
    lines.push(`  ${twitter}: absent — no ${fallback} to fall back to`);
  }

  // The one twitter:* interaction that actually breaks a card: a large-image
  // card with no image to render, from either namespace.
  if (
    tag(meta, 'twitter:card').toLowerCase() === 'summary_large_image' &&
    !tag(meta, 'twitter:image') &&
    !tag(meta, 'og:image')
  ) {
    lines.push('  twitter:card is "summary_large_image" but no image is declared — X renders no image');
  }

  return lines.join('\n');
}

export class CoreOpenGraphAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/core-open-graph',
    category: 'answer-readiness',
    title: 'Core Open Graph tags',
    failureTitle: 'Core Open Graph tags',
    description:
      'Link-preview crawlers — facebookexternalhit and Slack\'s unfurler are documented by name — read og:title, og:description, og:image and og:url to build the card shown when your page is shared, and Google names og:site_name as one input to the site name on a result. This audit scores those Open Graph properties; the Twitter Card tags it also reports are informational only, because every content-bearing twitter:* tag falls back to its og:* counterpart.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/answer-readiness/core-open-graph.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Link-preview crawlers use Open Graph tags to build the card shown wherever your page is shared, and Google uses og:title and og:site_name as inputs to the title link and site name on a result — the same labels that carry into AI Overviews source cards. Without them the crawler falls back to guessing.',
      fix: 'Add all four core OG tags to every page: og:title, og:description, og:image (with an absolute URL), and og:url. Add og:site_name with your real brand name. Twitter Card tags are optional — twitter:title, twitter:description and twitter:image all fall back to their og:* counterparts.',
      code: '<meta property="og:title" content="Page Title">\n<meta property="og:description" content="Page description">\n<meta property="og:image" content="https://yoursite.com/image.png">\n<meta property="og:url" content="https://yoursite.com/page">\n<meta property="og:site_name" content="Your Brand">',
      effort: 'easy',
      docsUrl: 'https://ogp.me/',
      tags: ['meta-tags', 'open-graph', 'social'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    const meta = page?.meta;
    const present: string[] = [];
    const missing: string[] = [];

    for (const property of OG_CORE) {
      if (tag(meta, property)) {
        present.push(property);
      } else {
        missing.push(property);
      }
    }

    const siteName = tag(meta, OG_SITE_NAME);
    const siteNameUsable = Boolean(siteName) && !isPlaceholderSiteName(siteName);

    const ogSummary = present.length > 0 ? `Present: ${present.join(', ')}` : 'None found';
    const siteNameLine = siteNameUsable
      ? `${OG_SITE_NAME}: "${siteName}"`
      : siteName
        ? `${OG_SITE_NAME}: "${siteName}" — placeholder value, treated as missing`
        : `${OG_SITE_NAME}: not found`;
    const found = [ogSummary, siteNameLine, '', twitterReport(meta)].join('\n');

    const expected =
      'og:title, og:description, og:image, og:url all present and non-empty; og:site_name set to the real site name';

    if (missing.length === 0 && siteNameUsable) {
      return this.pass(
        'All core OG tags and og:site_name are present.',
        expected,
        found,
        page.url,
      );
    }

    // Only the recommended tag is missing: a warn, never a fail, and never at
    // the priority the core tags carry.
    if (missing.length === 0) {
      return this.warn(
        siteName
          ? `og:site_name is a placeholder value ("${siteName}").`
          : 'og:site_name is missing.',
        expected,
        found,
        {
          priority: 'low',
          description:
            'Google names og:site_name among the inputs to the site name shown on a result. It is a tiebreaker rather than a lever — the core OG tags on this page are complete.',
          code: '<meta property="og:site_name" content="Your Brand">',
        },
        page?.url,
      );
    }

    const description = `Link-preview crawlers read the core Open Graph tags to build the card shown when your page is shared. Missing tags (${missing.join(', ')}) mean the crawler falls back to guessing your title, text and image.`;
    const code = missing.map((t) => `<meta property="${t}" content="...">`).join('\n');

    if (missing.length < OG_CORE.length) {
      return this.warn(
        `Missing OG tags: ${missing.join(', ')}.`,
        expected,
        found,
        { priority: 'high', description, code },
        page?.url,
      );
    }

    return this.fail(
      `Missing OG tags: ${missing.join(', ')}.`,
      expected,
      found,
      { priority: 'high', description, code },
      page?.url,
    );
  }
}
