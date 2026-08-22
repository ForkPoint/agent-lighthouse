// Graduated from proposal 2026-08-22 (Plan 5, Task 24).
// Evidence dossier: docs/evidence/audits/access-crawl-control/bot-content-delta-declared.md
//
// Serving a crawler less than a reader is sanctioned only when it is declared:
// Google's paywalled-content markup is what "differentiates paywalled content
// from the practice of cloaking". Undeclared UA-conditional serving is cloaking,
// and it also means answer engines cite the stub instead of the article.
import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { parseHtml, extractJsonLd, flattenJsonLd } from '../../parser';
import { siteSitemapTree, sampleEntries } from '../../gatherers/sitemap';
import { AI_CRAWLER_UAS, sharedUaProbes, type UaProbe } from '../../gatherers/ua-parity';

/** How many content URLs to compare. */
const MAX_URLS = 3;
/** The crawlers whose UA strings are compared against the browser baseline. */
const TOKENS = ['gptbot', 'claudebot', 'perplexitybot'];
/** Below this share of the browser text, the crawler is being served a different page. */
const LENGTH_FLOOR = 0.6;
/** Below this shingle similarity, the text differs even at an equal length. */
const JACCARD_FLOOR = 0.7;
/** Above this share, the crawler is being served a variant of its own. */
const LONGER_CEILING = 1.25;
/** Words per shingle. */
const SHINGLE_N = 5;
/** How many findings a message lists before it summarises. */
const MAX_SHOWN = 4;

