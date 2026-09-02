/**
 * What a scan actually obtained, decided once, before any audit runs.
 *
 * An audit that runs on evidence the scan never got reports a verdict about
 * the scanner, not about the site: "no structured data" when the fetch was
 * refused, "0 words" when the origin never answered. This module names the
 * classes of evidence a scan can be missing so those audits can be skipped
 * with the reason attached instead of answering blind.
 *
 * Pure: no network, no IO. It reads what the orchestrator already has.
 */
import type { FetchResult } from "./fetcher";
import type { PageContext } from "./check-context";
import type { EvidenceKey, PageType } from "./types";
import type { WafProtection } from "./waf-detector";
import { getRenderedText } from "./parser";
import { registrableOf } from "./gatherers/domains";

export type { EvidenceKey };

export const EVIDENCE_KEYS: readonly EvidenceKey[] = [
  "origin-reachable",
  "unblocked-fetches",
  "rendered-body",
  "sample-adequate",
];

export interface ScanEvidence {
  met: Record<EvidenceKey, boolean>;
  /** One sentence per unmet key, shown in the `na` stub and the trace. */
  reasons: Partial<Record<EvidenceKey, string>>;
  /** Page URL to "the served HTML carried text a non-JS consumer can read". */
  renderedByPage: Record<string, boolean>;
  usablePageTypes: Set<PageType>;
  /** False when no verdict about this site can mean anything. */
  judgeable: boolean;
}

export interface ScanEvidenceInput {
  requestedUrl: string;
  homepageResult: FetchResult;
  pages: PageContext[];
  rootFiles: Record<string, FetchResult>;
  wafProtection: WafProtection | null;
}

const ALL_PAGE_TYPES: readonly PageType[] = [
  "homepage",
  "category",
  "product",
  "content",
];

/** Content types that parse into a DOM a content audit can read. */
const HTML_TYPES = ["text/html", "application/xhtml+xml"];

/** Statuses that move a URL for good. A temporary hop is anything else. */
const PERMANENT_REDIRECT = new Set([301, 308]);

/** The host without a leading `www.`, lowercased. */
function bareHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * The registrable name without its public suffix: `zalando` for both
 * `zalando.com` and `zalando.bg`.
 */
function registrableName(url: string): string {
  const domain = registrableOf(url);
  if (!domain) return "";
  const parts = domain.split(".");
  return parts.length > 1 ? parts.slice(0, -1).join(".") : domain;
}

/**
 * Whether the response came from the site the user asked for.
 *
 * Same host (bar `www.` and the scheme upgrade) is the common case. A
 * different host is only accepted when the hop that left the registrable
 * domain was permanent — a domain migration — or when it never left it, which
 * is what a geo router does on every request. A temporary hop to somebody
 * else's domain is a parking page or an interstitial, not the site.
 */
function reachedTheRequestedSite(
  requestedUrl: string,
  result: FetchResult,
): { ok: true } | { ok: false; reason: string } {
  const requested = bareHost(requestedUrl);
  const final = bareHost(result.finalUrl || result.url);
  if (!final)
    return {
      ok: false,
      reason: `The homepage response carried no usable URL.`,
    };
  if (requested === final) return { ok: true };

  const requestedDomain = registrableOf(requestedUrl);
  const finalDomain = registrableOf(result.finalUrl || result.url);
  if (requestedDomain && requestedDomain === finalDomain) return { ok: true };

  // A country storefront under a sibling ccTLD is the same site. Measured on
  // the calibration corpus: `zalando.com` answers 302 to `www.zalando.bg` and
  // `aboutyou.com` to `www.aboutyou.bg` — every request, from Bulgaria. The
  // eTLD+1 rule alone would mark both unreachable and leave a real storefront
  // unscored. Matching the registrable name across suffixes is a weaker signal
  // than matching the domain, and it is the one these sites actually give.
  const requestedName = registrableName(requestedUrl);
  if (
    requestedName &&
    requestedName === registrableName(result.finalUrl || result.url)
  ) {
    return { ok: true };
  }

  const chain = result.redirectChain ?? [];
  const leaving = chain.filter(
    (hop) => registrableOf(hop.from) !== registrableOf(hop.to),
  );
  if (
    leaving.length > 0 &&
    leaving.every((hop) => PERMANENT_REDIRECT.has(hop.status))
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `The requested host redirected to ${final}, a different site, without a permanent redirect.`,
  };
}

