// Graduated from proposal 2026-08-22 (Plan 5, Task 23).
// Evidence dossier: docs/evidence/audits/access-crawl-control/ai-crawler-edge-parity.md
// Folded twin: docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md
//
// robots.txt is advisory metadata the crawler parses; the edge decides access
// on its own. A site can publish "Allow: /" for PerplexityBot and still answer
// every request carrying that UA with a challenge. The operator reads only the
// first of those two, which is why this failure is invisible from the inside.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { parseRobots, isPathAllowed } from '../../gatherers/robots';
import { siteSitemapTree, sampleEntries } from '../../gatherers/sitemap';
import { AI_CRAWLER_UAS, sharedUaProbes, type UaProbe, type BlockClass } from '../../gatherers/ua-parity';

/** How many sitemap URLs join the probe set, beyond `/` and `/llms.txt`. */
const MAX_SITEMAP_PROBES = 2;
/** How many findings a message lists before it summarises. */
const MAX_SHOWN = 5;
/** How many crawler names one finding lists before it counts the rest. */
const MAX_NAMED = 4;

/**
 * Block classes that are decidable from the response alone.
 *
 * A challenge header, a crawler price and a proof-of-work interstitial each say
 * what they are; a truncated 200 is measurable. None of them can be explained by
 * the scanner's own missing source IP.
 */
const HARD: Partial<Record<BlockClass, (probe: UaProbe) => string>> = {
  'cf-challenge': (probe) => `Cloudflare challenge (${probe.evidence})`,
  'pay-per-crawl': (probe) => `pay-per-crawl (${probe.evidence})`,
  'anubis-pow': (probe) => `proof-of-work wall (${probe.evidence})`,
  'soft-block': (probe) => `soft block — ${probe.evidence}`,
};

/**
 * The honesty constraint. Cloudflare and Akamai deliberately block UA-spoofed AI
 * bots arriving from unpublished addresses, so an opaque 403 cannot be told
 * apart from correct impersonation defence.
 */
const AMBIGUITY =
  'The scanner sends the published crawler User-Agent without the matching source IP, so an opaque 403 or 429 cannot be told apart from correct impersonation defence — confirm against the edge logs before changing anything.';

