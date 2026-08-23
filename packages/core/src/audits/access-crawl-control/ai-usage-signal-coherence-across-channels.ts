import * as cheerio from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { parseRobots, directiveLines, isBlanketBlocked } from '../../gatherers/robots';
import { parseDictionary } from '../../gatherers/structured-fields';
import { TRAINING_CRAWLERS } from './_robots-txt-helpers';

/**
 * The three AIPREF categories every other channel is normalized into.
 *
 * `train-ai` and `search` are the vocabulary draft's two categories. `ai-input`
 * is Cloudflare's third Content-Signal and RSL's usage type, kept because two
 * channels express it and dropping it would hide a contradiction between them.
 */
type Category = 'train-ai' | 'search' | 'ai-input';

const CATEGORIES: ReadonlySet<string> = new Set<Category>(['train-ai', 'search', 'ai-input']);

/** Content-Signal names, in the vocabulary Cloudflare publishes them under. */
const CONTENT_SIGNAL_MAP: Record<string, Category> = {
  'ai-train': 'train-ai',
  search: 'search',
  'ai-input': 'ai-input',
};

/** RSL usage values that map onto a category. */
const RSL_USAGE_MAP: Record<string, Category> = {
  train: 'train-ai',
  'train-ai': 'train-ai',
  'train-genai': 'train-ai',
  search: 'search',
  'ai-input': 'ai-input',
  ai: 'train-ai',
};

/** One normalized declaration: who, where, which category, allowed or not. */
interface Signal {
  channel: string;
  category: Category;
  allow: boolean;
  /** Path prefix the declaration covers. `/` is the whole site. */
  scope: string;
  /** Product token the declaration is scoped to, or `*`. */
  agent: string;
  /** The line or header the finding quotes. */
  source: string;
  /** robots.txt line number, when the signal came from robots.txt. */
  line?: number;
}

/** Two agents overlap when either is the wildcard or they are the same token. */
function agentsOverlap(a: string, b: string): boolean {
  if (a === '*' || b === '*') return true;
  return a.toLowerCase() === b.toLowerCase();
}

/** Two path prefixes overlap when either contains the other. */
function scopesOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/** Read an AIPREF dictionary, with the optional leading path prefix split off. */
function aiprefSignals(
  raw: string,
  channel: string,
  agent: string,
  source: string,
  line?: number,
): Signal[] {
  let scope = '/';
  let body = raw.trim();
  // attach-05 allows `Content-Usage: /ai-ok/ train-ai=y`. The path token is
  // whitespace-separated and always first.
  const leading = /^(\/\S*)\s+(.*)$/.exec(body);
  if (leading) {
    scope = leading[1]!;
    body = leading[2]!;
  }
  const parsed = parseDictionary(body);
  if (!parsed.ok) return [];
  const out: Signal[] = [];
  for (const [key, value] of parsed.value) {
    if (!CATEGORIES.has(key)) continue;
    if (value !== 'y' && value !== 'n') continue;
    out.push({
      channel,
      category: key as Category,
      allow: value === 'y',
      scope,
      agent,
      source,
      ...(line === undefined ? {} : { line }),
    });
  }
  return out;
}

/** Read a Cloudflare `Content-Signal` line: `search=yes, ai-train=no`. */
function contentSignals(raw: string, agent: string, source: string, line: number): Signal[] {
  const out: Signal[] = [];
  for (const piece of raw.split(',')) {
    const [name = '', value = ''] = piece.split('=').map((p) => p.trim().toLowerCase());
    const category = CONTENT_SIGNAL_MAP[name];
    if (!category) continue;
    if (value !== 'yes' && value !== 'no') continue;
    out.push({
      channel: 'robots.txt Content-Signal',
      category,
      allow: value === 'yes',
      scope: '/',
      agent,
      source,
      line,
    });
  }
  return out;
}

/** Read the `tdm-reservation` value both the header and the meta tag carry. */
function tdmSignal(value: string, channel: string, source: string): Signal | undefined {
  const v = value.trim();
  if (v !== '0' && v !== '1') return undefined;
  return {
    channel,
    category: 'train-ai',
    // Reservation 1 reserves the rights, which is a denial of mining.
    allow: v === '0',
    scope: '/',
    agent: '*',
    source,
  };
}

/** Read the RSL documents a page carries inline. No fetch: the licence audit owns that. */
function inlineRslSignals(page: PageContext): Signal[] {
  const out: Signal[] = [];
  page.$('script[type="application/rsl+xml"]').each((_i, el) => {
    const xml = page.$(el).text();
    if (xml.trim() === '') return;
    const $ = cheerio.load(xml, { xmlMode: true });
    const scope = (() => {
      const url = $('content').first().attr('url') ?? '/';
      try {
        return new URL(url, page.url).pathname;
      } catch {
        return url.startsWith('/') ? url : '/';
      }
    })();
    for (const tag of ['permits', 'prohibits']) {
      $(tag).each((_j, node) => {
        const $node = $(node);
        if (($node.attr('type') ?? 'usage').toLowerCase() !== 'usage') return;
        for (const token of $node.text().split(/[\s,]+/)) {
          const category = RSL_USAGE_MAP[token.trim().toLowerCase()];
          if (!category) continue;
          out.push({
            channel: 'inline RSL document',
            category,
            allow: tag === 'permits',
            scope,
            agent: '*',
            source: `<${tag} type="usage">${token.trim()}</${tag}> on ${page.url}`,
          });
        }
      });
    }
  });
  return out;
}

