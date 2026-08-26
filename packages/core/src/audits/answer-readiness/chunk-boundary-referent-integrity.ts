import type { Element } from 'domhandler';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { sentences, wordCount, normalizeText } from '../../gatherers/text-metrics';
import { allJsonLdNodes } from '../../parser';

/** Openers that point at something outside the chunk they start. */
const ANAPHORA =
  /^(This|That|These|Those|It|They|He|She|Such|Here|There|Both|Either)\b/;

/** References to a position in the document, which a retrieved chunk does not have. */
const POSITIONAL =
  /\b(as (mentioned|described|noted|shown) (above|below|earlier|previously)|see (above|below|the previous|the next)|the (table|figure|image|list|section|chart) (above|below)|in the previous section|as we saw|click here|read more here|the former|the latter)\b/gi;

/** Words after the demonstrative that may carry the referent instead. */
const ANAPHORA_WINDOW = 3;

/** Below this many words a chunk is a stub, and naming its subject is not expected. */
const ENTITY_MIN_WORDS = 40;

/** Below this share of clean chunks, retrieval returns text that answers nothing. */
const FAIL_SCORE = 0.8;

/** Between the two, some chunks still lose their referent when retrieved alone. */
const WARN_SCORE = 0.95;

/** Words too common to identify anything, dropped from the entity aliases. */
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'with', 'our', 'your', 'new']);

interface Chunk {
  heading: string;
  level: number;
  text: string;
  flags: string[];
  evidence: string;
}

/** Light stemming: enough to match "kettles" against "kettle". */
function stem(word: string): string {
  return word.replace(/(ies|es|s)$/i, (match) => (match === 'ies' ? 'y' : ''));
}

/**
 * The names a reader would accept as naming this page's subject.
 *
 * Built from the three places a page states its own subject — `h1`,
 * `og:title`, and JSON-LD `name`/`headline` — plus two derived forms: the
 * acronym of the multi-word name, and its first significant word. A chunk that
 * says "the Nordic" has named the Nordic Brew Kettle.
 */
function entitySet(page: PageContext): string[] {
  const names = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value !== 'string') return;
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length >= 3) names.add(text);
  };

  add(page.$('h1').first().text());
  add(page.meta['og:title']);
  for (const node of allJsonLdNodes(page.jsonLd)) {
    const record = node as Record<string, unknown>;
    add(record['name']);
    add(record['headline']);
  }

  const aliases = new Set<string>();
  for (const name of names) {
    const words = name.split(/\s+/).filter((word) => !STOPWORDS.has(word.toLowerCase()));
    if (words.length > 1) {
      aliases.add(words.map((word) => word[0]).join(''));
      if ((words[0] as string).length >= 4) aliases.add(words[0] as string);
      aliases.add(words[words.length - 1] as string);
    }
  }

  return [...names, ...aliases].filter((name) => name.length >= 3);
}

/** Split the container into heading-led chunks, as a retriever would. */
function chunksOf(page: PageContext): Chunk[] {
  const container = page.$('main, article').first().length
    ? page.$('main, article').first()
    : page.$('body');

  const chunks: Chunk[] = [];
  let current: Chunk | undefined;

  for (const node of container.find('h2, h3, p, li, td, dd, blockquote').toArray() as Element[]) {
    const tag = node.tagName.toLowerCase();
    const text = page.$(node).text().replace(/\s+/g, ' ').trim();
    if (tag === 'h2' || tag === 'h3') {
      const level = tag === 'h2' ? 2 : 3;
      // A heading at the same level or shallower closes the previous chunk.
      current = { heading: text, level, text: '', flags: [], evidence: '' };
      chunks.push(current);
      continue;
    }
    if (!current || text === '') continue;
    current.text = current.text === '' ? text : `${current.text} ${text}`;
  }

  return chunks;
}

export class ChunkBoundaryReferentIntegrityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/chunk-boundary-referent-integrity',
    category: 'answer-readiness',
    title: 'Chunk-boundary referent integrity',
    failureTitle: 'Sections stop making sense once retrieved on their own',
    description:
      'Splits the page into heading-led chunks, the way a retriever does, and checks each one for the three ways a chunk loses its meaning when it arrives alone: opening on a demonstrative with no referent, never naming the page\'s subject, and pointing at a position in the document ("as described above") that a retrieved chunk no longer has.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/answer-readiness/chunk-boundary-referent-integrity.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    guidance: {
      impact:
        'An answer engine retrieves a passage, not a page. A section that opens "This means you should..." and never names its subject is unusable on arrival: the model either drops it or attributes it to whatever else is in the window. The fix is per-sentence and cheap, and it is invisible to a reader of the whole page — which is why it survives editing.',
      fix: 'Open each section with its subject rather than a pronoun, name the product or topic once in every section over about forty words, and replace "as described above" with the name of the thing described.',
      code: `<!-- Loses its referent when retrieved alone -->
<h2>Descaling</h2>
<p>This should be done monthly, as described above.</p>

<!-- Survives retrieval -->
<h2>Descaling the copper kettle</h2>
<p>Descale the copper kettle monthly with equal parts water and white vinegar.</p>`,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/chunk-boundary-referent-integrity/',
      tags: ['retrieval', 'chunking', 'content', 'answer-engines'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        'No page was fetched, so no chunk could be assessed.',
        'At least one fetched page',
        'None',
      );
    }

    const chunks = chunksOf(page).filter((chunk) => chunk.text !== '');
    if (chunks.length === 0) {
      return this.notApplicable(
        'The page carries no h2 or h3 sections, so it has no chunk boundaries to assess.',
        'Heading-led sections',
        'No h2 or h3 headings',
      );
    }

    const entities = entitySet(page);
    const entityStems = entities.map((entity) => normalizeText(entity).split(' ').map(stem).join(' '));

    for (const chunk of chunks) {
      const [first = ''] = sentences(chunk.text);
      const opener = ANAPHORA.exec(first);
      if (opener) {
        const after = first.slice(opener[0].length).trim().split(/\s+/).slice(0, ANAPHORA_WINDOW);
        const headingWords = new Set(normalizeText(chunk.heading).split(' ').map(stem));
        const resolved = after.some((word) => headingWords.has(stem(normalizeText(word))));
        if (!resolved) {
          chunk.flags.push('anaphoraOpen');
          chunk.evidence = first;
        }
      }

      if (wordCount(chunk.text) >= ENTITY_MIN_WORDS) {
        const haystack = normalizeText(`${chunk.heading} ${chunk.text}`)
          .split(' ')
          .map(stem)
          .join(' ');
        if (!entityStems.some((entity) => entity !== '' && haystack.includes(entity))) {
          chunk.flags.push('entityAbsent');
          if (chunk.evidence === '') chunk.evidence = sentences(chunk.text)[0] ?? '';
        }
      }

      const positional = chunk.text.match(POSITIONAL);
      if (positional) {
        chunk.flags.push(`positionalRefs(${positional.length})`);
        if (chunk.evidence === '') {
          chunk.evidence = sentences(chunk.text).find((s) => POSITIONAL.test(s)) ?? positional[0];
          POSITIONAL.lastIndex = 0;
        }
      }
    }

    const failing = chunks.filter((chunk) => chunk.flags.length > 0);
    const score = (chunks.length - failing.length) / chunks.length;
    const lines = failing.map(
      (chunk) => `"${chunk.heading}": ${chunk.flags.join(', ')} — "${chunk.evidence}"`,
    );
    const found =
      failing.length === 0
        ? `All ${chunks.length} chunks name their subject and stand alone.`
        : `${failing.length} of ${chunks.length} chunks lose their referent when retrieved alone. ${lines.join(' | ')}`;
    const expected = `At least ${WARN_SCORE * 100}% of heading-led chunks self-contained`;
    const details = {
      chunks: chunks.length,
      failingChunks: failing.length,
      score: Number(score.toFixed(3)),
      entities: entities.slice(0, 100).map((entity) => entity.slice(0, 1000)),
      findings: lines.slice(0, 100).map((line) => line.slice(0, 1000)),
    };

    if (score < FAIL_SCORE) {
      return {
        ...this.fail(
          `${failing.length} of ${chunks.length} sections do not stand on their own when retrieved.`,
          expected,
          found,
          'Open each section with its subject and name the topic once per section.',
          page.url,
        ),
        displayValue: `${Math.round(score * 100)}% self-contained`,
        details,
      };
    }

    if (score < WARN_SCORE) {
      return {
        ...this.warn(
          `${failing.length} of ${chunks.length} sections lose their referent when retrieved alone.`,
          expected,
          found,
          'Name the subject in the sections flagged below.',
          page.url,
        ),
        displayValue: `${Math.round(score * 100)}% self-contained`,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${chunks.length} sections stand on their own when retrieved.`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${Math.round(score * 100)}% self-contained`,
      details,
    };
  }
}
