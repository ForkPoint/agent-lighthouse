import { type WafProtection, WafProvider } from "./contracts";
import type { FetchResult } from "./fetcher";

// A report carries the verdict, so its shape lives in `contracts.ts`.
export { WafProvider };
export type { WafProtection };

/** How the scan should describe a throttled response. */
function rateLimited(statusCode: number): WafProtection {
  return {
    isBlocked: true,
    isRateLimit: true,
    provider: WafProvider.RateLimited,
    name: "Rate limit (HTTP 429)",
    reason:
      "The site answered HTTP 429 — too many requests. The scan asked for pages faster than this origin allows, so it saw no content. This says nothing about whether AI agents are welcome; re-run the scan after a pause.",
    statusCode,
  };
}

/** Statuses a WAF uses to refuse a request (429 is decided separately). */
const BLOCK_STATUSES = new Set([401, 403, 405, 503]);

/**
 * Whether a page carries readable text, by the same thresholds the evidence
 * gate uses (more than 50 words or 200 characters), read from the raw HTML.
 * A vendor's script on a readable storefront is not a wall; the same marker on
 * a near-empty page is the wall itself.
 */
function readable(body: string): boolean {
  const text = textOf(body);
  return text.split(" ").filter(Boolean).length > 50 || text.length > 200;
}

/** The text of raw HTML, without scripts, styles or tags. */
function textOf(body: string): string {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Most text an Akamai block page carries. Its denial sentence, a logo
 * description and a contact line can pass the readable threshold; a real page
 * titled "Access Denied" with this little text is still the block page.
 */
const BLOCK_PAGE_MAX_CHARS = 1000;

/** The page title, lower-cased, or "" when there is none. */
function titleOf(body: string): string {
  return (/<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1] ?? "")
    .trim()
    .toLowerCase();
}

/**
 * A connection that never produced an HTTP exchange for a reason that is not
 * the site refusing a crawler: DNS, a refused port, a TLS or certificate
 * failure, or a connect timeout. These name the origin's own fault, so they
 * are never reported as a bot wall.
 */
const NOT_A_WALL =
  /enotfound|eai_again|econnrefused|connect timeout|und_err_connect_timeout|certificate|cert_|altnames|ssl|tls|handshake|self[- ]signed/i;

/**
 * Analyzes fetch results (homepage, root files, extra pages) to determine
 * if the target website is behind a bot protection wall or WAF that drops
 * or challenges automated AI agents. Detection reads response evidence only,
 * never the target's hostname.
 *
 * The verdict is about the pages the scan reads. When the homepage answered
 * and was read, root files do not decide it: a 403 on one missing
 * `/.well-known/` file, a path-level rule on a sitemap, or a vendor marker
 * inside `robots.txt` says nothing about whether the site refused the scan.
 * Root files count only when the homepage itself failed, as corroboration of
 * why.
 *
 * @param _targetUrl Kept for the public signature; no verdict depends on it.
 */
