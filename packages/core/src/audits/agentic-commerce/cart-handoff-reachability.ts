import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';
import { platformFingerprint, type CommercePlatform } from '../../gatherers/commerce';
import { AI_CRAWLER_UAS, BASELINE_UA, sharedUaFetch } from '../../gatherers/ua-parity';
import { parseRobots, isPathAllowed } from '../../gatherers/robots';

/** Where each storefront keeps its cart. */
const CANDIDATES: Record<CommercePlatform, string[]> = {
  shopify: ['/cart'],
  woocommerce: ['/cart', '/checkout'],
  bigcommerce: ['/cart.php'],
  magento: ['/checkout/cart'],
};

/** Tried when no platform fingerprint says which paths to expect. */
const GENERIC = ['/cart', '/checkout'];

/** A final URL that lands here is an account wall on the buy path. */
const LOGIN_PATH = /\/(login|signin|sign-in|account\/login|customer\/account\/login)/i;

/** Bot-challenge widgets, as they appear in a document. */
const CHALLENGE = [
  { label: 'Cloudflare Turnstile', pattern: /challenges\.cloudflare\.com\/turnstile/i },
  { label: 'reCAPTCHA', pattern: /www\.google\.com\/recaptcha/i },
  { label: 'hCaptcha', pattern: /hcaptcha\.com/i },
  { label: 'a data-sitekey widget', pattern: /data-sitekey\s*=/i },
];

/** The shopper's agent: the UA that matters on a buy path. */
const AGENT_TOKEN = 'chatgpt-user';
/** Text this short means the document rendered nothing without JavaScript. */
const MIN_TEXT = 200;

const AGENT_UA =
  AI_CRAWLER_UAS.find((agent) => agent.token === AGENT_TOKEN)?.ua ?? BASELINE_UA;

/** Visible text length, with script, style and markup removed. */
export function textLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** True when the document renders nothing without JavaScript and says nothing instead. */
export function jsOnlyDocument(html: string): boolean {
  if (textLength(html) >= MIN_TEXT) return false;
  const noscript = /<noscript[^>]*>([\s\S]*?)<\/noscript>/i.exec(html);
  return noscript === null || textLength(noscript[1] ?? '') === 0;
}

/** Which challenge widget, if any, this document mounts. */
export function challengeIn(html: string): string | undefined {
  return CHALLENGE.find((entry) => entry.pattern.test(html))?.label;
}

const EXPECTED =
  'The cart and checkout paths answer a shopping agent without an account wall and without a bot challenge';

export class CartHandoffReachabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'agentic-commerce/cart-handoff-reachability',
    category: 'agentic-commerce',
    title: 'Cart Handoff Reachability',
    failureTitle: 'Cart Handoff Reachability',
    description:
      'Reads the storefront cart and checkout paths — the URL an agent hands a buyer to, whether through an ACP `continue_url` or a computer-use agent driving the storefront — as a browser and as ChatGPT-User, and reports an account wall, a bot challenge on the checkout document, or a hard block. Read-only: every request is a GET, nothing is ever added to a cart.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'high',
    dossier: 'docs/evidence/audits/agentic-commerce/cart-handoff-reachability.md',
    guidance: {
      impact:
        'Every upstream signal can be perfect and the purchase still dies at the last click. If the cart 302s to a login form because guest checkout is off, or Turnstile is mounted on the checkout document alone, the agent walks the buyer to a wall it cannot pass. ACP reserves a `requires_sign_in` message code for exactly this case, which is a description of the failure, not a fix for it.',
      fix: 'Allow guest checkout, or at least let an unauthenticated buyer reach the cart and see the totals. Keep bot challenges off the cart and checkout documents — challenge the payment submission instead, where a human is present. Allow ChatGPT-User in robots.txt and at the edge on cart paths: blocking GPTBot does not block it, and the two are separately tokened.',
      effort: 'moderate',
      docsUrl:
        'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/agentic-commerce/cart-handoff-reachability.md',
      tags: ['commerce', 'cart', 'checkout', 'acp', 'chatgpt'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const platform = ctx.pages.map((page) => platformFingerprint(page)).find((p) => p !== undefined);
    const paths = platform ? CANDIDATES[platform] : GENERIC;

    const robotsFile = ctx.rootFiles['/robots.txt'];
    const groups =
      robotsFile && robotsFile.status === 200 ? parseRobots(robotsFile.body) : [];

    const failures: string[] = [];
    const warnings: string[] = [];
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
        ['a browser', browser],
        ['ChatGPT-User', agent],
      ];
      const statuses = seen
        .filter((entry): entry is [string, FetchResult] => entry[1] !== undefined)
        .map(([label, result]) => `${label} ${result.status}`);
      if (statuses.length > 0) reachable.push(`${path}: ${statuses.join(', ')}`);

      for (const [label, result] of seen) {
        if (!result) continue;
        if (result.status === 403 || result.status === 429) {
          failures.push(`${path} answers ${result.status} to ${label}, so the handoff is blocked outright`);
        }
      }

      const document = agent && agent.status === 200 ? agent : browser;
      if (!document || document.status === 404) continue;
      answered += 1;

      const finalPath = (() => {
        try {
          return new URL(document.finalUrl || url).pathname;
        } catch {
          return path;
        }
      })();
      if (LOGIN_PATH.test(finalPath)) {
        failures.push(
          `${path} ends at ${finalPath}, an account wall on the buy path: a shopper with no account cannot get past it`,
        );
        continue;
      }

      const challenge = challengeIn(document.body);
      if (challenge) {
        failures.push(`${path} mounts ${challenge} on the document an agent has to read`);
        continue;
      }

      if (jsOnlyDocument(document.body)) {
        warnings.push(
          `${path} renders nothing without JavaScript and carries no <noscript> fallback, so an agent that does not execute scripts sees an empty page`,
        );
      }
    }

    if (answered === 0 && failures.length === 0) {
      if (!platform) {
        return this.notApplicable(
          `No storefront platform was fingerprinted and neither ${GENERIC.join(' nor ')} answers, so there is no cart surface to reach.`,
          EXPECTED,
          `${probed} path(s) probed, none answered`,
        );
      }
      failures.push(
        `This is a ${platform} storefront, but none of ${paths.join(', ')} answers, so an agent has no discoverable cart surface to hand a buyer to`,
      );
    }

    const details = {
      platform: platform ?? 'unfingerprinted',
      pathsProbed: probed,
      pathsAnswering: answered,
      disallowedByRobots: disallowed,
      reachable: reachable.slice(0, 6),
      failures: failures.slice(0, 6),
      warnings: warnings.slice(0, 6),
    };
    const found = [
      `platform ${platform ?? 'unknown'}`,
      `${probed} path(s) probed as a browser and as ChatGPT-User`,
      `${answered} answering`,
      disallowed.length > 0 ? `${disallowed.length} disallowed by robots.txt` : 'none disallowed',
    ].join('; ');
    const displayValue = `${answered}/${paths.length} cart path(s) reachable`;

    if (failures.length > 0) {
      return {
        ...this.fail(
          failures[0]!,
          EXPECTED,
          found,
          'Let an unauthenticated shopper reach the cart, and keep bot challenges off the cart and checkout documents.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(warnings[0]!, EXPECTED, found, 'Render the cart server-side, or put the essentials in a <noscript> fallback.'),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'The cart path answers a shopping agent with no account wall and no bot challenge.',
        EXPECTED,
        found,
      ),
      displayValue,
      details,
    };
  }
}
