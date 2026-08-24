import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { countTokens } from '../../gatherers/tokens';
import { readabilityArticle, semanticText } from '../../gatherers/extraction';
import { shingles } from '../../gatherers/text-metrics';

/** Below this, document frequency is arithmetic on too few documents. */
const MIN_PAGES = 3;

/** A shingle on this share of the sample is chrome, not content. */
const BOILERPLATE_DF = 0.8;

/** Below this share of fetched tokens being distinct, the crawl is mostly repeats. */
const FAIL_UNIQUE_SHARE = 0.2;

/** Between the two, an agent still pays more for chrome than the page is worth. */
const WARN_UNIQUE_SHARE = 0.35;

/** Below this many distinct tokens per page, an agent needs many fetches for little. */
const FAIL_UNIQUE_TOKENS = 300;

/** Pages kept per path-depth bucket, so one template cannot outvote the rest. */
const MAX_PER_DEPTH = 5;

interface PageMeasure {
  url: string;
  deliveredTokens: number;
  contentTokens: number;
  shingles: Set<string>;
}

/** Path depth of a URL, used only to bucket the sample. */
function depthOf(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

/**
 * Keep at most `MAX_PER_DEPTH` pages per path depth.
 *
 * A crawl of a site with a large blog returns mostly blog posts, and their
 * shared chrome would then define what "boilerplate" means for the whole site
 * while the commerce templates go unmeasured. Bucketing by depth is a cheap
 * stand-in for bucketing by template, and it is stable across runs.
 */
function stratify(pages: PageContext[]): PageContext[] {
  const perDepth = new Map<number, PageContext[]>();
  for (const page of pages) {
    const depth = depthOf(page.url);
    const bucket = perDepth.get(depth) ?? [];
    if (bucket.length >= MAX_PER_DEPTH) continue;
    bucket.push(page);
    perDepth.set(depth, bucket);
  }
  return [...perDepth.values()].flat();
}

export class BoilerplateTaxAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/boilerplate-tax',
    category: 'content-extraction',
    title: 'Boilerplate tax across the crawl (unique tokens per fetch)',
    failureTitle: 'Most of what an agent fetches from this site it has already read',
    description:
      'Samples pages across the crawl, finds the five-word windows that appear on at least 80% of them, and reports how many of the tokens an agent pays for are distinct information rather than repeated chrome. Site-level rather than page-level: the cost of boilerplate is only visible across fetches.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/content-extraction/boilerplate-tax.md',
    guidance: {
      impact:
        'An agent answering a question about a site fetches several of its pages. If each fetch delivers the same navigation, the same promotional header and the same footer around a thin body, the agent pays for those tokens once per fetch and learns nothing new from them. The cost compounds with every page, and the distinct content it came for competes for what is left of the context window.',
      fix: 'Cut repeated chrome down to what a reader needs on every page: collapse mega-menus to a short nav, move legal and marketing boilerplate to the pages that are about it, and let each page carry more of its own content. Where the chrome must stay for humans, keeping it out of `<main>` at least lets an extractor drop it.',
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/boilerplate-tax/',
      tags: ['tokens', 'context-window', 'content', 'crawl'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const sample = stratify(ctx.pages);

    const measures: PageMeasure[] = [];
    for (const page of sample) {
      const html = page.$.html() ?? '';
      const extracted = readabilityArticle(html, page.url) ?? semanticText(html);
      if (extracted.text.trim() === '') continue;
      measures.push({
        url: page.url,
        deliveredTokens: countTokens(page.fetchResult.body ?? ''),
        contentTokens: countTokens(extracted.text),
        shingles: shingles(extracted.text),
      });
    }

    if (measures.length < MIN_PAGES) {
      return this.notApplicable(
        `Only ${measures.length} page(s) carried extractable content; document frequency needs at least ${MIN_PAGES}.`,
        `At least ${MIN_PAGES} pages with extractable content`,
        `${measures.length} usable page(s)`,
      );
    }

    const documentFrequency = new Map<string, number>();
    for (const measure of measures) {
      for (const shingle of measure.shingles) {
        documentFrequency.set(shingle, (documentFrequency.get(shingle) ?? 0) + 1);
      }
    }
    const boilerplate = new Set(
      [...documentFrequency.entries()]
        .filter(([, count]) => count / measures.length >= BOILERPLATE_DF)
        .map(([shingle]) => shingle),
    );

    let deliveredTokens = 0;
    let uniqueTokens = 0;
    const perPageUnique: number[] = [];
    for (const measure of measures) {
      deliveredTokens += measure.deliveredTokens;
      const total = measure.shingles.size;
      const repeated = [...measure.shingles].filter((s) => boilerplate.has(s)).length;
      const uniqueShare = total === 0 ? 0 : (total - repeated) / total;
      const unique = Math.round(measure.contentTokens * uniqueShare);
      uniqueTokens += unique;
      perPageUnique.push(unique);
    }

    const sorted = [...perPageUnique].sort((a, b) => a - b);
    const medianUnique = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const uniqueShare = deliveredTokens === 0 ? 0 : uniqueTokens / deliveredTokens;

    const found = `An agent reading ${measures.length} pages of this site pays ${deliveredTokens} tokens to receive ${uniqueTokens} tokens of distinct information (${(uniqueShare * 100).toFixed(1)}%); median ${medianUnique} distinct tokens per page; ${boilerplate.size} repeated five-word windows.`;
    const expected = `At least ${FAIL_UNIQUE_SHARE * 100}% of fetched tokens distinct, and at least ${FAIL_UNIQUE_TOKENS} distinct tokens per page`;
    const details = {
      analyzedPages: measures.map((m) => m.url),
      deliveredTokens,
      uniqueTokens,
      uniqueShare: Number(uniqueShare.toFixed(4)),
      medianUniqueTokens: medianUnique,
      boilerplateShingles: boilerplate.size,
    };

    if (uniqueShare < FAIL_UNIQUE_SHARE || medianUnique < FAIL_UNIQUE_TOKENS) {
      return {
        ...this.fail(
          `Only ${(uniqueShare * 100).toFixed(1)}% of what an agent fetches from this site is distinct information.`,
          expected,
          found,
          'Cut the chrome that repeats on every page, and give each page more of its own content.',
        ),
        displayValue: `${(uniqueShare * 100).toFixed(1)}% distinct`,
        details,
      };
    }

    if (uniqueShare < WARN_UNIQUE_SHARE) {
      return {
        ...this.warn(
          `${(uniqueShare * 100).toFixed(1)}% of what an agent fetches is distinct — repeated chrome still dominates.`,
          expected,
          found,
          'Trim the repeated header, nav and footer text an agent re-reads on every fetch.',
        ),
        displayValue: `${(uniqueShare * 100).toFixed(1)}% distinct`,
        details,
      };
    }

    return {
      ...this.pass(
        `${(uniqueShare * 100).toFixed(1)}% of what an agent fetches from this site is distinct information.`,
        expected,
        found,
      ),
      displayValue: `${(uniqueShare * 100).toFixed(1)}% distinct`,
      details,
    };
  }
}
