// Graduated from proposal 2026-08-22 (Plan 5, Task 23).
// Evidence dossier: docs/evidence/audits/access-crawl-control/ai-crawler-edge-parity.md
// Folded twin: docs/evidence/merged/access-crawl-control/ai-crawler-edge-parity.md
//
// robots.txt is advisory metadata the crawler parses; the edge decides access
// on its own. A site can publish "Allow: /" for PerplexityBot and still answer
// every request carrying that UA with a challenge. The operator reads only the
// first of those two, which is why this failure is invisible from the inside.
//
// What a probe shows: how the site answers a request from the scanner's own
// address whose User-Agent names the crawler. Real crawlers are verified by
// published IP range or Web Bot Auth signature, which the scanner cannot
// present, so no message here says what the real crawler receives.
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import { parseRobots, isPathAllowed } from "#core/gatherers/robots";
import { siteSitemapTree, sampleEntries } from "#core/gatherers/sitemap";
import {
  AI_CRAWLER_UAS,
  sharedUaProbes,
  type UaProbe,
  BlockClass,
  challengeMarker,
} from "#core/gatherers/ua-parity";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact } from "#core/gatherers/root-files";

/** How many sitemap URLs join the probe set, beyond `/` and `/llms.txt`. */
const MAX_SITEMAP_PROBES = 2;
/** How many findings a message lists before it summarises. */
const MAX_SHOWN = 5;
/** How many crawler names one finding lists before it counts the rest. */
const MAX_NAMED = 4;

/**
 * How one differing probe is reported: a finding the site's own answer decides,
 * or one an unverified request can trigger on its own.
 *
 * Only two answers say something about the site rather than about the probe. A
 * pay-per-crawl 402 states a price, and Cloudflare documents that 402 as the
 * answer any crawler gets until it verifies and pays. A 200 carrying a fraction
 * of the text, with no challenge in it, is a different page body. Everything
 * else is a refusal: a challenge, a proof-of-work wall, a 403, a 429 or another
 * non-2xx. Cloudflare's Super Bot Fight Mode sets verified bots apart from
 * automated traffic, and Anubis can admit a crawler only from its published
 * addresses, so an edge can refuse the probe and still admit the real crawler.
 */
function causeOf(probe: UaProbe): { hard: boolean; cause: string } {
  if (probe.blockClass === BlockClass.PayPerCrawl) {
    return { hard: true, cause: `pay-per-crawl (${probe.evidence})` };
  }
  if (probe.blockClass === BlockClass.SoftBlock) {
    const marker = challengeMarker(probe.probeBody);
    return marker
      ? {
          hard: false,
          cause: `challenge page (HTTP 200, body contains "${marker}")`,
        }
      : { hard: true, cause: `soft block — ${probe.evidence}` };
  }
  if (probe.blockClass === BlockClass.CfChallenge) {
    return { hard: false, cause: `Cloudflare challenge (${probe.evidence})` };
  }
  if (probe.blockClass === BlockClass.AnubisPow) {
    return { hard: false, cause: `proof-of-work wall (${probe.evidence})` };
  }
  if (probe.blockClass === BlockClass.Ok) {
    return {
      hard: false,
      cause: `HTTP ${probe.probeStatus} where a browser got ${probe.baselineStatus}`,
    };
  }
  // An opaque 403, a rate limit and a transport error.
  return { hard: false, cause: `${probe.blockClass} (${probe.evidence})` };
}

/**
 * The honesty constraint. The probe is by definition not the verified crawler,
 * and an edge can answer the two differently, so a refusal of the probe does
 * not show what the real crawler gets.
 */
const AMBIGUITY =
  "The scanner sends the crawler User-Agent from its own address, without the crawler's published IP range or Web Bot Auth signature, so a challenge, a 403, a 429 or another refusal can be the edge's defence against an unverified request naming the crawler, and the real crawler may be answered differently. Confirm against the edge logs before changing anything.";

/**
 * Appended to every finding: the probe reports how the site answers the
 * User-Agent, not what the verified crawler receives.
 */
const SCOPE =
  "These probes come from the scanner's address without the crawler's published IP range or Web Bot Auth signature, so they show how the site answers a request that names the crawler, not what the real crawler receives.";

