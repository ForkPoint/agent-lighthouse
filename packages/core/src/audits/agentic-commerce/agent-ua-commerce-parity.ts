// Graduated from proposal 2026-08-22 (Plan 5, Task 25).
// Evidence dossier: docs/evidence/audits/agentic-commerce/agent-ua-commerce-parity.md
//
// OpenAI runs four separately-tokened agents with separately published IP
// ranges. The one that matters for commerce is ChatGPT-User: the shopper's own
// agent, fetching the PDP at the moment of the question. A WAF that answers it
// with a challenge is invisible to any audit that only reads robots.txt.
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import {
  parseRobots,
  isPathAllowed,
  hasNamedGroup,
} from "#core/gatherers/robots";
import {
  AI_CRAWLER_UAS,
  sharedUaProbes,
  type UaProbe,
  BlockClass,
  probeChallenge,
} from "#core/gatherers/ua-parity";
import { BotToken } from "#core/bot-registry";
import { causeOfError } from "#core/probe-evidence";
import { RedirectFailure } from "#core/types";
import { resolvePolicyLinks } from "./acp-policy-link-surface";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** The two OpenAI agents a purchase depends on. */
const TOKENS = [BotToken.ChatGPTUser, BotToken.OAISearchBot].map((token) =>
  token.toLowerCase(),
);
/** How many product pages to probe. */
const MAX_PDPS = 2;
/** Below this share of the browser text, the agent got a stub of the page. */
const TEXT_FLOOR = 0.6;
/** How many findings a message lists before it summarises. */
const MAX_SHOWN = 4;

/**
 * What a probe shows: how the site answers a request from the scanner's own
 * address whose User-Agent names the agent. OpenAI's agents arrive from the
 * published ranges below, which the scanner cannot, so a rule keyed on those
 * ranges can answer the real agent differently.
 */
const SCOPE =
  "These probes come from the scanner's address, not OpenAI's published ranges, so they show how the site answers a request that names the agent, not what the real agent receives.";

/**
 * Why a refusal of the probe only warns. The probe is by definition not the
 * verified agent, and an edge can answer the two differently.
 */
const AMBIGUITY =
  "A challenge, a 403, a 429 or another refusal can be the edge's defence against an unverified request naming the agent, and the real agent, from OpenAI's published ranges, may be answered differently. Confirm against the edge logs before changing anything.";

/** Where the merchant's allowlist should come from: addresses, not UA strings. */
const CIDR_SOURCES =
  "Allowlist the published address ranges from https://openai.com/searchbot.json and https://openai.com/chatgpt-user.json rather than trusting the User-Agent string.";

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
 * The single decisive reason this probe differs, or undefined when it does not.
 *
 * `hard` marks the answers that say something about the site rather than the
 * probe, read the same way `access-crawl-control/ai-crawler-edge-parity` reads
 * them: a pay-per-crawl price, and a stub page with no challenge in it. A
 * challenge (read by the shared `probeChallenge`, so an Anubis wall served with
 * HTTP 200 counts), a 403, a 429, a 503 or any other non-2xx is a refusal an
 * edge can give an unverified request while it admits the verified agent.
 */
function reasonFor(
  probe: UaProbe,
): { hard: boolean; text: string } | undefined {
  // A loop is an answer the agent observes; other transport failures are not.
  if (probe.blockClass === BlockClass.TransportError) {
    return probe.evidence === RedirectFailure.Loop
      ? {
          hard: false,
          text: `a redirect loop where a browser got ${probe.baselineStatus}`,
        }
      : undefined;
  }
  const challenge = probeChallenge(probe);
  if (challenge) return { hard: false, text: `a ${challenge}` };
  if (probe.blockClass === BlockClass.PayPerCrawl) {
    return { hard: true, text: `a pay-per-crawl price (${probe.evidence})` };
  }
  if (
    Math.floor(probe.probeStatus / 100) !==
    Math.floor(probe.baselineStatus / 100)
  ) {
    return {
      hard: false,
      text: `HTTP ${probe.probeStatus} where a browser got ${probe.baselineStatus}`,
    };
  }
  if (probe.textRatio < TEXT_FLOOR) {
    return {
      hard: true,
      text: `${Math.round(probe.textRatio * 100)}% of the text a browser got — a stub, not the page`,
    };
  }
  return undefined;
}

const EXPECTED =
  "Requests naming ChatGPT-User and OAI-SearchBot receive the same response a browser receives on the homepage, the product pages, the cart and the policy pages, and robots.txt admits them on the commerce paths";

const SAMPLE = `# robots.txt — opt out of training without leaving search or the shopper's agent
User-agent: GPTBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# At the edge, allowlist by address, not by User-Agent:
#   https://openai.com/searchbot.json
#   https://openai.com/chatgpt-user.json`;

