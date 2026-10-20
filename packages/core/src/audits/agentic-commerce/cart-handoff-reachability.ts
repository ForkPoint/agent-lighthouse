import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext } from "#core/check-context";
import type { FetchResult } from "#core/fetcher";
import {
  platformFingerprint,
  type CommercePlatform,
} from "#core/gatherers/commerce";
import {
  AI_CRAWLER_UAS,
  BASELINE_UA,
  sharedUaFetch,
} from "#core/gatherers/ua-parity";
import { BotToken } from "#core/bot-registry";
import { parseRobots, isPathAllowed } from "#core/gatherers/robots";
import { detectWafProtection } from "#core/waf-detector";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Where each storefront keeps its cart. */
const CANDIDATES: Record<CommercePlatform, string[]> = {
  shopify: ["/cart"],
  woocommerce: ["/cart", "/checkout"],
  bigcommerce: ["/cart.php"],
  magento: ["/checkout/cart"],
};

/** Tried when no platform fingerprint says which paths to expect. */
const GENERIC = ["/cart", "/checkout"];

/** A final URL that lands here is an account wall on the buy path. */
const LOGIN_PATH =
  /\/(login|signin|sign-in|account\/login|customer\/account\/login)/i;

/** Bot-challenge widgets, as they appear in a document. */
const CHALLENGE = [
  {
    label: "Cloudflare Turnstile",
    pattern: /challenges\.cloudflare\.com\/turnstile/i,
  },
  { label: "reCAPTCHA", pattern: /www\.google\.com\/recaptcha/i },
  { label: "hCaptcha", pattern: /hcaptcha\.com/i },
  { label: "a data-sitekey widget", pattern: /data-sitekey\s*=/i },
];

/**
 * The shopper's agent: the UA that matters on a buy path. The request comes
 * from the scanner's address, not OpenAI's published ranges, so a finding says
 * how the cart answers a request that names ChatGPT-User, not what the real
 * agent receives.
 */
const AGENT_TOKEN = BotToken.ChatGPTUser.toLowerCase();
/** Text this short means the document rendered nothing without JavaScript. */
const MIN_TEXT = 200;

/** The baseline label in findings. */
const BROWSER = "a browser";

const AGENT_UA =
  AI_CRAWLER_UAS.find((agent) => agent.token === AGENT_TOKEN)?.ua ??
  BASELINE_UA;

/** Visible text length, with script, style and markup removed. */
export function textLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** True when the document renders nothing without JavaScript and says nothing instead. */
export function jsOnlyDocument(html: string): boolean {
  if (textLength(html) >= MIN_TEXT) return false;
  const noscript = /<noscript[^>]*>([\s\S]*?)<\/noscript>/i.exec(html);
  return noscript === null || textLength(noscript[1] ?? "") === 0;
}

/** Which challenge widget, if any, this document mounts. */
export function challengeIn(html: string): string | undefined {
  return CHALLENGE.find((entry) => entry.pattern.test(html))?.label;
}

/**
 * Why an answer only the ChatGPT-User request got warns. The request is by
 * definition not the verified agent, and an edge can answer the two
 * differently.
 */
const AMBIGUITY =
  "That can be the edge's defence against an unverified request naming the agent; the real agent, from OpenAI's published ranges, may be answered differently";

/** True when the shared detector reads this 2xx response as a challenge page. */
function isWall(url: string, result: FetchResult): boolean {
  if (result.status < 200 || result.status >= 300) return false;
  const wall = detectWafProtection(url, result, {}, 1);
  return Boolean(wall?.isBlocked && !wall.isRateLimit);
}

/** True when a challenge widget is the whole document. */
function isWidgetWall(html: string): boolean {
  return challengeIn(html) !== undefined && textLength(html) < MIN_TEXT;
}

const EXPECTED =
  "The cart and checkout paths answer a shopping agent without an account wall and without a bot challenge";

