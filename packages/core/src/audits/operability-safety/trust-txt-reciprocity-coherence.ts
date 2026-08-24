import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { isSafeUrl } from '../../fetcher';
import { parseRobots, isPathAllowed } from '../../gatherers/robots';

/** Where a trust.txt may live, in the order the spec added them. */
const TRUST_TXT_PATHS = ['/trust.txt', '/.well-known/trust.txt'];

/** Attribute names the trust.txt specification defines. */
const KNOWN_ATTRIBUTES = new Set([
  'member',
  'belongto',
  'control',
  'controlledby',
  'vendor',
  'customer',
  'disclosure',
  'contact',
  'social',
  'datatrainingallowed',
]);

/** Association documents fetched per scan. Each is somebody else's host. */
const MAX_ASSOCIATIONS = 3;

/** The AI crawlers whose robots.txt treatment states the same policy. */
const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'PerplexityBot'];

export interface TrustTxtEntry {
  name: string;
  value: string;
  line: number;
}

/** Parse a trust.txt into its `name=value` lines, comments dropped. */
export function parseTrustTxt(body: string): TrustTxtEntry[] {
  const out: TrustTxtEntry[] = [];
  body.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.split('#')[0]!.trim();
    if (line === '') return;
    const split = line.indexOf('=');
    if (split === -1) return;
    out.push({
      name: line.slice(0, split).trim().toLowerCase(),
      value: line.slice(split + 1).trim(),
      line: index + 1,
    });
  });
  return out;
}

/** The registrable-ish host of a value, so two spellings of one domain meet. */
function hostOf(value: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.host.toLowerCase().replace(/^www\./, '');
  } catch {
    return value.toLowerCase().replace(/^www\./, '');
  }
}

export class TrustTxtReciprocityCoherenceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/trust-txt-reciprocity-coherence',
    category: 'operability-safety',
    title: 'trust.txt associations are reciprocated and agree with robots.txt',
    failureTitle: 'This site’s trust.txt claims are unreciprocated or contradict robots.txt',
    description:
      'For publishers who maintain a trust.txt: validates the attribute names, resolves each `belongto=` against that association’s own trust.txt to see whether it lists this domain back, and compares `datatrainingallowed=` against what robots.txt actually tells AI crawlers. Reported as a trust signal only — no AI engine is documented as a trust.txt consumer, so nothing here affects the score.',
    scoreDisplayMode: 'informative',
    tier: 'informative',
    evidenceGrade: 'C',
    weight: 0,
    defaultPriority: 'low',
    dossier: 'docs/evidence/audits/operability-safety/trust-txt-reciprocity-coherence.md',
    guidance: {
      impact:
        'trust.txt association attributes are defined as reciprocal: `belongto=<association>` means something only if that association’s own trust.txt carries `member=<this domain>`. That makes the claim checkable rather than self-asserted, which is the whole point of publishing it. Separately, `datatrainingallowed=no` beside a robots.txt that leaves GPTBot and ClaudeBot free to crawl states two opposite policies, and the channel that actually gates crawlers is the one that says yes. Adoption caveat: no AI engine, answer engine or crawler is documented as reading trust.txt.',
      fix: 'Ask each association you claim to belong to for a reciprocal `member=` line, drop the ones that will not reciprocate, and make `datatrainingallowed=` say the same thing your robots.txt AI-bot groups say.',
      effort: 'easy',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/trust-txt-reciprocity-coherence/',
      tags: ['trust-txt', 'provenance', 'advisory'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    let origin: string;
    try {
      origin = new URL(ctx.baseUrl).origin;
    } catch {
      return this.notApplicable(
        'This scan carries no origin to read a trust.txt from.',
        'An absolute base URL',
        `baseUrl: "${ctx.baseUrl}"`,
      );
    }
    const domain = hostOf(origin);

    let body = '';
    let source = '';
    for (const path of TRUST_TXT_PATHS) {
      const existing = ctx.rootFiles[path];
      const result = existing ?? ((await isSafeUrl(`${origin}${path}`))
        ? await ctx.fetch({ url: `${origin}${path}`, followRedirects: true })
        : undefined);
      if (result && result.status === 200 && result.body.trim() !== '') {
        body = result.body;
        source = path;
        break;
      }
    }

    if (body === '') {
      return this.notApplicable(
        'This site publishes no trust.txt.',
        'A trust.txt at /trust.txt or /.well-known/trust.txt',
        'Neither path answered with a document',
      );
    }

    const entries = parseTrustTxt(body);
    const observations: string[] = [];

    for (const entry of entries) {
      if (!KNOWN_ATTRIBUTES.has(entry.name)) {
        observations.push(`line ${entry.line}: "${entry.name}" is not a trust.txt attribute`);
      }
    }

    // Reciprocity. Each association is a fetch of somebody else's host, so the
    // set is capped and nothing else about that host is read.
    const associations = entries.filter((entry) => entry.name === 'belongto' || entry.name === 'controlledby');
    let checked = 0;
    const reciprocated: string[] = [];

    for (const entry of associations) {
      if (checked >= MAX_ASSOCIATIONS) {
        observations.push(`${associations.length - checked} further association(s) were not checked`);
        break;
      }
      const host = hostOf(entry.value);
      if (host === '' || host === domain) continue;
      const url = `https://${host}/trust.txt`;
      if (!(await isSafeUrl(url))) {
        observations.push(`${entry.name}=${entry.value}: that domain could not be reached`);
        continue;
      }
      checked += 1;
      const result = await ctx.fetch({ url, followRedirects: true });
      if (result.status !== 200) {
        observations.push(
          `${entry.name}=${entry.value}: that domain's trust.txt answered HTTP ${result.status}, so the association is unverifiable`,
        );
        continue;
      }
      const back = entry.name === 'belongto' ? 'member' : 'control';
      const listsUs = parseTrustTxt(result.body).some(
        (line) => line.name === back && hostOf(line.value) === domain,
      );
      if (listsUs) reciprocated.push(`${entry.name}=${entry.value}`);
      else observations.push(`${entry.name}=${entry.value}: that domain's trust.txt carries no ${back}= line naming ${domain}`);
    }

    // Policy coherence: two channels stating the same thing must agree.
    const declared = entries.find((entry) => entry.name === 'datatrainingallowed')?.value.toLowerCase();
    const robots = ctx.rootFiles['/robots.txt'];
    const groups = robots && robots.status === 200 ? parseRobots(robots.body) : [];
    const allowedCrawlers = AI_CRAWLERS.filter((bot) => isPathAllowed(groups, bot, '/'));

    if (declared === 'no' && groups.length > 0 && allowedCrawlers.length > 0) {
      observations.push(
        `datatrainingallowed=no, but robots.txt lets ${allowedCrawlers.join(', ')} crawl the site — the channel that gates crawlers says the opposite`,
      );
    }
    if (declared === 'yes' && groups.length > 0 && allowedCrawlers.length === 0) {
      observations.push(
        `datatrainingallowed=yes, but robots.txt blocks ${AI_CRAWLERS.join(', ')} — the channel that gates crawlers says the opposite`,
      );
    }

    const details = {
      source,
      attributes: entries.length,
      associationsChecked: checked,
      reciprocated: reciprocated.slice(0, 10),
      datatrainingallowed: declared ?? '',
      aiCrawlersAllowed: allowedCrawlers,
      observations: observations.slice(0, 20),
    };
    const expected =
      'Every association is reciprocated by the other domain, and datatrainingallowed agrees with robots.txt';
    const found = `${entries.length} attribute(s) at ${source}; ${checked} association(s) checked, ${reciprocated.length} reciprocated. ${observations.length} observation(s).`;
    const displayValue = `${reciprocated.length}/${checked} reciprocated`;

    // Never a failure: the mechanism is sound, the consumer is not documented.
    if (observations.length > 0) {
      return {
        ...this.warn(
          observations[0]!,
          expected,
          found,
          'Ask each association to add a reciprocal member= line, and make datatrainingallowed say what robots.txt says.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'The trust.txt parses, its associations are reciprocated, and it agrees with robots.txt.',
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
