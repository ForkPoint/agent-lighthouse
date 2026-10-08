// Graduated from proposal 2026-08-22 (Plan 5, Task 16).
// Evidence dossier: docs/evidence/audits/agentic-commerce/acp-policy-link-surface.md
//
// `resolvePolicyLinks` is exported so other audits can reuse the resolved
// terms_of_use / privacy_policy targets rather than re-deriving them.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { isSafeUrl } from "../../url-utils";
import { probeSecurityUrl } from "../../gatherers/security";
import { parseHtml } from "../../parser";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "../../types";

/** The ACP CheckoutSession `links` enum, in spec order. */
export const ACP_LINK_TYPES = [
  "terms_of_use",
  "privacy_policy",
  "return_policy",
  "shipping_policy",
  "contact_us",
  "about_us",
  "faq",
  "support",
] as const;

export type AcpLinkType = (typeof ACP_LINK_TYPES)[number];

/** Without these two a merchant cannot set is_eligible_checkout=true at all. */
const HARD_GATES: readonly AcpLinkType[] = ["terms_of_use", "privacy_policy"];

/** Path patterns, then anchor-text patterns, tried in enum order. */
const CLASSIFIERS: Record<AcpLinkType, { path: RegExp; text: RegExp }> = {
  terms_of_use: {
    path: /\/terms|\/tos\b|terms-of-(service|use|sale)/,
    text: /terms|conditions/,
  },
  privacy_policy: {
    path: /\/privacy|privacy-(policy|notice)/,
    text: /privacy/,
  },
  return_policy: {
    path: /\/returns?\b|\/refunds?\b|return-policy|\/exchanges/,
    text: /returns?|refunds?|exchanges/,
  },
  shipping_policy: {
    path: /\/shipping|\/delivery|shipping-policy/,
    text: /shipping|delivery/,
  },
  contact_us: { path: /\/contact/, text: /contact/ },
  about_us: { path: /\/about/, text: /about/ },
  faq: { path: /\/faqs?\b|frequently-asked/, text: /faqs?|frequently asked/ },
  support: {
    path: /\/support|\/help\b|\/customer-(service|care)/,
    text: /support|help/,
  },
};

/** Titles and headings a soft 404 announces itself with. */
const SOFT_404 = /page not found|not found|404|doesn'?t exist|does not exist/i;
/** A policy page shorter than this is not a policy page. */
const MIN_POLICY_CHARS = 500;
/** A body this large with no text is a client-rendered shell. */
const SHELL_BODY_CHARS = 2_000;
/** Hops allowed before the target counts as unstable. */
const MAX_REDIRECTS = 3;

/** The signature every PDF file starts with. */
const PDF_SIGNATURE = "%PDF-";

/**
 * The first same-page candidate URL for each ACP link type, in document order.
 *
 * Classification is by URL path first, anchor text second, so a link whose path
 * is opaque (`/p/12345`) is still classified when its label is not.
 */
export function resolvePolicyLinks(
  ctx: CheckContext,
): Map<AcpLinkType, string> {
  const resolved = new Map<AcpLinkType, string>();

  for (const page of ctx.pages) {
    const $ = page.$;
    $("a[href]").each((_i, el) => {
      const href = ($(el).attr("href") ?? "").trim();
      if (!href || href.startsWith("#")) return;
      let absolute: URL;
      try {
        absolute = new URL(href, page.url);
      } catch {
        return;
      }
      if (absolute.protocol !== "https:" && absolute.protocol !== "http:")
        return;
      const path = absolute.pathname.toLowerCase();
      const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase();
      for (const type of ACP_LINK_TYPES) {
        if (resolved.has(type)) continue;
        const { path: byPath, text: byText } = CLASSIFIERS[type];
        if (byPath.test(path) || (text && byText.test(text))) {
          resolved.set(type, absolute.toString());
          return;
        }
      }
    });
  }

  return resolved;
}