export function detectWafProtection(
  _targetUrl: string,
  homepageResult: FetchResult | null,
  rootFiles: Record<string, FetchResult>,
  scannedPagesCount: number,
): WafProtection | null {
  const homepageRead =
    homepageResult !== null &&
    homepageResult.status >= 200 &&
    homepageResult.status < 400 &&
    scannedPagesCount > 0;
  const allResults: FetchResult[] = [];
  if (homepageResult) allResults.push(homepageResult);
  if (!homepageRead) {
    for (const res of Object.values(rootFiles)) {
      if (res) allResults.push(res);
    }
  }

  // 1. A throttled homepage is diagnosed before any provider is, because
  // every provider serves 429 for rate limiting and the provider branches
  // below would each report it as that provider's bot challenge.
  if (homepageResult?.status === 429) return rateLimited(429);

  // 2. Vendor evidence, read from every response that is not a 429. A
  // challenge on one response outranks a throttle on another: the challenge
  // is why the scan saw nothing.
  const answered = allResults.filter((res) => res.status !== 429);
  for (const res of answered) {
    const wall = vendorWall(res, scannedPagesCount);
    if (wall) return wall;
  }
  for (const res of answered) {
    const wall = cloudflareStatusWall(res);
    if (wall) return wall;
  }

  // 3. A throttle on a root file, when nothing else explains the failure.
  if (allResults.some((res) => res.status === 429)) return rateLimited(429);

  // 4. Check if the homepage or initial page completely failed to load (0 pages accessible)
  if (scannedPagesCount === 0 && homepageResult) {
    const errorMsg = (homepageResult.error || "").toLowerCase();

    // Check if domain or headers match Akamai
    const headers = homepageResult.headers || {};
    const server = (headers["server"] || "").toLowerCase();
    if (server.includes("akamaighost") && homepageResult.status !== 0) {
      return {
        isBlocked: true,
        provider: WafProvider.Akamai,
        name: "Akamai Bot Manager",
        reason: "Akamai refused the crawler's requests",
        statusCode: homepageResult.status,
      };
    }

    if (homepageResult.status === 403) {
      return {
        isBlocked: true,
        provider: WafProvider.GenericWaf,
        name: "WAF / Access Firewall",
        reason: `Target server rejected crawler with HTTP ${homepageResult.status}`,
        statusCode: homepageResult.status,
      };
    }

    // A DNS, port, TLS or certificate failure is the origin's own fault. The
    // evidence gate reports it as an unreachable homepage, with the error.
    if (NOT_A_WALL.test(errorMsg)) return null;

    if (
      homepageResult.status === 0 ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("abort") ||
      errorMsg.includes("econnreset")
    ) {
      return {
        isBlocked: true,
        provider: WafProvider.ConnectionDrop,
        name: "Bot Wall / Aggressive Connection Drop",
        reason:
          "Connection dropped or timed out repeatedly on crawler requests",
        statusCode: 0,
      };
    }
  }

  return null;
}

/**
 * A wall a vendor's own header or challenge page proves. A vendor marker on a
 * readable page that answered 2xx is the vendor's sensor script on an open
 * site, not a wall.
 */
