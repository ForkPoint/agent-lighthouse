import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { readabilityArticle, semanticText } from '../../gatherers/extraction';
import { normalizeText, sentences, shingles, jaccard } from '../../gatherers/text-metrics';

/** Below this, both document frequency and clustering are arithmetic on too few pages. */
const MIN_PAGES = 3;

/** A sentence on this share of the sample is template, whatever its wording. */
const BOILERPLATE_SHARE = 0.05;

/** ...but never on fewer than this many pages, so a 4-page sample needs 3 hits. */
const BOILERPLATE_MIN_PAGES = 3;

/** Below this share of a page's own sentence text being its own, the page is a template. */
const UNIQUE_FRACTION_FLOOR = 0.3;

/** Five-gram overlap at or above this makes two pages near-duplicates. */
const NEAR_DUPLICATE_JACCARD = 0.9;

/** Clusters named in the report. The rest are counted, not listed. */
const REPORTED_CLUSTERS = 3;

interface PageMeasure {
  url: string;
  /** Normalized sentences, in page order, with duplicates kept. */
  sentences: string[];
  /** Characters of normalized sentence text on the page. */
  chars: number;
  shingles: Set<string>;
  /** The URL this page names as its canonical, resolved. Its own URL when absent. */
  canonical: string;
  uniqueFraction: number;
}

interface Cluster {
  members: PageMeasure[];
  /** The strongest pairwise overlap that built this cluster. */
  similarity: number;
}

/** The canonical a page declares, resolved against its own URL. */
function canonicalOf(page: PageContext): string {
  const href = page.$('link[rel~="canonical"]').first().attr('href');
  if (!href) return page.url;
  try {
    return new URL(href, page.url).toString();
  } catch {
    return page.url;
  }
}

/** Two URLs pointing at the same document, ignoring the trailing slash. */
function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/+$/, '') === b.replace(/\/+$/, '');
}

/**
 * Group pages into near-duplicate clusters by single-link agglomeration.
 *
 * The sketch specifies 128-permutation MinHash with LSH banding, which exists
 * to make this affordable across millions of documents. A crawl sample is tens
 * of pages, where exact pairwise Jaccard is both cheaper and not an estimate.
 */
function cluster(measures: PageMeasure[]): Cluster[] {
  const parent = measures.map((_m, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    return root;
  };
  const strongest = new Map<number, number>();

  for (let i = 0; i < measures.length; i += 1) {
    for (let j = i + 1; j < measures.length; j += 1) {
      const similarity = jaccard(measures[i]!.shingles, measures[j]!.shingles);
      if (similarity < NEAR_DUPLICATE_JACCARD) continue;
      const a = find(i);
      const b = find(j);
      const root = Math.min(a, b);
      parent[a] = root;
      parent[b] = root;
      strongest.set(root, Math.max(strongest.get(root) ?? 0, similarity));
    }
  }

  const groups = new Map<number, PageMeasure[]>();
  for (let i = 0; i < measures.length; i += 1) {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(measures[i]!);
    groups.set(root, group);
  }

  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([root, members]) => ({ members, similarity: strongest.get(root) ?? 1 }));
}

/** A cluster where every member claims to be its own canonical. */
function selfCompeting(group: Cluster): boolean {
  return group.members.every((m) => sameUrl(m.canonical, m.url));
}

export class SiteWidePassageUniquenessRatioAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/site-wide-passage-uniqueness-ratio',
    category: 'answer-readiness',
    title: 'Site-wide passage uniqueness ratio',
    failureTitle: 'The site’s pages repeat each other, so only one of them can be cited',
    description:
      'Measures two things no single-page check can see: what share of each page’s sentences are its own rather than repeated across its siblings, and which pages are near-duplicates of each other at five-gram Jaccard 0.9 or above. Near-duplicate pages that all name themselves canonical compete against each other for one slot.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/answer-readiness/site-wide-passage-uniqueness-ratio.md',
    guidance: {
      impact:
        'A search engine clusters duplicate and near-duplicate URLs and elects one canonical; the losers have their signals folded into the winner. A cluster of near-duplicate pages that each name themselves canonical therefore competes against itself, and at most one member stays citable however good the others are. Separately, a page whose sentences are mostly site-wide template produces chunks whose embeddings encode the template rather than the page, so every page built from that template lands in the same place in vector space and none is a distinctive match for any question.',
      fix: 'Merge near-duplicate pages into one, or point the weaker members at the strongest with rel="canonical" so the election has an answer. For pages that stay, raise the share of text that is theirs alone: cut the repeated intro, the repeated legal paragraph and the repeated call to action, and let each page carry the sentences only it can carry.',
      effort: 'complex',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/answer-readiness/site-wide-passage-uniqueness-ratio.md',
      tags: ['duplication', 'canonical', 'retrieval', 'crawl'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const measures: PageMeasure[] = [];
    for (const page of ctx.pages) {
      const html = page.$.html() ?? '';
      const extracted = readabilityArticle(html, page.url) ?? semanticText(html);
      const own = sentences(extracted.text)
        .map((s) => normalizeText(s))
        .filter((s) => s !== '');
      if (own.length === 0) continue;
      measures.push({
        url: page.url,
        sentences: own,
        chars: own.reduce((sum, s) => sum + s.length, 0),
        shingles: shingles(extracted.text),
        canonical: canonicalOf(page),
        uniqueFraction: 0,
      });
    }

    if (measures.length < MIN_PAGES) {
      return this.notApplicable(
        `Only ${measures.length} page(s) carried extractable sentences; uniqueness across a site needs at least ${MIN_PAGES}.`,
        `At least ${MIN_PAGES} pages with extractable content`,
        `${measures.length} usable page(s)`,
      );
    }

    // A sentence is boilerplate by how many pages carry it, never by how often
    // one page repeats it — a page that says the same thing twice is a writing
    // problem, not a site-wide template.
    const documentFrequency = new Map<string, number>();
    for (const measure of measures) {
      for (const sentence of new Set(measure.sentences)) {
        documentFrequency.set(sentence, (documentFrequency.get(sentence) ?? 0) + 1);
      }
    }
    const threshold = Math.max(BOILERPLATE_MIN_PAGES, Math.ceil(BOILERPLATE_SHARE * measures.length));
    const boilerplate = new Set(
      [...documentFrequency.entries()]
        .filter(([, count]) => count >= threshold)
        .map(([sentence]) => sentence),
    );

    for (const measure of measures) {
      const repeated = measure.sentences
        .filter((s) => boilerplate.has(s))
        .reduce((sum, s) => sum + s.length, 0);
      measure.uniqueFraction = measure.chars === 0 ? 0 : (measure.chars - repeated) / measure.chars;
    }

    const fractions = measures.map((m) => m.uniqueFraction).sort((a, b) => a - b);
    const median = fractions[Math.floor(fractions.length / 2)] ?? 0;
    const flagged = measures.filter((m) => m.uniqueFraction < UNIQUE_FRACTION_FLOOR);

    const clusters = cluster(measures);
    const unresolved = clusters.filter(selfCompeting);
    const worst = [...clusters]
      .sort(
        (a, b) =>
          Number(selfCompeting(b)) - Number(selfCompeting(a)) ||
          b.members.length - a.members.length ||
          b.similarity - a.similarity,
      )
      .slice(0, REPORTED_CLUSTERS)
      .map(
        (group) =>
          `${group.members.map((m) => m.url).join(' ≈ ')} — five-gram overlap ${group.similarity.toFixed(2)}, ${
            selfCompeting(group)
              ? 'every member names itself canonical'
              : 'resolved by rel="canonical"'
          }`,
      );

    const displayValue = `${(median * 100).toFixed(0)}% unique`;
    const expected = `Median unique sentence share at or above ${UNIQUE_FRACTION_FLOOR * 100}%, and no near-duplicate cluster where every member names itself canonical`;
    const found = `Across ${measures.length} pages the median page is ${(median * 100).toFixed(0)}% its own sentences; ${boilerplate.size} sentence(s) appear on ${threshold} or more pages; ${clusters.length} near-duplicate cluster(s), ${unresolved.length} of them unresolved.`;
    const details = {
      analyzedPages: measures.map((m) => m.url),
      medianUniqueFraction: Number(median.toFixed(4)),
      boilerplateSentences: boilerplate.size,
      boilerplateThresholdPages: threshold,
      lowUniquenessPages: flagged.map((m) => `${m.url} (${(m.uniqueFraction * 100).toFixed(0)}% unique)`),
      nearDuplicateClusters: clusters.length,
      unresolvedClusters: unresolved.length,
      worstClusters: worst,
    };

    if (unresolved.length > 0) {
      const group = unresolved[0]!;
      return {
        ...this.fail(
          `${unresolved.length} near-duplicate cluster(s) compete against themselves: ${group.members.length} pages at five-gram overlap ${group.similarity.toFixed(2)} each name themselves canonical.`,
          expected,
          found,
          'Merge the duplicates, or point the weaker pages at the strongest with rel="canonical".',
        ),
        displayValue,
        details,
      };
    }

    if (median < UNIQUE_FRACTION_FLOOR) {
      return {
        ...this.fail(
          `The median page is only ${(median * 100).toFixed(0)}% its own sentences; the rest repeats across the site.`,
          expected,
          found,
          'Cut the sentences that repeat on every page and give each page more text only it can carry.',
        ),
        displayValue,
        details,
      };
    }

    if (flagged.length > 0) {
      return {
        ...this.warn(
          `${flagged.length} page(s) are under ${UNIQUE_FRACTION_FLOOR * 100}% their own sentences, though the median page is not.`,
          expected,
          found,
          'Give the flagged pages sentences of their own; as they stand they read as the template.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `The median page is ${(median * 100).toFixed(0)}% its own sentences, and no near-duplicate cluster is left unresolved.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