function labelFor(token: string): string {
  return AI_CRAWLER_UAS.find((agent) => agent.token === token)?.label ?? token;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

/**
 * Group findings by URL and cause, so one line covers every crawler that hit
 * the same wall. Listing them per crawler would fill the message with six
 * copies of the homepage and hide the other URLs entirely.
 */
function group(into: Map<string, { url: string; cause: string; labels: string[] }>, url: string, cause: string, label: string): void {
  const key = `${url}|${cause}`;
  const existing = into.get(key);
  if (existing) existing.labels.push(label);
  else into.set(key, { url, cause, labels: [label] });
}

function nameList(labels: string[]): string {
  if (labels.length <= MAX_NAMED) return labels.join(', ');
  return `${labels.slice(0, MAX_NAMED).join(', ')} and ${labels.length - MAX_NAMED} more`;
}

function lines(groups: Map<string, { url: string; cause: string; labels: string[] }>): string[] {
  return [...groups.values()].map(
    ({ url, cause, labels }) => `${labels.length} crawler(s) (${nameList(labels)}) at ${url}: ${cause}`,
  );
}

function isBlocked(probe: UaProbe): boolean {
  if (probe.blockClass !== 'ok') return true;
  return probe.probeStatus < 200 || probe.probeStatus >= 300;
}

const EXPECTED =
  'every AI crawler robots.txt admits gets the same response from the edge that a browser gets, on the homepage, on sampled content URLs and on /llms.txt';

const SAMPLE = `# Cloudflare: allow the verified AI crawlers you admit in robots.txt
# Security > Bots > Verified bots, or a WAF skip rule:
(cf.verified_bot_category in {"AI Crawler" "Search Engine Crawler"})
  -> Skip: managed challenge, rate limiting, bot fight mode

# Then confirm from outside, per crawler:
curl -sI -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot' https://example.com/`;

export class AiCrawlerEdgeParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/ai-crawler-edge-parity',
    category: 'access-crawl-control',
    title: 'AI crawlers get the same response from the edge that browsers get',
    failureTitle: 'The edge blocks AI crawlers that robots.txt admits',
    description:
      'Fetches the homepage, sampled content URLs and /llms.txt once as a browser and once per published AI crawler User-Agent, then classifies every difference: Cloudflare challenge, pay-per-crawl 402, proof-of-work wall, rate limit, opaque 403, or a 200 carrying a fraction of the text. Reports per crawler and per URL, and scores a block only where robots.txt said the crawler was welcome.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/ai-crawler-edge-parity.md',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. A site can therefore publish "User-agent: PerplexityBot / Allow: /" and return a non-200 to every request carrying that user agent, and the operator — who reads their own robots.txt — believes they are open while the crawler never sees a byte. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C request is not 2xx while the browser request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministic — a challenge always carries cf-mitigated: challenge — and a 200 whose main-content text is under 40% of the baseline is a block wearing a 200.',
      fix: 'Decide the policy once, and make the edge say what robots.txt says. On Cloudflare, add the AI crawlers you admit to the verified-bot allowance (Security > Bots) or a WAF skip rule so managed challenges, bot fight mode and rate limiting do not apply to them; on other CDNs, allowlist the published crawler IP ranges. Then verify from outside with curl -A using each published User-Agent, because the dashboard shows the rule, not the answer. Where you mean to block a crawler, say so in robots.txt too — a consistent no is a legitimate posture, and this audit scores it as one.',
      code: SAMPLE,
      effort: 'complex',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/ai-crawler-edge-parity/',
      tags: ['robots', 'waf', 'cloudflare', 'crawlers', 'edge'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const robots = ctx.rootFiles['/robots.txt'];
    const groups = parseRobots(robots && robots.status === 200 ? robots.body : '');

    const urls = [`${ctx.baseUrl}/`];
    const tree = await siteSitemapTree(ctx);
    for (const entry of sampleEntries(tree.entries, MAX_SITEMAP_PROBES)) {
      if (!urls.includes(entry.loc)) urls.push(entry.loc);
    }
    const llms = ctx.rootFiles['/llms.txt'];
    if (llms && llms.status === 200) urls.push(`${ctx.baseUrl}/llms.txt`);

    const tokens = AI_CRAWLER_UAS.map((agent) => agent.token);
    const probes = await sharedUaProbes(ctx, urls, tokens);

    if (probes.length === 0) {
      return this.notApplicable(
        'No URL could be probed with a crawler User-Agent, so nothing about the edge is observable.',
        EXPECTED,
        'No probe completed',
      );
    }

    // A blocked baseline means the scanner could not read the site either;
    // reporting that as an AI-crawler posture would be a finding about us.
    if (probes.every((probe) => probe.baselineStatus < 200 || probe.baselineStatus >= 300)) {
      return this.notApplicable(
        `The scanner's own browser-UA request was answered with HTTP ${probes[0]!.baselineStatus}, so this measures the scanner being blocked rather than the site's AI-crawler posture.`,
        EXPECTED,
        `Baseline blocked on all ${urls.length} probe URL(s)`,
      );
    }

    const hardGroups = new Map<string, { url: string; cause: string; labels: string[] }>();
    const ambiguousGroups = new Map<string, { url: string; cause: string; labels: string[] }>();
    const consistent: string[] = [];
    const perCrawler = new Map<string, { blocked: number; probed: number }>();

    for (const probe of probes) {
      const label = labelFor(probe.token);
      const entry = perCrawler.get(label) ?? { blocked: 0, probed: 0 };
      entry.probed += 1;
      if (!isBlocked(probe)) {
        perCrawler.set(label, entry);
        continue;
      }
      entry.blocked += 1;
      perCrawler.set(label, entry);

      // A crawler robots.txt turns away is not owed a 200. Consistent is not a
      // defect, whatever the edge answered.
      if (!isPathAllowed(groups, probe.token, pathOf(probe.url))) {
        consistent.push(`${label} at ${probe.url}`);
        continue;
      }

      const describe = HARD[probe.blockClass];
      if (describe) {
        group(hardGroups, probe.url, describe(probe), label);
      } else if (probe.blockClass === 'ok') {
        group(
          hardGroups,
          probe.url,
          `HTTP ${probe.probeStatus} where a browser got ${probe.baselineStatus}`,
          label,
        );
      } else {
        group(ambiguousGroups, probe.url, `${probe.blockClass} (${probe.evidence})`, label);
      }
    }

    const summary = [...perCrawler.entries()]
      .map(([label, entry]) => `${label}: ${entry.blocked}/${entry.probed} blocked`)
      .join('; ');
    const found = `${urls.length} URL(s) probed with ${tokens.length} crawler UA(s); ${summary}`;

    const hard = lines(hardGroups);
    const ambiguous = lines(ambiguousGroups);

    if (hard.length > 0) {
      const shown = hard.slice(0, MAX_SHOWN).join('; ');
      const more = hard.length > MAX_SHOWN ? ` (${hard.length - MAX_SHOWN} more)` : '';
      const note = ambiguous.length > 0 ? ` ${ambiguous.length} further finding(s) are ambiguous. ${AMBIGUITY}` : '';
      return this.fail(
        `robots.txt admits these crawlers and the edge does not: ${shown}${more}.${note}`,
        EXPECTED,
        found,
        'critical',
      );
    }

    if (ambiguous.length > 0) {
      return this.warn(
        `${ambiguous.slice(0, MAX_SHOWN).join('; ')}. ${AMBIGUITY}`,
        EXPECTED,
        found,
        'medium',
      );
    }

    const consistentNote =
      consistent.length > 0
        ? ` ${consistent.length} probe(s) were refused to crawlers robots.txt also turns away, which is a consistent posture rather than a defect.`
        : '';
    return this.pass(
      `Every crawler robots.txt admits got the same response a browser got across ${urls.length} URL(s).${consistentNote}`,
      EXPECTED,
      found,
    );
  }
}