function vendorWall(
  res: FetchResult,
  scannedPagesCount: number,
): WafProtection | null {
  const headers = res.headers || {};
  const server = (headers["server"] || "").toLowerCase();
  const rawBody = res.body || "";
  const body = rawBody.toLowerCase();
  const status = res.status;
  const refused = BLOCK_STATUSES.has(status);
  const interstitial = !readable(rawBody);

  // Cloudflare: the challenge header or the managed challenge page.
  if (
    headers["cf-mitigated"] === "challenge" ||
    (server.includes("cloudflare") &&
      (body.includes("just a moment...") ||
        body.includes("checking your browser") ||
        body.includes("cf-challenge") ||
        // Turnstile's shared host also serves form widgets on readable pages.
        // Only the managed challenge-page loader is evidence of a page wall.
        body.includes("/orchestrate/chl_page/")))
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Cloudflare,
      name: "Cloudflare Turnstile / Managed Challenge",
      reason:
        status === 403 || status === 503
          ? `HTTP ${status} Cloudflare challenge page`
          : "Cloudflare bot challenge detected",
      statusCode: status,
    };
  }

  // DataDome: its header or tag sits on every page of a protected site, open
  // pages included. The wall is a refusal status or the captcha page.
  if (
    (headers["x-datadome"] !== undefined ||
      headers["x-datadome-response"] !== undefined ||
      body.includes("datadome.co") ||
      body.includes("datadome.js") ||
      body.includes("protected by datadome") ||
      body.includes("captcha-delivery.com")) &&
    (refused || body.includes("captcha-delivery.com") || interstitial)
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Datadome,
      name: "DataDome Bot Protection",
      reason: "DataDome anti-bot challenge detected",
      statusCode: status,
    };
  }

  // PerimeterX / HUMAN Security
  if (
    headers["x-perimeterx"] !== undefined ||
    Object.keys(headers).some((h) => h.startsWith("x-px-")) ||
    body.includes("client.perimeterx.net") ||
    body.includes("press & hold") ||
    body.includes("perimeterx captcha") ||
    body.includes("px-captcha") ||
    body.includes(
      "access to this page has been denied because we believe you are using automation tools",
    ) ||
    ((status === 403 || status === 429) && body.includes("_pxappid"))
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Perimeterx,
      name: "HUMAN / PerimeterX Bot Defense",
      reason: "PerimeterX challenge detected",
      statusCode: status,
    };
  }

  // Imperva / Incapsula: the `_Incapsula_Resource` script also runs on open
  // pages, so alone it counts only on a refusal or an empty interstitial.
  if (
    headers["x-iinfo"] !== undefined ||
    (headers["x-cdn"] || "").toLowerCase().includes("incapsula") ||
    body.includes("request unsuccessful. incapsula incident id") ||
    (body.includes("_incapsula_resource") && (refused || interstitial))
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Imperva,
      name: "Imperva Incapsula WAF",
      reason: "Imperva anti-bot block detected",
      statusCode: status,
    };
  }

  // Kasada
  if (
    Object.keys(headers).some((h) => h.startsWith("x-kpsdk-")) ||
    body.includes("149e9513-01fa-4fb0-a84e-5686259205d3") ||
    /(?:^|[^a-zA-Z0-9_-])k-challenge(?:[^a-zA-Z0-9_-]|$)/i.test(body)
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Kasada,
      name: "Kasada Bot Defense",
      reason: "Kasada challenge detected",
      statusCode: status,
    };
  }

  // Akamai Bot Manager. "Access denied" alone is not Akamai's: an S3 bucket
  // answers a missing key with a 403 `AccessDenied` document. An Akamai
  // header has to be present for the phrase to name Akamai.
  const akamaiHeader =
    server.includes("akamaighost") ||
    server.includes("akamainetstorage") ||
    headers["x-akamai-transformed"] !== undefined ||
    headers["akamai-grn"] !== undefined ||
    headers["akamai-request-bc"] !== undefined;
  if (akamaiHeader || body.includes("you don't have permission to access")) {
    // A 200 page titled "Access Denied" with almost no text is Akamai's
    // block page served with a success status, often a geo block.
    const deniedPage =
      titleOf(rawBody) === "access denied" &&
      textOf(rawBody).length < BLOCK_PAGE_MAX_CHARS;
    const geoBlock =
      deniedPage &&
      /current location|your location|your country|your region/.test(body);
    const isSoftBlock =
      deniedPage ||
      body.includes("this page is currently unavailable") ||
      body.includes("you don't have permission to access") ||
      (headers["akamai-grn"] !== undefined &&
        (body.includes("reference number") || body.includes("access denied")));

    if (status === 403 || scannedPagesCount === 0 || isSoftBlock) {
      return {
        isBlocked: true,
        provider: WafProvider.Akamai,
        name: "Akamai Bot Manager",
        reason:
          status === 403
            ? "HTTP 403 Akamai access denied"
            : geoBlock
              ? `Akamai HTTP ${status} block page: the site refuses the scan's location`
              : isSoftBlock
                ? `Akamai HTTP ${status} soft block page`
                : "Akamai connection challenge / blocking",
        statusCode: status,
      };
    }
  }

  return null;
}

/**
 * Cloudflare by status alone: a 403 or 503 from a Cloudflare edge. Checked
 * after every vendor's own evidence, because Cloudflare also fronts sites
 * whose wall is another vendor's challenge page.
 */
function cloudflareStatusWall(res: FetchResult): WafProtection | null {
  const headers = res.headers || {};
  const server = (headers["server"] || "").toLowerCase();
  const status = res.status;
  if (
    (headers["cf-ray"] !== undefined || server.includes("cloudflare")) &&
    (status === 403 || status === 503)
  ) {
    return {
      isBlocked: true,
      provider: WafProvider.Cloudflare,
      name: "Cloudflare Turnstile / Managed Challenge",
      reason: `HTTP ${status} Cloudflare challenge page`,
      statusCode: status,
    };
  }
  return null;
}