/** Read `/.well-known/tdmrep.json`, which the spec defines as an array of rules. */
function tdmrepSignals(body: string): { signals: Signal[]; malformed: boolean } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { signals: [], malformed: true };
  }
  if (!Array.isArray(parsed)) return { signals: [], malformed: true };
  const signals: Signal[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const reservation = record['tdm-reservation'];
    if (reservation !== 0 && reservation !== 1 && reservation !== '0' && reservation !== '1') continue;
    const location = typeof record['location'] === 'string' ? record['location'] : '/';
    signals.push({
      channel: '/.well-known/tdmrep.json',
      category: 'train-ai',
      allow: String(reservation) === '0',
      scope: location.startsWith('/') ? location : `/${location}`,
      agent: '*',
      source: `location "${location}" with tdm-reservation ${String(reservation)}`,
    });
  }
  return { signals, malformed: false };
}

export class AiUsageSignalCoherenceAcrossChannelsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/ai-usage-signal-coherence-across-channels',
    category: 'access-crawl-control',
    title: 'AI usage signals agree across every channel that carries them',
    failureTitle: 'This site tells different AI systems opposite things about the same content',
    description:
      'Normalizes every AI-usage signal the site emits — robots.txt Allow/Disallow for training crawlers, AIPREF Content-Usage, Cloudflare Content-Signal, TDM-Rep in its three transports, and inline RSL permits/prohibits — into one comparable model, and reports where two channels contradict each other for the same category over overlapping paths.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier:
      'docs/evidence/audits/access-crawl-control/ai-usage-signal-coherence-across-channels.md',
    guidance: {
      impact:
        'No standard defines precedence between these channels; each specifies only its own parsing. A crawler that reads TDM-Rep and a crawler that reads AIPREF therefore read disjoint inputs, and when those inputs disagree the two reach opposite conclusions about the same page. Whichever one you did not mean to publish is the one some operator will act on. The documented worst case is not even yours to make: Cloudflare’s managed robots.txt prepends its own Content-Signal block above your file, so your stated policy can be contradicted at the edge without you knowing.',
      fix: 'Decide the policy once, then say the same thing in every channel you publish. If you do not intend to maintain a channel, remove it rather than leaving a stale value — a contradicted signal is worse than a missing one. Where your CDN prepends its own robots.txt block, either turn that feature off or make your own declarations match it.',
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/access-crawl-control/ai-usage-signal-coherence-across-channels.md',
      tags: ['robots', 'aipref', 'tdmrep', 'rsl', 'licensing'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (ctx.pages.length === 0 && (ctx.rootFiles['/robots.txt']?.status ?? 0) !== 200) {
      return this.notApplicable(
        'The scan read no page and no robots.txt, so no channel could carry a signal.',
        'A robots.txt or at least one page to read signals from',
        'Nothing fetched',
      );
    }

    const signals: Signal[] = [];
    const notes: string[] = [];

    const robots = ctx.rootFiles['/robots.txt'];
    const robotsBody = robots?.status === 200 ? robots.body : '';
    if (robotsBody !== '') {
      for (const line of directiveLines(robotsBody, 'content-usage')) {
        signals.push(
          ...aiprefSignals(
            line.value,
            'robots.txt Content-Usage',
            line.group === '' ? '*' : line.group,
            `line ${line.line}: Content-Usage: ${line.value}`,
            line.line,
          ),
        );
      }
      for (const line of directiveLines(robotsBody, 'content-signal')) {
        signals.push(
          ...contentSignals(
            line.value,
            line.group === '' ? '*' : line.group,
            `line ${line.line}: Content-Signal: ${line.value}`,
            line.line,
          ),
        );
      }

      const groups = parseRobots(robotsBody);
      for (const crawler of TRAINING_CRAWLERS) {
        if (!isBlanketBlocked(groups, crawler.botName)) continue;
        signals.push({
          channel: 'robots.txt Disallow',
          category: 'train-ai',
          allow: false,
          scope: '/',
          agent: crawler.botName,
          source: `${crawler.displayName} is blocked at the root`,
        });
      }
    }

    const tdmrep = ctx.rootFiles['/.well-known/tdmrep.json'];
    if (tdmrep?.status === 200 && tdmrep.body.trim() !== '') {
      const read = tdmrepSignals(tdmrep.body);
      if (read.malformed) {
        notes.push(
          '/.well-known/tdmrep.json is not the array of rules the TDM-Rep report defines, so its declaration is not read',
        );
      }
      signals.push(...read.signals);
    }

    for (const page of ctx.pages) {
      const headers = page.fetchResult.headers ?? {};
      const contentUsage = headers['content-usage'];
      if (contentUsage) {
        signals.push(
          ...aiprefSignals(
            contentUsage,
            'Content-Usage response header',
            '*',
            `Content-Usage: ${contentUsage} on ${page.url}`,
          ),
        );
      }
      const reservationHeader = headers['tdm-reservation'];
      if (reservationHeader) {
        const signal = tdmSignal(
          reservationHeader,
          'tdm-reservation response header',
          `tdm-reservation: ${reservationHeader} on ${page.url}`,
        );
        if (signal) signals.push(signal);
      }
      const xRobots = (headers['x-robots-tag'] ?? '').toLowerCase();
      if (/\bnoai\b/.test(xRobots)) {
        signals.push({
          channel: 'X-Robots-Tag noai',
          category: 'train-ai',
          allow: false,
          scope: '/',
          agent: '*',
          source: `X-Robots-Tag: ${headers['x-robots-tag']} on ${page.url}`,
        });
      }

      const metaReservation = page.meta['tdm-reservation'];
      if (metaReservation) {
        const signal = tdmSignal(
          metaReservation,
          '<meta name="tdm-reservation">',
          `<meta name="tdm-reservation" content="${metaReservation}"> on ${page.url}`,
        );
        if (signal) signals.push(signal);
      }
      if (/\bnoai\b/.test((page.meta['robots'] ?? '').toLowerCase())) {
        signals.push({
          channel: '<meta name="robots"> noai',
          category: 'train-ai',
          allow: false,
          scope: '/',
          agent: '*',
          source: `<meta name="robots" content="${page.meta['robots']}"> on ${page.url}`,
        });
      }

      signals.push(...inlineRslSignals(page));
    }

    // A contradiction needs two channels. Two lines of the same channel
    // disagreeing is that channel's own precedence question, and the audits
    // that own each channel answer it.
    const contradictions: string[] = [];
    const edgeOverrides: string[] = [];
    const earliestOperatorLine = Math.min(
      ...signals
        .filter((s) => s.line !== undefined && s.channel !== 'robots.txt Content-Signal')
        .map((s) => s.line!),
      Number.POSITIVE_INFINITY,
    );

    for (let i = 0; i < signals.length; i += 1) {
      for (let j = i + 1; j < signals.length; j += 1) {
        const a = signals[i]!;
        const b = signals[j]!;
        if (a.channel === b.channel) continue;
        if (a.category !== b.category) continue;
        if (a.allow === b.allow) continue;
        if (!agentsOverlap(a.agent, b.agent)) continue;
        if (!scopesOverlap(a.scope, b.scope)) continue;
        const finding = `${a.category} over ${a.scope}: ${a.channel} says ${
          a.allow ? 'allowed' : 'denied'
        } (${a.source}) while ${b.channel} says ${b.allow ? 'allowed' : 'denied'} (${b.source})`;
        // Cloudflare's managed robots.txt prepends its Content-Signal block
        // above the operator's own directives, so a contradiction whose
        // Content-Signal line sits above everything the operator wrote is an
        // edge override — a different remedy from an inconsistent policy.
        const prepended = [a, b].find(
          (s) => s.channel === 'robots.txt Content-Signal' && (s.line ?? 0) < earliestOperatorLine,
        );
        if (prepended) edgeOverrides.push(finding);
        else contradictions.push(finding);
      }
    }

    const displayValue = `${signals.length} signal(s), ${contradictions.length + edgeOverrides.length} contradiction(s)`;
    const expected = 'Every channel that carries an AI-usage signal says the same thing';
    const channels = [...new Set(signals.map((s) => s.channel))];
    const found =
      signals.length === 0
        ? 'No AI-usage signal in robots.txt, response headers, meta tags, /.well-known/tdmrep.json or an inline RSL document.'
        : `${signals.length} signal(s) across ${channels.length} channel(s): ${channels.join(', ')}.`;
    const details = {
      signals: signals.length,
      channels,
      contradictions: [...contradictions, ...edgeOverrides].slice(0, 50),
      edgeOverrides: edgeOverrides.slice(0, 50),
      notes,
    };

    if (contradictions.length > 0 || edgeOverrides.length > 0) {
      return {
        ...this.fail(
          edgeOverrides.length > 0
            ? `A Content-Signal block above your own directives contradicts a signal you publish elsewhere, in ${edgeOverrides.length} case(s).`
            : `${contradictions.length} contradiction(s) between the channels this site publishes.`,
          expected,
          found,
          edgeOverrides.length > 0
            ? 'The contradicting block sits above your own robots.txt directives, which is where a CDN prepends one. Turn that feature off, or make your declarations agree with it.'
            : 'Decide the policy once and publish the same value in every channel; delete the channels you do not maintain.',
        ),
        displayValue,
        details,
      };
    }

    if (signals.length === 0) {
      return {
        ...this.warn(
          'This site declares no AI-usage preference in any channel, so every crawler applies its own default.',
          expected,
          found,
          'Publish one preference — an AIPREF `Content-Usage` line in robots.txt is the smallest complete declaration — rather than leaving every operator to guess.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${signals.length} AI-usage signal(s) across ${channels.length} channel(s), with no contradiction between them.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
