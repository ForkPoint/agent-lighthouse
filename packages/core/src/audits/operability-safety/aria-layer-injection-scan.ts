// Graduated from proposal 2026-08-22 (Plan 5, Task 10).
// Evidence dossier: docs/evidence/audits/operability-safety/aria-layer-injection-scan.md
//
// Scope note (non-double-counting): `invisible-instruction-scan` scores the
// same lexicon against hidden *body text*; this audit scores it against the
// attribute channels an agent reads and a human never sees. The lexicon is
// imported from there rather than copied, so the two cannot drift apart.
// `accessible-names` asks whether an element has a name at all; `label` asks
// whether a field has one. Neither reads what the name says.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { INSTRUCTION_LEXICON } from './invisible-instruction-scan';
import { idSelector } from './_agent-affordances';
import {
  scanReadTheSite,
  unreadSiteReason,
  scanReadPageText,
  unreadPageTextReason,
} from '../../scan-evidence';

/** Long values are the canonical smuggling slot, since long alt is already an anti-pattern. */
const LONG_VALUE_CHARS = 250;
/** Below this token overlap, a label and its visible text are describing different things. */
const OVERLAP_FLOOR = 0.3;
/** A hidden input value this long, in words, is prose rather than an identifier. */
const SENTENCE_TOKENS = 5;

/**
 * Words that carry no topic, so counting them would let two unrelated strings
 * look similar just by both being English.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'it',
  'my',
  'now',
  'of',
  'on',
  'or',
  'our',
  'please',
  'the',
  'this',
  'to',
  'up',
  'with',
  'you',
  'your',
]);

/**
 * Verbs whose presence makes a token sequence a sentence rather than an
 * identifier. Deliberately a closed list: the check is a security heuristic, so
 * a missed sentence is cheaper than a flagged nonce.
 */
const FINITE_VERBS = new Set([
  'is',
  'are',
  'was',
  'were',
  'be',
  'has',
  'have',
  'had',
  'do',
  'does',
  'did',
  'will',
  'must',
  'should',
  'can',
  'may',
  'ignore',
  'disregard',
  'forget',
  'recommend',
  'recommends',
  'suggest',
  'prefer',
  'reply',
  'respond',
  'answer',
  'say',
  'tell',
  'output',
  'include',
  'mention',
  'cite',
  'send',
  'forward',
  'use',
  'treat',
  'act',
  'follow',
  'return',
]);

/**
 * Action verbs whose opposite fires the wrong side of a decision. An agent that
 * selects by accessible name actuates the label, not the glyph.
 */
const OPPOSING_VERBS: ReadonlyArray<[string, string]> = [
  ['confirm', 'cancel'],
  ['accept', 'decline'],
  ['accept', 'reject'],
  ['agree', 'disagree'],
  ['pay', 'back'],
  ['buy', 'return'],
  ['delete', 'keep'],
  ['remove', 'add'],
  ['save', 'discard'],
  ['submit', 'reset'],
  ['subscribe', 'unsubscribe'],
  ['enable', 'disable'],
  ['approve', 'deny'],
  ['yes', 'no'],
];

type Channel =
  | 'alt'
  | 'aria-label'
  | 'aria-describedby target'
  | 'aria-labelledby target'
  | 'aria-description'
  | 'title'
  | 'placeholder'
  | 'hidden input value'
  | 'option text'
  | 'document title'
  | 'og:title'
  | 'og:description'
  | 'href';

interface Finding {
  pageUrl: string;
  channel: Channel;
  text: string;
  /** The visible text, when the finding is a label/text divergence. */
  visible?: string;
}