/** True when any scanned page carries a link the audit could classify. */
function hasAnchors(ctx: CheckContext): boolean {
  return ctx.pages.some((page) => page.$("a[href]").length > 0);
}

interface Check {
  type: AcpLinkType;
  url: string;
  ok: boolean;
  reason?: string;
}

async function validate(
  ctx: CheckContext,
  type: AcpLinkType,
  url: string,
): Promise<Check> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { type, url, ok: false, reason: "is not a valid URL" };
  }
  if (current.protocol !== "https:") {
    return { type, url, ok: false, reason: "is not served over HTTPS" };
  }
  // No domain rule. The ACP `Link` schema asks only for `url: string,
  // format: uri`, and the feed spec only for a public policy URL, so a
  // policy hosted on a sister domain or an asset CDN is a usable target.
  // Every hop is still gated by isSafeUrl() and counted below.

  let hops = 0;
  let result;
  for (;;) {
    if (!(await isSafeUrl(current.toString()))) {
      return {
        type,
        url,
        ok: false,
        reason: "is blocked by the URL safety gate",
      };
    }
    result = await probeSecurityUrl(ctx, current.toString(), {
      followRedirects: false,
    });
    if (!result) return { type, url, ok: false, reason: "is unreachable" };
    const location = result.headers["location"];
    if (result.status >= 300 && result.status < 400 && location) {
      hops += 1;
      if (hops > MAX_REDIRECTS) {
        return {
          type,
          url,
          ok: false,
          reason: `sits behind more than ${MAX_REDIRECTS} redirects`,
        };
      }
      try {
        current = new URL(location, current);
      } catch {
        return {
          type,
          url,
          ok: false,
          reason: "redirects to an unparseable location",
        };
      }
      continue;
    }
    break;
  }

  if (result.status !== 200) {
    return { type, url, ok: false, reason: `returned HTTP ${result.status}` };
  }

  // A PDF policy is a usable link target: no cited source requires HTML.
  // Its text is not extracted (no PDF parser is carried), so the soft-404
  // and text-floor checks below, which read HTML, do not apply to it. The
  // signature check keeps an error page mislabelled as a PDF from passing.
  if (/application\/pdf/i.test(result.contentType)) {
    if (!result.body.startsWith(PDF_SIGNATURE)) {
      return {
        type,
        url,
        ok: false,
        reason: "is served as application/pdf but is not a PDF document",
      };
    }
    return { type, url: current.toString(), ok: true };
  }

  if (!/text\/html/i.test(result.contentType)) {
    return {
      type,
      url,
      ok: false,
      reason: `is served as ${result.contentType || "an unknown type"}, not text/html or application/pdf`,
    };
  }

  const $ = parseHtml(result.body);
  const title = $("title").first().text().trim();
  const heading = $("h1").first().text().trim();
  if (SOFT_404.test(title) || SOFT_404.test(heading)) {
    return {
      type,
      url,
      ok: false,
      reason: `is a soft 404 ("${title || heading}")`,
    };
  }

  $("script, style, noscript, template").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  if (text.length < MIN_POLICY_CHARS) {
    const reason =
      result.body.length > SHELL_BODY_CHARS
        ? "has no policy text in the initial HTML — an agent that does not run JavaScript sees an empty shell"
        : `carries only ${text.length} characters of text, under the ${MIN_POLICY_CHARS}-character floor`;
    return { type, url, ok: false, reason };
  }

  return { type, url: current.toString(), ok: true };
}

const EXPECTED =
  "All 8 ACP link types resolve over HTTPS, within 3 redirects, to a 200 response that is either a PDF or an HTML page carrying real policy text in the initial HTML";

const SAMPLE = `{
  "links": [
    { "type": "terms_of_use",    "url": "https://example.com/terms" },
    { "type": "privacy_policy",  "url": "https://example.com/privacy" },
    { "type": "return_policy",   "url": "https://example.com/returns" },
    { "type": "shipping_policy", "url": "https://example.com/shipping" }
  ]
}`;

export class AcpPolicyLinkSurfaceAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agentic-commerce/acp-policy-link-surface",
    category: "agentic-commerce",
    title: "ACP link-surface completeness",
    failureTitle: "ACP link-surface completeness",
    description:
      "Verifies the merchant can populate the `links` array that every ACP CheckoutSession response is required to carry, by resolving each of the 8 enum link types to a stable, HTTPS, no-JS-required, non-soft-404 URL, on any domain, as an HTML page or a PDF.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/agentic-commerce/acp-policy-link-surface.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Falsifiable claim: ACP spec 2026-04-17 makes `links` one of the 9 REQUIRED fields on every CheckoutSession response, with type enum {terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support}. Independently, the OpenAI product feed spec makes `seller_privacy_policy` and `seller_tos` HARD-REQUIRED whenever `is_eligible_checkout=true`. Therefore a merchant that cannot produce a resolvable HTTPS URL for terms_of_use and privacy_policy CANNOT set is_eligible_checkout=true and its catalogue is excluded from Instant Checkout no matter how good the feed is. Disproof condition: if a merchant with no reachable ToS URL is observed transacting via ACP Instant Checkout, the check is wrong.",
      fix: 'Publish all 8 policy pages over HTTPS, link them from the site footer with plain <a href> markup, and serve their text in the initial HTML rather than rendering it client-side. Keep each URL stable — one redirect is tolerable, a four-hop chain is not — and make sure a missing policy returns 404 rather than a 200 "page not found" shell. Then paste the resolved URLs straight into the `links` array of your CheckoutSession response.',
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/agentic-commerce/acp-policy-link-surface/",
      tags: ["acp", "instant-checkout", "policy", "commerce"],
    },
  };

  private recommendation() {
    return {
      priority: CheckPriority.High,
      description: AcpPolicyLinkSurfaceAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    if (ctx.pages.length === 0 || !hasAnchors(ctx)) {
      return this.notApplicable(
        "The scanned pages carry no links, so there is no policy link surface to resolve.",
        EXPECTED,
        "No <a href> on the scanned pages",
      );
    }

    const candidates = resolvePolicyLinks(ctx);
    const checks: Check[] = [];
    for (const type of ACP_LINK_TYPES) {
      const url = candidates.get(type);
      if (!url) {
        checks.push({
          type,
          url: "",
          ok: false,
          reason: "has no link anywhere on the scanned pages",
        });
        continue;
      }
      checks.push(await validate(ctx, type, url));
    }

    const valid = checks.filter((c) => c.ok);
    const resolvedList = valid.map((c) => `${c.type}=${c.url}`).join(" ");
    const found = `${valid.length}/8 ACP link types resolve${resolvedList ? `; ${resolvedList}` : ""}`;
    const pageUrl = ctx.pages[0]!.url;

    const brokenGates = checks.filter(
      (c) => !c.ok && HARD_GATES.includes(c.type),
    );
    if (brokenGates.length > 0) {
      const detail = brokenGates
        .map((c) => `${c.type} ${c.url ? `(${c.url}) ` : ""}${c.reason}`)
        .join("; ");
      return this.fail(
        `A hard-gate policy link is unusable, so is_eligible_checkout cannot be set and the catalogue is excluded from Instant Checkout: ${detail}.`,
        EXPECTED,
        found,
        this.recommendation(),
        pageUrl,
      );
    }

    if (valid.length < ACP_LINK_TYPES.length) {
      const missing = checks
        .filter((c) => !c.ok)
        .map((c) => `${c.type} ${c.reason}`)
        .join("; ");
      return this.warn(
        `${valid.length} of 8 ACP link types resolve. Both hard gates are satisfied, so checkout eligibility is intact, but the CheckoutSession response cannot carry a complete links array: ${missing}.`,
        EXPECTED,
        found,
        this.recommendation(),
        pageUrl,
      );
    }

    return this.pass(
      "All 8 ACP link types resolve to stable policy pages.",
      EXPECTED,
      found,
      pageUrl,
    );
  }
}