function originReachable(
  requestedUrl: string,
  result: FetchResult,
): { met: boolean; reason?: string } {
  if (result.error) {
    return {
      met: false,
      reason: `The homepage could not be fetched: ${result.error}.`,
    };
  }
  if (result.status < 200 || result.status > 299) {
    return {
      met: false,
      reason: `The homepage answered HTTP ${result.status}.`,
    };
  }
  const type = (result.contentType || "").toLowerCase();
  if (!HTML_TYPES.some((html) => type.includes(html))) {
    return {
      met: false,
      reason: `The homepage served ${result.contentType || "no content type"}, not HTML.`,
    };
  }
  const reached = reachedTheRequestedSite(requestedUrl, result);
  return reached.ok ? { met: true } : { met: false, reason: reached.reason };
}

/**
 * Blocking is judged at the origin. A scan whose homepage answered but whose
 * internal pages were refused stays met here and loses those pages through
 * `sample-adequate`.
 */
function unblockedFetches(
  homepageResult: FetchResult,
  waf: WafProtection | null,
): { met: boolean; reason?: string } {
  if (waf?.isBlocked) {
    // Two cases, kept apart on purpose: a throttle is the scan's own doing and
    // is fixed by scanning slower; anything else is the site refusing the scan.
    return waf.isRateLimit
      ? {
          met: false,
          reason: `The scan was throttled (${waf.name}): ${waf.reason}.`,
        }
      : { met: false, reason: `${waf.name} refused the scan: ${waf.reason}.` };
  }
  if (homepageResult.status === 429) {
    return {
      met: false,
      reason: "The homepage answered HTTP 429: the scan was throttled.",
    };
  }
  return { met: true };
}

/**
 * Whether the served HTML carries text a non-JS consumer can read.
 *
 * The `||` is load-bearing. `getWordCount` splits on whitespace, so a full
 * Chinese or Japanese page counts a handful of words; the character branch is
 * what stops the gate silencing every CJK site.
 */
export function pageRendersText(page: PageContext): boolean {
  const text = getRenderedText(page.$);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return wordCount > 50 || text.length > 200;
}

export function buildScanEvidence(input: ScanEvidenceInput): ScanEvidence {
  const origin = originReachable(input.requestedUrl, input.homepageResult);
  const unblocked = unblockedFetches(input.homepageResult, input.wafProtection);

  const renderedByPage: Record<string, boolean> = {};
  const usablePageTypes = new Set<PageType>();
  for (const page of input.pages) {
    const rendered = pageRendersText(page);
    renderedByPage[page.url] = rendered;
    if (rendered) usablePageTypes.add(page.pageType);
  }

  const renderedCount = Object.values(renderedByPage).filter(Boolean).length;
  const met: Record<EvidenceKey, boolean> = {
    "origin-reachable": origin.met,
    "unblocked-fetches": unblocked.met,
    "rendered-body": renderedCount > 0,
    "sample-adequate": usablePageTypes.size > 0,
  };

  const reasons: Partial<Record<EvidenceKey, string>> = {};
  if (origin.reason) reasons["origin-reachable"] = origin.reason;
  if (unblocked.reason) reasons["unblocked-fetches"] = unblocked.reason;
  if (!met["rendered-body"]) {
    reasons["rendered-body"] =
      input.pages.length === 0
        ? "The scan fetched no pages."
        : `None of the ${input.pages.length} fetched page(s) served readable text.`;
  }
  if (!met["sample-adequate"]) {
    reasons["sample-adequate"] =
      input.pages.length === 0
        ? "The scan fetched no pages."
        : "No fetched page of any type served readable text.";
  }

  return {
    met,
    reasons,
    renderedByPage,
    usablePageTypes,
    // A shell site was seen. What it serves is a finding about it, so
    // `rendered-body` and `sample-adequate` do not clear `judgeable`.
    judgeable: met["origin-reachable"] && met["unblocked-fetches"],
  };
}

