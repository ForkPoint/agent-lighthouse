// Graduated from proposal 2026-08-22 (Plan 5, Task 25).
// Evidence dossier: docs/evidence/audits/agentic-commerce/agent-ua-commerce-parity.md
//
// OpenAI runs four separately-tokened agents with separately published IP
// ranges. The one that matters for commerce is ChatGPT-User: the shopper's own
// agent, fetching the PDP at the moment of the question. A WAF that answers it
// with a challenge is invisible to any audit that only reads robots.txt.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import {
  parseRobots,
  isPathAllowed,
  hasNamedGroup,
} from "../../gatherers/robots";
import {
  AI_CRAWLER_UAS,
  sharedUaProbes,
  type UaProbe,
} from "../../gatherers/ua-parity";
import { resolvePolicyLinks } from "./acp-policy-link-surface";

/** The two OpenAI agents a purchase depends on. */
const TOKENS = ["chatgpt-user", "oai-searchbot"];
/** How many product pages to probe. */
const MAX_PDPS = 2;
/** Below this share of the browser text, the agent got a stub of the page. */
const TEXT_FLOOR = 0.6;
/** Statuses that are a block however the body reads. */
const BLOCKING_STATUS = new Set([403, 429, 503]);
/** How many findings a message lists before it summarises. */
const MAX_SHOWN = 4;

/** Body markers left by the common bot-challenge products. */
const CHALLENGE_MARKERS = [
  "Just a moment...",
  "cf-chl-",
  "__cf_chl",
  "_Incapsula_",
  "px-captcha",
  "/akam/",
];

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

/** The single decisive reason this probe failed, or undefined when it did not. */
function reasonFor(probe: UaProbe): string | undefined {
  const marker = CHALLENGE_MARKERS.find((m) => probe.probeBody.includes(m));
  if (marker) return `a bot challenge (body contains "${marker}")`;
  if (BLOCKING_STATUS.has(probe.probeStatus)) {
    return `HTTP ${probe.probeStatus} where a browser got ${probe.baselineStatus}`;
  }
  if (
    Math.floor(probe.probeStatus / 100) !==
    Math.floor(probe.baselineStatus / 100)
  ) {
    return `HTTP ${probe.probeStatus} where a browser got ${probe.baselineStatus}`;
  }
  if (probe.textRatio < TEXT_FLOOR) {
    return `${Math.round(probe.textRatio * 100)}% of the text a browser got — a stub, not the page`;
  }
  return undefined;
}

const EXPECTED =
  "ChatGPT-User and OAI-SearchBot receive the same response a browser receives on the homepage, the product pages, the cart and the policy pages, and robots.txt admits them on the commerce paths";

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
    title: "Shopping agents can fetch the commerce paths",
    failureTitle: "Shopping agents are blocked on the commerce paths",
    description:
      "Issues paired requests to the homepage, sampled product pages, the cart and the linked policy pages with a browser User-Agent and with the ChatGPT-User and OAI-SearchBot User-Agents, detecting WAF blocks, challenge interstitials and stub pages that a robots.txt-only audit cannot see. Reads the OpenAI robots.txt tokens separately, so opting out of training while staying in search is reported as the deliberate posture it is.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier:
      "docs/evidence/audits/agentic-commerce/agent-ua-commerce-parity.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "critical",
    guidance: {
      impact:
        "OpenAI operates four separately-tokened agents with separately published IP ranges: OAI-SearchBot (search indexing), ChatGPT-User (user-initiated fetches — the shopper's agent), GPTBot (training) and OAI-AdsBot (ad landing-page validation). Falsifiable claim: if a product page returns 403, 429, 503 or a challenge interstitial to ChatGPT-User or OAI-SearchBot while returning 200 to a browser, ChatGPT cannot read live price and availability nor follow the buy link, so the product cannot be surfaced or transacted no matter how good the feed is. That block lives at the WAF or CDN edge, which is why an audit that only parses robots.txt is structurally blind to it. Disproof condition: a site 403ing ChatGPT-User on its product pages that still shows live, accurate prices in ChatGPT.",
      fix: "Separate the four OpenAI tokens instead of treating 'OpenAI' as one switch: Disallow GPTBot if you do not want your catalogue in training, and keep OAI-SearchBot and ChatGPT-User allowed, since those two are what put your product in an answer and let the shopper's agent read the page. At the edge, allowlist the published address ranges from https://openai.com/searchbot.json and https://openai.com/chatgpt-user.json — UA-string rules are both spoofable and, when they misfire, invisible from the dashboard. Then verify from outside with curl -A on a product page, the cart and the policy pages, and check you get the whole page rather than a stub.",
      code: SAMPLE,
      effort: "complex",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/agent-ua-commerce-parity/",
      tags: ["commerce", "waf", "chatgpt", "crawlers", "robots"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const pdps = ctx.pages.slice(0, MAX_PDPS).map((page) => page.url);
    const cartUrl = `${ctx.baseUrl}/cart`;
    const policies = resolvePolicyLinks(ctx);

    const targets = [`${ctx.baseUrl}/`, ...pdps, cartUrl];
    for (const type of ["terms_of_use", "privacy_policy"] as const) {
      const url = policies.get(type);
      if (url && !targets.includes(url)) targets.push(url);
    }

    const probes = await sharedUaProbes(ctx, targets, TOKENS);
    // A target the scanner itself could not read tells us nothing about agents.
    const comparable = probes.filter(
      (probe) => probe.baselineStatus >= 200 && probe.baselineStatus < 300,
    );
    const cartReachable = comparable.some((probe) => probe.url === cartUrl);

    if (pdps.length === 0 && !cartReachable) {
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

    const findings: string[] = [];
    for (const probe of comparable) {
      const reason = reasonFor(probe);
      if (reason)
        findings.push(
          `${labelFor(probe.token)} gets ${reason} at ${probe.url}`,
        );
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

    const found = `${targets.length} commerce target(s) probed as ${TOKENS.map(labelFor).join(" and ")}; ${comparable.length} comparable probe(s); ${findings.length} finding(s)`;

    if (findings.length > 0) {
      const shown = findings.slice(0, MAX_SHOWN).join("; ");
      const more =
        findings.length > MAX_SHOWN
          ? ` (${findings.length - MAX_SHOWN} more)`
          : "";
      return this.fail(
        `${shown}${more}. ${CIDR_SOURCES}${posture}`,
        EXPECTED,
        found,
        "critical",
      );
    }

    return this.pass(
      `Both shopping agents got the same response a browser got across ${targets.length} commerce target(s), and robots.txt admits them there.${posture}`,
      EXPECTED,
      found,
    );
  }
}