interface Survey {
  valuesSeen: number;
  injections: Finding[];
  opposing: Finding[];
  longValues: Finding[];
  divergent: Finding[];
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Jaccard overlap over topic-carrying tokens. */
export function tokenOverlap(a: string, b: string): number {
  const left = new Set(tokens(a).filter((t) => !STOPWORDS.has(t)));
  const right = new Set(tokens(b).filter((t) => !STOPWORDS.has(t)));
  if (left.size === 0 || right.size === 0) return 1;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Does one string carry a verb whose opposite the other carries? */
function opposingVerbs(a: string, b: string): boolean {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  return OPPOSING_VERBS.some(
    ([one, other]) =>
      (left.has(one) && right.has(other)) || (left.has(other) && right.has(one)),
  );
}

/** Does this value read as prose rather than as an identifier or nonce? */
function isSentence(value: string): boolean {
  const words = tokens(value);
  if (words.length < SENTENCE_TOKENS) return false;
  return words.some((word) => FINITE_VERBS.has(word));
}

function hits(text: string): boolean {
  return INSTRUCTION_LEXICON.some((re) => re.test(text));
}

/** A URL's own text, with percent-encoding and `+` separators decoded. */
function decodeUrlText(href: string): string {
  try {
    return decodeURIComponent(href.replace(/\+/g, ' '));
  } catch {
    return href.replace(/\+/g, ' ');
  }
}

function survey(ctx: CheckContext): Survey {
  const result: Survey = {
    valuesSeen: 0,
    injections: [],
    opposing: [],
    longValues: [],
    divergent: [],
  };

  for (const page of ctx.pages) {
    const $ = page.$;
    const record = (channel: Channel, text: string, visible?: string) => {
      const value = text.replace(/\s+/g, ' ').trim();
      if (!value) return;
      result.valuesSeen += 1;
      const finding: Finding = { pageUrl: page.url, channel, text: value, ...(visible ? { visible } : {}) };
      if (hits(value)) {
        result.injections.push(finding);
        return;
      }
      if (value.length > LONG_VALUE_CHARS && (channel === 'alt' || channel === 'aria-label')) {
        result.longValues.push(finding);
      }
    };

    $('[alt]').each((_, el) => record('alt', $(el).attr('alt') ?? ''));
    $('[title]').each((_, el) => record('title', $(el).attr('title') ?? ''));
    $('[placeholder]').each((_, el) => record('placeholder', $(el).attr('placeholder') ?? ''));
    $('[aria-description]').each((_, el) =>
      record('aria-description', $(el).attr('aria-description') ?? ''),
    );
    $('option').each((_, el) => record('option text', $(el).text()));
    $('title').each((_, el) => record('document title', $(el).text()));
    $('meta[property="og:title"]').each((_, el) => record('og:title', $(el).attr('content') ?? ''));
    $('meta[property="og:description"]').each((_, el) =>
      record('og:description', $(el).attr('content') ?? ''),
    );

    for (const attr of ['aria-labelledby', 'aria-describedby'] as const) {
      $(`[${attr}]`).each((_, el) => {
        for (const id of ($(el).attr(attr) ?? '').split(/\s+/).filter(Boolean)) {
          const target = $(idSelector(id));
          if (target.length > 0) {
            record(
              attr === 'aria-labelledby' ? 'aria-labelledby target' : 'aria-describedby target',
              target.text(),
            );
          }
        }
      });
    }

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (!href) return;
      result.valuesSeen += 1;
      const decoded = decodeUrlText(href);
      if (hits(decoded)) {
        result.injections.push({ pageUrl: page.url, channel: 'href', text: decoded });
      }
    });

    // A hidden input holds an identifier, a token or a numeric id. Prose in one
    // is addressing something that reads prose.
    $('input[type="hidden"]').each((_, el) => {
      const value = ($(el).attr('value') ?? '').replace(/\s+/g, ' ').trim();
      if (!value) return;
      result.valuesSeen += 1;
      if (hits(value) || isSentence(value)) {
        result.injections.push({ pageUrl: page.url, channel: 'hidden input value', text: value });
      }
    });

    // aria-label against the element's own rendered text.
    $('[aria-label]').each((_, el) => {
      const $e = $(el);
      const label = ($e.attr('aria-label') ?? '').replace(/\s+/g, ' ').trim();
      record('aria-label', label);
      if (!label || hits(label)) return;
      const visible = $e.text().replace(/\s+/g, ' ').trim();
      if (!visible) return;
      const finding: Finding = { pageUrl: page.url, channel: 'aria-label', text: label, visible };
      if (opposingVerbs(label, visible)) {
        result.opposing.push(finding);
        return;
      }
      if (tokenOverlap(label, visible) < OVERLAP_FLOOR) result.divergent.push(finding);
    });
  }

  return result;
}

const EXPECTED =
  'Every accessible name, description and non-visual attribute is a short description that agrees with its element, and carries no instruction addressed to an AI';

const SAMPLE = `<!-- The accessible name describes the element and agrees with its label. -->
<img src="/shoe.png" alt="A blue running shoe on a white background">
<button aria-label="Add to cart">Add to cart</button>
<input type="hidden" name="nonce" value="a7f3-9c21">`;

export class AriaLayerInjectionScanAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/aria-layer-injection-scan',
    category: 'operability-safety',
    title: 'Accessibility-Layer Injection Scan',
    failureTitle: 'Accessibility-Layer Injection Scan',
    description:
      'Audit the text that reaches an agent through the accessibility tree and non-visual attributes rather than through body copy: alt, aria-label, aria-labelledby targets, aria-description, title, placeholder, hidden input values, <option> labels, document title and og:* metadata. Flag instruction-shaped content, anomalously long values, and aria-label/visible-text divergence.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/aria-layer-injection-scan.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        "Computer-use and browser agents drive pages through the DOM and accessibility tree, not pixels, so a11y attributes enter the model context with the same weight as visible text while remaining invisible to a sighted human. Anthropic names the vector explicitly: 'hidden malicious form fields in a webpage's DOM invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' The divergence sub-check is a defect in its own right independent of injection: an agent that clicks by accessible name will actuate an aria-label that contradicts the rendered label. Falsifier: if every a11y attribute is short, descriptive, and token-consistent with its element's visible text, this channel carries no payload.",
      fix: 'Remove any instruction-shaped text from alt, aria-label, title, placeholder, option labels, hidden input values, the document title and og:* metadata. Keep accessible names short and descriptive, and make each one agree with the element it names — an aria-label reading "Confirm payment" on a button labelled "Cancel" fires the wrong action for every agent that selects by accessible name. Keep hidden inputs to identifiers, tokens and ids rather than prose.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/aria-layer-injection-scan/',
      tags: ['injection-safety', 'prompt-injection', 'aria', 'security', 'agent-safety'],
    },
  };

  private recommendation() {
    return {
      priority: 'critical' as const,
      description: AriaLayerInjectionScanAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its non-visual values were not judged.',
        EXPECTED,
        unreadSiteReason(ctx.evidence),
      );
    }

    const s = survey(ctx);

    if (s.valuesSeen === 0) {
      return this.notApplicable(
        'No accessible name, description or non-visual attribute on the scanned pages.',
        EXPECTED,
        'No accessible-name text on the scanned pages',
      );
    }

    if (s.injections.length > 0) {
      const worst = s.injections[0]!;
      const quoted = worst.text.length > 300 ? `${worst.text.slice(0, 297)}...` : worst.text;
      return this.fail(
        `${s.injections.length} non-visual value(s) carry text addressed to an AI rather than a description. In ${worst.channel}: "${quoted}"`,
        EXPECTED,
        `${s.injections.length} instruction-shaped value(s) across ${s.valuesSeen} scanned`,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    if (s.opposing.length > 0) {
      const worst = s.opposing[0]!;
      return this.fail(
        `${s.opposing.length} element(s) carry an aria-label whose action verb opposes their own visible text: labelled "${worst.text}", reads "${worst.visible}". An agent selecting by accessible name fires the wrong action.`,
        EXPECTED,
        `${s.opposing.length} label/text contradiction(s) across ${s.valuesSeen} scanned`,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    const warnings = [...s.longValues, ...s.divergent];
    if (warnings.length > 0) {
      const long = s.longValues.length;
      const divergent = s.divergent.length;
      const parts = [
        long > 0 ? `${long} alt or aria-label value(s) exceed ${LONG_VALUE_CHARS} characters` : '',
        divergent > 0
          ? `${divergent} aria-label(s) share under ${Math.round(OVERLAP_FLOOR * 100)}% of their element's own visible tokens`
          : '',
      ].filter(Boolean);
      return this.warn(
        `${parts.join('; ')}. Neither matches an instruction pattern, but both are the slot a payload is smuggled in and both are already accessibility defects.`,
        EXPECTED,
        `${warnings.length} anomalous value(s) across ${s.valuesSeen} scanned`,
        this.recommendation(),
        warnings[0]!.pageUrl,
      );
    }

    // Reached only when nothing was found. A shell serves the head and almost
    // nothing else, so the accessibility layer this audit reads — alt,
    // aria-label, option labels, hidden inputs, links — never arrived.
    //
    // This audit declares `rendered-body`, so under the evidence gate — on for
    // every scan — it is skipped before `audit()` runs on a shell and no
    // production report reaches either branch. The ordering is what makes the
    // audit correct when it is called directly, which is how the contract
    // suite calls it and how a caller passing `enforceEvidenceGate: false`
    // gets it: an instruction planted in the document title or an og:* value
    // is served by a shell, so the payload branches above must run first.
    if (!scanReadPageText(ctx.evidence)) {
      return this.notApplicable(
        'The scanned page served no readable text, so its accessibility layer was not judged.',
        EXPECTED,
        unreadPageTextReason(ctx.evidence),
      );
    }

    return this.pass(
      `All ${s.valuesSeen} non-visual value(s) are descriptions that agree with their element and carry no instruction addressed to an AI.`,
      EXPECTED,
      `${s.valuesSeen} accessible-name value(s) scanned, no payload`,
      ctx.pages[0]?.url,
    );
  }
}