/**
 * Whether the scan holds a response it can attribute to the site the user
 * asked for.
 *
 * `ctx.pages` is not "this site's pages". The orchestrator admits any 200 that
 * carried a body, with no content-type gate and no attribution check, so a
 * broker's parking page reached through a temporary redirect and a PDF served
 * at the homepage both arrive as a `PageContext` an audit will read as though
 * the site had written it. `ctx.rootFiles` is the same: a parking host answers
 * every path, so `/llms.txt` comes back 200 and belongs to the broker.
 *
 * Attribution is decided once, before any audit runs. An audit that names
 * `origin-reachable` in its `requires` has said its verdict depends on that
 * decision, so it must read the decision rather than assume it went its way.
 *
 * This is `judgeable`, not `origin-reachable` alone, because a bot wall does
 * not have to answer with an error status. A Cloudflare managed challenge is
 * served at HTTP 200, `text/html`, from the requested host, so every test
 * `origin-reachable` applies passes and the interstitial arrives as a
 * `PageContext`. Its `<meta name="robots" content="noindex,nofollow">` is
 * Cloudflare's, not the owner's, and an audit reading it under
 * `origin-reachable` alone told site owners at critical priority that their
 * homepage was noindexed. `unblocked-fetches` is the key that knows the
 * difference, and the two together are what `judgeable` already means.
 */
export function scanReadTheSite(evidence: ScanEvidence): boolean {
  return evidence.judgeable;
}

/**
 * Every unmet key's reason, once each, in key order.
 *
 * Two keys can carry the same sentence — `rendered-body` and
 * `sample-adequate` both say "The scan fetched no pages." when nothing was
 * fetched — and a report joined them into "The scan fetched no pages. The
 * scan fetched no pages." on every walled site.
 */
export function unjudgeableReason(
  evidence: Pick<ScanEvidence, "reasons">,
): string {
  const seen = new Set<string>();
  for (const key of EVIDENCE_KEYS) {
    const reason = evidence.reasons[key];
    if (reason) seen.add(reason);
  }
  return (
    [...seen].join(" ") ||
    "The scan obtained too little evidence to judge this site."
  );
}

/** Why the scan holds nothing it can attribute to the site. */
export function unreadSiteReason(evidence: ScanEvidence): string {
  return (
    evidence.reasons["origin-reachable"] ??
    evidence.reasons["unblocked-fetches"] ??
    "The scan obtained no response it could attribute to this site."
  );
}

/**
 * Whether any fetched page served text a non-JS consumer can read.
 *
 * A JS shell is not an empty scan: the page arrived, the head is complete, the
 * headers and the root files are all there. What it withholds is the rendered
 * document — the tables, figures, headings, links and accessible names an
 * audit walks. An audit whose population lives in the body therefore finds
 * none of it and, unguarded, reports the absence as cleanliness: "no data
 * tables found" about a page whose body is one empty `<div>`.
 *
 * Read this only where the audit would otherwise say "found nothing, so
 * nothing is wrong". A finding the served HTML does support — an injected
 * `og:description`, a third-party script tag, a slow response — is still true
 * on a shell and must be reported before this guard is reached.
 */
export function scanReadPageText(evidence: ScanEvidence): boolean {
  return evidence.met["rendered-body"];
}

/** Why no fetched page served text to read. */
export function unreadPageTextReason(evidence: ScanEvidence): string {
  return (
    evidence.reasons["rendered-body"] ??
    "No fetched page served text a non-JS consumer can read."
  );
}

/** All requirements met. For test harnesses not exercising the gate. */
export function allEvidenceMet(): ScanEvidence {
  return {
    met: {
      "origin-reachable": true,
      "unblocked-fetches": true,
      "rendered-body": true,
      "sample-adequate": true,
    },
    reasons: {},
    renderedByPage: {},
    usablePageTypes: new Set<PageType>(ALL_PAGE_TYPES),
    judgeable: true,
  };
}