/** CreativeWork subtypes Google's paywalled-content markup accepts. */
const CREATIVE_WORKS = new Set([
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Blog',
  'WebPage',
  'Course',
  'HowTo',
  'Review',
  'Comment',
  'Message',
  'ScholarlyArticle',
  'TechArticle',
  'Report',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

/** schema.org booleans arrive as booleans and as the strings "False"/"false". */
function isFalse(value: unknown): boolean {
  if (typeof value === 'boolean') return !value;
  return typeof value === 'string' && value.trim().toLowerCase() === 'false';
}

function shingles(text: string): Set<string> {
  const words = text.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const out = new Set<string>();
  if (words.length < SHINGLE_N) {
    for (const word of words) out.add(word);
    return out;
  }
  for (let i = 0; i + SHINGLE_N <= words.length; i += 1) {
    out.add(words.slice(i, i + SHINGLE_N).join(' '));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 1 : shared / union;
}

interface Declaration {
  /** Complete paywalled-content markup was found. */
  declared: boolean;
  selector?: string;
  /** Whether that selector matches anything in the DOM a browser was served. */
  resolves?: boolean;
}

/**
 * Read Google's restricted-content declaration out of the browser response, and
 * check the selector against the DOM that response actually carried.
 *
 * A selector matching zero elements is where most implementations fail: the
 * markup is present, it validates, and it points at nothing.
 */
function declaration(body: string): Declaration {
  const $ = parseHtml(body);
  for (const node of flattenJsonLd(extractJsonLd($))) {
    if (!isObject(node)) continue;
    if (!typesOf(node).some((type) => CREATIVE_WORKS.has(type))) continue;
    if (!isFalse(node['isAccessibleForFree'])) continue;

    const parts = Array.isArray(node['hasPart']) ? node['hasPart'] : [node['hasPart']];
    for (const raw of parts) {
      if (!isObject(raw)) continue;
      if (!typesOf(raw).includes('WebPageElement')) continue;
      if (!isFalse(raw['isAccessibleForFree'])) continue;
      const selector = typeof raw['cssSelector'] === 'string' ? raw['cssSelector'].trim() : '';
      if (!selector) continue;

      let resolves = false;
      try {
        resolves = cheerio.load(body)(selector).length > 0;
      } catch {
        // An unparseable selector resolves to nothing, which is the finding.
        resolves = false;
      }
      return { declared: true, selector, resolves };
    }
  }
  return { declared: false };
}

function labelFor(token: string): string {
  return AI_CRAWLER_UAS.find((agent) => agent.token === token)?.label ?? token;
}

/**
 * A probe this audit can compare.
 *
 * `soft-block` is deliberately included: the edge-parity gatherer gives that
 * class to a 200 carrying a fraction of the text, which is exactly the delta
 * this audit exists to adjudicate. Every other block class means the crawler
 * never got a page, and access-crawl-control/ai-crawler-edge-parity reports it.
 */
function usable(probe: UaProbe): boolean {
  return (
    (probe.blockClass === 'ok' || probe.blockClass === 'soft-block') &&
    probe.probeStatus >= 200 &&
    probe.probeStatus < 300 &&
    probe.baselineText.length > 0
  );
}

const EXPECTED =
  'AI crawlers receive the same main content a browser receives, or the difference is declared with isAccessibleForFree:false and a hasPart WebPageElement whose cssSelector resolves in the served DOM';

const SAMPLE = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How resoling works",
  "isAccessibleForFree": false,
  "hasPart": {
    "@type": "WebPageElement",
    "isAccessibleForFree": false,
    "cssSelector": ".paywalled-body"
  }
}
</script>

<!-- and the selector must match the element the crawler does not get: -->
<div class="paywalled-body">…the restricted body…</div>`;

export class BotContentDeltaDeclaredAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/bot-content-delta-declared',
    category: 'access-crawl-control',
    title: 'Content served to AI crawlers matches the browser, or is declared',
    failureTitle: 'AI crawlers get different content with nothing declaring it',
    description:
      "Fetches sampled content URLs as a browser and as GPTBot, ClaudeBot and PerplexityBot, then measures the difference two ways — main-text length ratio and 5-gram shingle similarity — because a stub and a rewritten page look identical on length alone. Where a difference exists, requires Google's restricted-content markup and checks that the declared cssSelector resolves against the served DOM.",
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/bot-content-delta-declared.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "Google states that isAccessibleForFree: false with hasPart/cssSelector markup 'helps Google differentiate paywalled content from the practice of cloaking, which violates spam policies' — serving a crawler less than a user is sanctioned only when it is declared. The measurement is falsifiable both ways: extract the main text of URL U under a browser UA and under crawler UA C, and if the length ratio falls below 0.6 or the 5-gram shingle similarity below 0.7, the site conditions content on the User-Agent. The declaration is equally checkable, and the declared cssSelector must match a real element in the served HTML — which is where most implementations silently fail, leaving markup that validates and points at nothing. The second-order cost is not the spam risk: an answer engine that only ever sees the stub cites the stub.",
      fix: 'Decide which of the two you mean. If the crawler should see the whole page, stop conditioning the response on the User-Agent — serve the same main content and let robots.txt carry the policy. If part of the page is genuinely restricted, declare it: put isAccessibleForFree: false on the Article (or other CreativeWork) and add a hasPart WebPageElement with isAccessibleForFree: false and a cssSelector, then verify that selector matches the element in the HTML you actually serve. A selector that matches nothing is markup with no effect. Never serve a crawler a longer, keyword-heavy variant of the page: that is the case the spam policies name outright.',
      code: SAMPLE,
      effort: 'complex',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/access-crawl-control/bot-content-delta-declared.md',
      tags: ['cloaking', 'paywall', 'crawlers', 'structured-data'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const tree = await siteSitemapTree(ctx);
    const urls = sampleEntries(tree.entries, MAX_URLS).map((entry) => entry.loc);

    if (urls.length === 0) {
      return this.notApplicable(
        'No content URL could be sampled from the sitemap, so there is nothing to compare between a browser and a crawler.',
        EXPECTED,
        'No sampled content URL',
      );
    }

    const probes = await sharedUaProbes(ctx, urls, TOKENS);
    const comparable = probes.filter(usable);

    if (comparable.length === 0) {
      return this.notApplicable(
        'No crawler probe returned a readable page to compare against the browser response; access-crawl-control/ai-crawler-edge-parity reports blocked crawlers.',
        EXPECTED,
        `${probes.length} probe(s), none comparable`,
      );
    }

    const findings: string[] = [];
    let declared = 0;

    for (const probe of comparable) {
      const label = labelFor(probe.token);
      const ratio = probe.probeText.length / probe.baselineText.length;
      const similarity = jaccard(shingles(probe.baselineText), shingles(probe.probeText));
      const metrics = `${Math.round(ratio * 100)}% of the browser text, shingle similarity ${similarity.toFixed(2)}`;

      if (ratio > LONGER_CEILING) {
        findings.push(
          `${label} receives a longer page than the browser at ${probe.url} (${metrics}) — a bot-only variant`,
        );
      }

      if (ratio >= LENGTH_FLOOR && similarity >= JACCARD_FLOOR) continue;

      const declaration_ = declaration(probe.baselineBody);
      if (!declaration_.declared) {
        findings.push(
          `${label} gets different content at ${probe.url} (${metrics}) and nothing declares it: the browser response carries no CreativeWork with isAccessibleForFree:false and a hasPart WebPageElement cssSelector`,
        );
        continue;
      }
      if (!declaration_.resolves) {
        findings.push(
          `${label} gets different content at ${probe.url} (${metrics}) and the declared cssSelector "${declaration_.selector}" matches zero elements in the served DOM, so the declaration is a silent no-op`,
        );
        continue;
      }
      declared += 1;
    }

    const found = `${urls.length} URL(s) compared against ${TOKENS.length} crawler(s); ${comparable.length} comparable probe(s); ${findings.length} finding(s); ${declared} declared delta(s)`;

    if (findings.length > 0) {
      const shown = findings.slice(0, MAX_SHOWN).join('; ');
      const more = findings.length > MAX_SHOWN ? ` (${findings.length - MAX_SHOWN} more)` : '';
      return this.fail(`${shown}${more}.`, EXPECTED, found, 'high');
    }

    return this.pass(
      declared > 0
        ? `Every difference between the crawler and browser responses is declared with restricted-content markup whose cssSelector resolves (${declared} of ${comparable.length} probe(s)).`
        : `All ${comparable.length} crawler probe(s) received the same main content a browser received.`,
      EXPECTED,
      found,
    );
  }
}