export class AgentUaCommerceParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/agent-ua-commerce-parity",
    category: "agentic-commerce",
    title:
      "Commerce paths answer shopping-agent User-Agents the way they answer a browser",
    failureTitle:
      "Commerce paths answer differently when the User-Agent names a shopping agent, or robots.txt turns it away",
    description:
      "Issues paired requests to the homepage, sampled product pages, the cart and the linked policy pages with a browser User-Agent and with the ChatGPT-User and OAI-SearchBot User-Agents, detecting WAF blocks, challenge interstitials and stub pages that a robots.txt-only audit cannot see. A stub page or a pay-per-crawl price fails; a challenge or another refusal warns, because an edge can refuse an unverified request naming the agent and still admit the real one. The probes come from the scanner's address, so they show how the site answers a request that names the agent, not what the real agent, arriving from OpenAI's published ranges, receives. Reads the OpenAI robots.txt tokens separately, so opting out of training while staying in search is reported as the deliberate posture it is.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/agentic-commerce/agent-ua-commerce-parity.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Critical,
    guidance: {
      impact:
        "OpenAI operates four separately-tokened agents with separately published IP ranges: OAI-SearchBot (search indexing), ChatGPT-User (user-initiated fetches — the shopper's agent), GPTBot (training) and OAI-AdsBot (ad landing-page validation). Falsifiable claim: if a product page returns 403, 429, 503 or a challenge interstitial to ChatGPT-User or OAI-SearchBot while returning 200 to a browser, ChatGPT cannot read live price and availability nor follow the buy link, so the product cannot be surfaced or transacted no matter how good the feed is. The probe comes from the scanner's address, so it shows the answer to a request that names the agent; a rule keyed on OpenAI's published ranges can answer the real agent differently, so a refusal or a challenge to the probe warns, and only a stub page or a priced 402 fails. That block lives at the WAF or CDN edge, which is why an audit that only parses robots.txt is structurally blind to it. Disproof condition: a site 403ing ChatGPT-User on its product pages that still shows live, accurate prices in ChatGPT.",
      fix: "Separate the four OpenAI tokens instead of treating 'OpenAI' as one switch: Disallow GPTBot if you do not want your catalogue in training, and keep OAI-SearchBot and ChatGPT-User allowed, since those two are what put your product in an answer and let the shopper's agent read the page. At the edge, allowlist the published address ranges from https://openai.com/searchbot.json and https://openai.com/chatgpt-user.json — UA-string rules are both spoofable and, when they misfire, invisible from the dashboard. Then verify from outside with curl -A on a product page, the cart and the policy pages, and check you get the whole page rather than a stub.",
      code: SAMPLE,
      effort: FixEffort.Complex,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/agent-ua-commerce-parity/",
      tags: ["commerce", "waf", "chatgpt", "crawlers", "robots"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const homeUrl = `${ctx.baseUrl}/`;
    // One key per URL, so the homepage and a trailing-slash variant of it are
    // probed and reported once.
    const keyOf = (url: string): string => url.replace(/\/+$/, "");
    // The homepage is always a target, so the two sampled pages are the first
    // two other scanned pages.
    const pdps: string[] = [];
    for (const page of ctx.pages) {
      if (pdps.length >= MAX_PDPS) break;
      const key = keyOf(page.url);
      if (key === keyOf(homeUrl) || pdps.some((url) => keyOf(url) === key))
        continue;
      pdps.push(page.url);
    }
    // A scan of the homepage alone samples the homepage, so its robots.txt
    // rules still count as a commerce path.
    const first = ctx.pages[0];
    if (pdps.length === 0 && first) pdps.push(first.url);
    const cartUrl = `${ctx.baseUrl}/cart`;
    const policies = resolvePolicyLinks(ctx);

    const targets: string[] = [];
    const add = (url: string | undefined): void => {
      if (url && !targets.some((target) => keyOf(target) === keyOf(url)))
        targets.push(url);
    };
    for (const url of [homeUrl, ...pdps, cartUrl]) add(url);
    for (const type of ["terms_of_use", "privacy_policy"] as const) {
      add(policies.get(type));
    }

    const probes = await sharedUaProbes(ctx, targets, TOKENS);
    // A target the scanner itself could not read tells us nothing about agents.
    const comparable = probes.filter(
      (probe) => probe.baselineStatus >= 200 && probe.baselineStatus < 300,
    );
    const cartReachable = comparable.some((probe) => probe.url === cartUrl);

    if (ctx.pages.length === 0 && !cartReachable) {
      return this.notApplicable(
        "No product page was scanned and /cart does not answer, so there is no commerce path to probe.",
        EXPECTED,
        "No product page, no cart",
      );
    }

    if (comparable.length === 0) {
      return this.notApplicable(
        "The scanner's own browser-UA requests were not answered, so this would measure the scanner being blocked rather than the site's posture toward shopping agents.",
        EXPECTED,
        `${probes.length} probe(s), none comparable`,
      );
    }

    // An agent probe with no HTTP response was not compared: the request may
    // never have been sent, so it says nothing about how the site treats the
    // agent.
    const unassessed = comparable.filter(
      (probe) =>
        probe.blockClass === BlockClass.TransportError &&
        probe.evidence !== RedirectFailure.Loop,
    );
    const coverage =
      unassessed.length > 0
        ? ` Not assessed: ${unassessed
            .slice(0, MAX_SHOWN)
            .map(
              (probe) =>
                `the ${labelFor(probe.token)} request to ${probe.url} ${causeOfError(probe.evidence)}`,
            )
            .join(
              "; ",
            )}${unassessed.length > MAX_SHOWN ? ` (${unassessed.length - MAX_SHOWN} more)` : ""}.`
        : "";

    const findings: string[] = [];
    const refusals: string[] = [];
    // The scope note belongs to probe findings only. A robots.txt finding is
    // read from the file, not from a probe.
    let probeFindings = 0;
    for (const probe of comparable) {
      const reason = reasonFor(probe);
      if (!reason) continue;
      const line = `A request naming ${labelFor(probe.token)} gets ${reason.text} at ${probe.url}`;
      if (reason.hard) {
        probeFindings += 1;
        findings.push(line);
      } else {
        refusals.push(line);
      }
    }

    // robots.txt is the other half: an edge that lets the agent through cannot
    // help if the file turns it away on the paths that carry the offer.
    const robots = ctx.rootFiles["/robots.txt"];
    const groups = parseRobots(
      robots && robots.status === 200 ? robots.body : "",
    );
    const commercePaths = [...pdps, ...(cartReachable ? [cartUrl] : [])];
    for (const token of TOKENS) {
      for (const url of commercePaths) {
        if (isPathAllowed(groups, token, pathOf(url))) continue;
        findings.push(
          `robots.txt disallows ${labelFor(token)} at ${url} — commerce-fatal: the offer cannot be read or transacted from an answer`,
        );
      }
    }

    // Opting out of training while staying in search is a policy, and a common
    // deliberate one. It is reported, never scored.
    const trainingOptOut =
      hasNamedGroup(groups, "gptbot") &&
      !isPathAllowed(groups, "gptbot", "/") &&
      isPathAllowed(groups, "oai-searchbot", "/");
    const posture = trainingOptOut
      ? " robots.txt disallows GPTBot while admitting OAI-SearchBot: opting out of training while staying in search is a deliberate posture, and this audit scores nothing against it."
      : "";

    const found = `${targets.length} commerce target(s) probed from the scanner's address with the ${TOKENS.map(labelFor).join(" and ")} User-Agents; ${comparable.length - unassessed.length} comparable probe(s); ${findings.length} finding(s); ${refusals.length} ambiguous refusal(s); ${unassessed.length} not assessed`;

    if (findings.length > 0) {
      const shown = findings.slice(0, MAX_SHOWN).join("; ");
      const more =
        findings.length > MAX_SHOWN
          ? ` (${findings.length - MAX_SHOWN} more)`
          : "";
      const note =
        refusals.length > 0
          ? ` ${refusals.length} further finding(s) are ambiguous. ${AMBIGUITY}`
          : "";
      const scope = probeFindings > 0 || refusals.length > 0 ? `${SCOPE} ` : "";
      return this.fail(
        `${shown}${more}.${note} ${scope}${CIDR_SOURCES}${posture}${coverage}`,
        EXPECTED,
        found,
        CheckPriority.Critical,
      );
    }

    if (refusals.length > 0) {
      const shown = refusals.slice(0, MAX_SHOWN).join("; ");
      const more =
        refusals.length > MAX_SHOWN
          ? ` (${refusals.length - MAX_SHOWN} more)`
          : "";
      return this.warn(
        `${shown}${more}. ${SCOPE} ${AMBIGUITY} ${CIDR_SOURCES}${posture}${coverage}`,
        EXPECTED,
        found,
        CheckPriority.Medium,
      );
    }

    if (unassessed.length > 0) {
      return this.notApplicable(
        `No assessed request naming a shopping agent was answered differently from a browser, but coverage is incomplete.${coverage}`,
        EXPECTED,
        found,
      );
    }

    return this.pass(
      `Requests naming both shopping agents got the same response a browser got across ${targets.length} commerce target(s), and robots.txt admits them there.${posture}`,
      EXPECTED,
      found,
    );
  }
}