export class CartHandoffReachabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/cart-handoff-reachability",
    category: "agentic-commerce",
    title: "Cart Handoff Reachability",
    failureTitle: "Cart Handoff Reachability",
    description:
      "Reads the storefront cart and checkout paths — the URL an agent hands a buyer to, whether through an ACP `continue_url` or a computer-use agent driving the storefront — with a browser User-Agent and with the ChatGPT-User User-Agent, and reports an account wall, a bot challenge on the checkout document, or a hard block. A refusal or challenge only the ChatGPT-User request gets, while a browser gets the cart, warns: the request comes from the scanner's address, and an edge can refuse it while admitting the real agent. Read-only: every request is a GET, nothing is ever added to a cart.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    tier: AuditTier.Scored,
    evidenceGrade: EvidenceGrade.B,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    defaultPriority: CheckPriority.High,
    dossier:
      "docs/evidence/audits/agentic-commerce/cart-handoff-reachability.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    guidance: {
      impact:
        "Every upstream signal can be perfect and the purchase still dies at the last click. If the cart 302s to a login form because guest checkout is off, or Turnstile is mounted on the checkout document alone, the agent walks the buyer to a wall it cannot pass. ACP reserves a `requires_sign_in` message code for exactly this case, which is a description of the failure, not a fix for it.",
      fix: "Allow guest checkout, or at least let an unauthenticated buyer reach the cart and see the totals. Keep bot challenges off the cart and checkout documents — challenge the payment submission instead, where a human is present. Allow ChatGPT-User in robots.txt and at the edge on cart paths: blocking GPTBot does not block it, and the two are separately tokened.",
      effort: FixEffort.Moderate,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/cart-handoff-reachability/",
      tags: ["commerce", "cart", "checkout", "acp", "chatgpt"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const platform = ctx.pages
      .map((page) => platformFingerprint(page))
      .find((p) => p !== undefined);
    const paths = platform ? CANDIDATES[platform] : GENERIC;

    const robotsFile = ctx.rootFiles["/robots.txt"];
    const groups =
      robotsFile && robotsFile.status === 200
        ? parseRobots(robotsFile.body)
        : [];

    const failures: string[] = [];
    const warnings: string[] = [];
    // Answers only the unverified ChatGPT-User request got. Reported before the
    // JavaScript warnings, never scored as failures.
    const ambiguous: string[] = [];
    const disallowed: string[] = [];
    const reachable: string[] = [];
    let answered = 0;
    let probed = 0;

    for (const path of paths) {
      const url = `${ctx.baseUrl}${path}`;

      // A Disallow is reported, never overridden: fetching it anyway would make
      // this audit the thing the site asked agents not to do.
      if (!isPathAllowed(groups, AGENT_TOKEN, path)) {
        disallowed.push(path);
        continue;
      }

      const browser = await sharedUaFetch(ctx, url, BASELINE_UA);
      const agent = await sharedUaFetch(ctx, url, AGENT_UA);
      probed += 1;
      if (!browser && !agent) continue;

      const seen: Array<[string, FetchResult | undefined]> = [
        [BROWSER, browser],
        ["a request naming ChatGPT-User", agent],
      ];
      const statuses = seen
        .filter(
          (entry): entry is [string, FetchResult] => entry[1] !== undefined,
        )
        .map(
          ([label, result]) =>
            `${label === BROWSER ? "a browser" : "ChatGPT-User UA"} ${result.status}`,
        );
      if (statuses.length > 0)
        reachable.push(`${path}: ${statuses.join(", ")}`);

      const browserOk =
        browser !== undefined && browser.status >= 200 && browser.status < 300;
      if (browser && (browser.status === 403 || browser.status === 429)) {
        failures.push(
          `${path} answers ${browser.status} to ${BROWSER}, so the handoff is blocked outright`,
        );
      }
      // The ChatGPT-User request is not the verified agent, and an edge can
      // refuse it while it admits the real one, so its refusal warns. It is
      // compared only against a cart the browser could read.
      if (
        agent &&
        browserOk &&
        (agent.status === 403 || agent.status === 429)
      ) {
        ambiguous.push(
          `${path} answers ${agent.status} to a request naming ChatGPT-User from the scanner's address, while a browser got ${browser.status}. ${AMBIGUITY}`,
        );
      }

      const document = agent && agent.status === 200 ? agent : browser;
      if (!document || document.status === 404) continue;
      answered += 1;
      // The checks below read the ChatGPT-User response whenever it is a 200,
      // so each finding names whose response it read.
      const reader =
        document === agent ? "a request naming ChatGPT-User" : "a browser";
      // A wall in the ChatGPT-User response that the browser response does not
      // carry is served to the unverified request only, so it warns.
      const agentOnly = (blocked: (result: FetchResult) => boolean): boolean =>
        document === agent &&
        browser !== undefined &&
        browserOk &&
        !blocked(browser);

      const finalPath = (() => {
        try {
          return new URL(document.finalUrl || url).pathname;
        } catch {
          return path;
        }
      })();
      if (LOGIN_PATH.test(finalPath)) {
        failures.push(
          `${path} ends at ${finalPath} for ${reader}, an account wall on the buy path: a shopper with no account cannot get past it`,
        );
        continue;
      }

      // A challenge page in place of the cart is a wall. The shared detector
      // owns what a challenge page looks like, so this reads its verdict
      // rather than keeping a second list of markers.
      const wall =
        document.status >= 200 && document.status < 300
          ? detectWafProtection(url, document, {}, 1)
          : null;
      if (wall?.isBlocked && !wall.isRateLimit) {
        const message = `${path} answers ${reader} with ${wall.name} instead of the cart (${wall.reason}), so that request never reaches the cart document`;
        if (agentOnly((result) => isWall(url, result))) {
          ambiguous.push(`${message}. A browser got the cart. ${AMBIGUITY}`);
        } else {
          failures.push(message);
        }
        continue;
      }

      // A widget on a readable cart guards a form on it, which is where the
      // guidance asks a site to put its challenge. Only a widget on a document
      // with nothing else to read stands between the agent and the cart.
      const challenge = challengeIn(document.body);
      if (challenge && textLength(document.body) < MIN_TEXT) {
        const message = `${path} mounts ${challenge} on the document served to ${reader}, which has no readable cart content, so the challenge is the page that request has to read`;
        if (agentOnly((result) => isWidgetWall(result.body))) {
          ambiguous.push(`${message}. A browser got the cart. ${AMBIGUITY}`);
        } else {
          failures.push(message);
        }
        continue;
      }

      if (jsOnlyDocument(document.body)) {
        warnings.push(
          `${path} renders nothing without JavaScript and carries no <noscript> fallback, so an agent that does not execute scripts sees an empty page`,
        );
      }
    }

    if (answered === 0 && failures.length === 0 && ambiguous.length === 0) {
      if (!platform) {
        return this.notApplicable(
          `No storefront platform was fingerprinted and neither ${GENERIC.join(" nor ")} answers, so there is no cart surface to reach.`,
          EXPECTED,
          `${probed} path(s) probed, none answered`,
        );
      }
      failures.push(
        `This is a ${platform} storefront, but none of ${paths.join(", ")} answers, so an agent has no discoverable cart surface to hand a buyer to`,
      );
    }

    const details = {
      platform: platform ?? "unfingerprinted",
      pathsProbed: probed,
      pathsAnswering: answered,
      disallowedByRobots: disallowed,
      reachable: reachable.slice(0, 6),
      failures: failures.slice(0, 6),
      warnings: [...ambiguous, ...warnings].slice(0, 6),
    };
    const found = [
      `platform ${platform ?? "unknown"}`,
      `${probed} path(s) probed with a browser and a ChatGPT-User User-Agent`,
      `${answered} answering`,
      disallowed.length > 0
        ? `${disallowed.length} disallowed by robots.txt`
        : "none disallowed",
    ].join("; ");
    const displayValue = `${answered}/${paths.length} cart path(s) reachable`;

    if (failures.length > 0) {
      // Answers only the ChatGPT-User request got are counted beside the
      // failure, as edge parity and commerce parity count theirs.
      const note =
        ambiguous.length > 0
          ? `. ${ambiguous.length} further finding(s) only the ChatGPT-User request got are ambiguous and listed in details.warnings`
          : "";
      return {
        ...this.fail(
          `${failures[0]!}${note}`,
          EXPECTED,
          found,
          "Let an unauthenticated shopper reach the cart, and keep bot challenges off the cart and checkout documents.",
        ),
        displayValue,
        details,
      };
    }

    if (ambiguous.length > 0) {
      return {
        ...this.warn(
          ambiguous[0]!,
          EXPECTED,
          found,
          "Confirm in the edge logs how requests from OpenAI's published ChatGPT-User ranges are answered on the cart, and allowlist those ranges rather than the User-Agent string.",
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          warnings[0]!,
          EXPECTED,
          found,
          "Render the cart server-side, or put the essentials in a <noscript> fallback.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        "The cart path answers a shopping agent with no account wall and no bot challenge.",
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