function labelFor(token: string): string {
  return AI_CRAWLER_UAS.find((agent) => agent.token === token)?.label ?? token;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

/**
 * Group findings by URL and cause, so one line covers every crawler that hit
 * the same wall. Listing them per crawler would fill the message with six
 * copies of the homepage and hide the other URLs entirely.
 */
function group(
  into: Map<string, { url: string; cause: string; labels: string[] }>,
  url: string,
  cause: string,
  label: string,
): void {
  const key = `${url}|${cause}`;
  const existing = into.get(key);
  if (existing) existing.labels.push(label);
  else into.set(key, { url, cause, labels: [label] });
}

function nameList(labels: string[]): string {
  if (labels.length <= MAX_NAMED) return labels.join(", ");
  return `${labels.slice(0, MAX_NAMED).join(", ")} and ${labels.length - MAX_NAMED} more`;
}

function lines(
  groups: Map<string, { url: string; cause: string; labels: string[] }>,
): string[] {
  return [...groups.values()].map(
    ({ url, cause, labels }) =>
      `${labels.length} crawler User-Agent(s) (${nameList(labels)}) at ${url}: ${cause}`,
  );
}

function isBlocked(probe: UaProbe): boolean {
  if (probe.blockClass !== BlockClass.Ok) return true;
  return probe.probeStatus < 200 || probe.probeStatus >= 300;
}

const EXPECTED =
  "a request whose User-Agent names an AI crawler robots.txt admits gets the same response from the edge that a browser gets, on the homepage, on sampled content URLs and on /llms.txt";

const SAMPLE = `# Cloudflare: allow the verified AI crawlers you admit in robots.txt
# Security > Bots > Verified bots, or a WAF skip rule:
(cf.verified_bot_category in {"AI Crawler" "Search Engine Crawler"})
  -> Skip: managed challenge, rate limiting, bot fight mode

# Then confirm from outside, per crawler:
curl -sI -A 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot' https://example.com/`;

export class AiCrawlerEdgeParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/ai-crawler-edge-parity",
    category: "access-crawl-control",
    title:
      "Requests naming an AI crawler get the same edge response as a browser",
    failureTitle:
      "The edge answers differently when the User-Agent names an AI crawler robots.txt admits",
    description:
      "Fetches the homepage, sampled content URLs and /llms.txt once as a browser and once per published AI crawler User-Agent, then classifies every difference: Cloudflare challenge, pay-per-crawl 402, proof-of-work wall, rate limit, opaque 403, or a 200 carrying a fraction of the text. Reports per crawler and per URL, and scores a difference only where robots.txt admits that crawler: a pay-per-crawl price or a reduced page fails, while a challenge or another refusal warns, because an edge can refuse an unverified request naming the crawler and still admit the real one. The probes come from the scanner's address, so they show how the site answers a request that names the crawler, not what the real crawler, verified by IP range or signature, receives.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/access-crawl-control/ai-crawler-edge-parity.md",
    // Gate exemption: being refused is what this category reports.
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Critical,
    guidance: {
      impact:
        'robots.txt (RFC 9309) is advisory metadata parsed by the crawler; the edge access decision is enforced independently by the WAF. A site can therefore publish "User-agent: PerplexityBot / Allow: /" and return a non-200 to every request carrying that user agent, and the operator — who reads their own robots.txt — believes they are open while the edge refuses every request that names the crawler. Falsifiable: fetch URL U with a browser UA and with crawler UA C; if robots.txt permits C for U and the C request is not 2xx while the browser request is 200, the two policy layers contradict each other. Cloudflare makes one branch deterministic — a challenge always carries cf-mitigated: challenge — and a 200 whose main-content text is under 40% of the baseline is a block wearing a 200.',
      fix: "Decide the policy once, and make the edge say what robots.txt says. On Cloudflare, add the AI crawlers you admit to the verified-bot allowance (Security > Bots) or a WAF skip rule so managed challenges, bot fight mode and rate limiting do not apply to them; on other CDNs, allowlist the published crawler IP ranges. Then verify from outside with curl -A using each published User-Agent, because the dashboard shows the rule, not the answer. Where you mean to block a crawler, say so in robots.txt too — a consistent no is a legitimate posture, and this audit scores it as one.",
      code: SAMPLE,
      effort: FixEffort.Complex,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/ai-crawler-edge-parity/",
      tags: ["robots", "waf", "cloudflare", "crawlers", "edge"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const robots = ctx.rootFiles["/robots.txt"];
    const groups = parseRobots(
      robots && robots.status === 200 ? robots.body : "",
    );

    const urls = [`${ctx.baseUrl}/`];
    const tree = await siteSitemapTree(ctx);
    for (const entry of sampleEntries(tree.entries, MAX_SITEMAP_PROBES)) {
      if (!urls.includes(entry.loc)) urls.push(entry.loc);
    }
    const llms = ctx.rootFiles["/llms.txt"];
    if (isRootArtifact(llms)) urls.push(`${ctx.baseUrl}/llms.txt`);

    const tokens = AI_CRAWLER_UAS.map((agent) => agent.token);
    const probes = await sharedUaProbes(ctx, urls, tokens);

    if (probes.length === 0) {
      return this.notApplicable(
        "No URL could be probed with a crawler User-Agent, so nothing about the edge is observable.",
        EXPECTED,
        "No probe completed",
      );
    }

    // A blocked baseline means the scanner could not read the site either;
    // reporting that as an AI-crawler posture would be a finding about us.
    if (
      probes.every(
        (probe) => probe.baselineStatus < 200 || probe.baselineStatus >= 300,
      )
    ) {
      return this.notApplicable(
        `The scanner's own browser-UA request was answered with HTTP ${probes[0]!.baselineStatus}, so this measures the scanner being blocked rather than the site's AI-crawler posture.`,
        EXPECTED,
        `Baseline blocked on all ${urls.length} probe URL(s)`,
      );
    }

    const hardGroups = new Map<
      string,
      { url: string; cause: string; labels: string[] }
    >();
    const ambiguousGroups = new Map<
      string,
      { url: string; cause: string; labels: string[] }
    >();
    const consistent: string[] = [];
    const perCrawler = new Map<string, { blocked: number; probed: number }>();
    // URLs where the browser itself got a non-2xx. The mechanism compares a
    // crawler answer against a browser 200, so these show no difference.
    const unreadable = new Set<string>();

    for (const probe of probes) {
      if (probe.baselineStatus < 200 || probe.baselineStatus >= 300) {
        unreadable.add(probe.url);
        continue;
      }
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

      const { hard, cause } = causeOf(probe);
      group(hard ? hardGroups : ambiguousGroups, probe.url, cause, label);
    }

    const summary = [...perCrawler.entries()]
      .map(
        ([label, entry]) =>
          `${label}: ${entry.blocked}/${entry.probed} answered differently`,
      )
      .join("; ");
    const skipped =
      unreadable.size > 0
        ? `; ${unreadable.size} URL(s) not compared, because the browser got a non-2xx there too: ${[...unreadable].slice(0, MAX_SHOWN).join(", ")}`
        : "";
    const found = `${urls.length} URL(s) probed with ${tokens.length} crawler UA(s) from the scanner's address; ${summary}${skipped}`;

    const hard = lines(hardGroups);
    const ambiguous = lines(ambiguousGroups);

    if (hard.length > 0) {
      const shown = hard.slice(0, MAX_SHOWN).join("; ");
      const more =
        hard.length > MAX_SHOWN ? ` (${hard.length - MAX_SHOWN} more)` : "";
      const note =
        ambiguous.length > 0
          ? ` ${ambiguous.length} further finding(s) are ambiguous. ${AMBIGUITY}`
          : "";
      return this.fail(
        `robots.txt admits these crawlers, and the edge answers differently when the User-Agent names them: ${shown}${more}.${note} ${SCOPE}`,
        EXPECTED,
        found,
        CheckPriority.Critical,
      );
    }

    if (ambiguous.length > 0) {
      return this.warn(
        `When the User-Agent names these crawlers, the edge answers differently: ${ambiguous.slice(0, MAX_SHOWN).join("; ")}. ${AMBIGUITY}`,
        EXPECTED,
        found,
        CheckPriority.Medium,
      );
    }

    const consistentNote =
      consistent.length > 0
        ? ` ${consistent.length} probe(s) naming crawlers robots.txt also turns away were refused, which is a consistent posture rather than a defect.`
        : "";
    return this.pass(
      `Every request naming a crawler robots.txt admits got the same response a browser got across ${urls.length} URL(s).${consistentNote}`,
      EXPECTED,
      found,
    );
  }
}
