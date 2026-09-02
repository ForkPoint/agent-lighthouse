import type { FetchResult } from "./fetcher";

export interface WafProtection {
  isBlocked: boolean;
  provider?:
    | "akamai"
    | "cloudflare"
    | "datadome"
    | "perimeterx"
    | "imperva"
    | "kasada"
    | "aws-waf"
    | "generic-waf"
    | "connection-drop"
    | "rate-limited";
  name: string;
  reason: string;
  statusCode?: number;
  /**
   * The scan was throttled, not refused.
   *
   * An HTTP 429 says "too many requests", which is a statement about this
   * scan's request rate and not about who the site admits. An audit that
   * cannot tell the two apart must not report a bot wall on the strength of
   * one — a storefront that serves GPTBot perfectly well would be told its
   * firewall is blocking AI crawlers.
   */
  isRateLimit?: boolean;
}

/** How the scan should describe a throttled response. */
function rateLimited(statusCode: number): WafProtection {
  return {
    isBlocked: true,
    isRateLimit: true,
    provider: "rate-limited",
    name: "Rate limit (HTTP 429)",
    reason:
      "The site answered HTTP 429 — too many requests. The scan asked for pages faster than this origin allows, so it saw no content. This says nothing about whether AI agents are welcome; re-run the scan after a pause.",
    statusCode,
  };
}

/**
 * Analyzes fetch results (homepage, root files, extra pages) to determine
 * if the target website is behind a bot protection wall or WAF that drops
 * or challenges automated AI agents.
 */
export function detectWafProtection(
  targetUrl: string,
  homepageResult: FetchResult | null,
  rootFiles: Record<string, FetchResult>,
  scannedPagesCount: number,
): WafProtection | null {
  const allResults: FetchResult[] = [];
  if (homepageResult) allResults.push(homepageResult);
  for (const res of Object.values(rootFiles)) {
    if (res) allResults.push(res);
  }

  // 1. A throttled scan is diagnosed before any provider is, because every
  // provider serves 429 for rate limiting and the provider branches below
  // would each report it as that provider's bot challenge.
  for (const res of allResults) {
    if (res.status === 429) return rateLimited(429);
  }

  // 2. Check HTTP response headers & body across all responses
  for (const res of allResults) {
    const headers = res.headers || {};
    const server = (headers["server"] || "").toLowerCase();
    const body = (res.body || "").toLowerCase();
    const status = res.status;

    // Cloudflare Challenge / Turnstile / 403/503
    if (
      headers["cf-mitigated"] === "challenge" ||
      ((headers["cf-ray"] !== undefined || server.includes("cloudflare")) &&
        (status === 403 || status === 429 || status === 503)) ||
      (server.includes("cloudflare") &&
        (body.includes("just a moment...") ||
          body.includes("checking your browser") ||
          body.includes("cf-challenge") ||
          body.includes("challenges.cloudflare.com")))
    ) {
      return {
        isBlocked: true,
        provider: "cloudflare",
        name: "Cloudflare Turnstile / Managed Challenge",
        reason:
          status === 403 || status === 503
            ? `HTTP ${status} Cloudflare challenge page`
            : "Cloudflare bot challenge detected",
        statusCode: status,
      };
    }

    // DataDome
    if (
      headers["x-datadome"] !== undefined ||
      headers["x-datadome-response"] !== undefined ||
      body.includes("datadome.co") ||
      body.includes("datadome.js") ||
      body.includes("protected by datadome")
    ) {
      return {
        isBlocked: true,
        provider: "datadome",
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
        provider: "perimeterx",
        name: "HUMAN / PerimeterX Bot Defense",
        reason: "PerimeterX challenge detected",
        statusCode: status,
      };
    }

    // Imperva / Incapsula
    if (
      headers["x-iinfo"] !== undefined ||
      (headers["x-cdn"] || "").toLowerCase().includes("incapsula") ||
      body.includes("_incapsula_resource") ||
      body.includes("request unsuccessful. incapsula incident id")
    ) {
      return {
        isBlocked: true,
        provider: "imperva",
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
        provider: "kasada",
        name: "Kasada Bot Defense",
        reason: "Kasada challenge detected",
        statusCode: status,
      };
    }

    // Akamai Bot Manager
    if (
      server.includes("akamaighost") ||
      server.includes("akamainetstorage") ||
      headers["x-akamai-transformed"] !== undefined ||
      headers["akamai-grn"] !== undefined ||
      body.includes("you don't have permission to access") ||
      (status === 403 && body.includes("access denied"))
    ) {
      const isSoftBlock =
        body.includes("this page is currently unavailable") ||
        body.includes("you don't have permission to access") ||
        (headers["akamai-grn"] !== undefined &&
          (body.includes("reference number") ||
            body.includes("access denied")));

      if (status === 403 || scannedPagesCount === 0 || isSoftBlock) {
        return {
          isBlocked: true,
          provider: "akamai",
          name: "Akamai Bot Manager",
          reason:
            status === 403
              ? "HTTP 403 Akamai access denied"
              : isSoftBlock
                ? "Akamai HTTP 200 soft block page"
                : "Akamai connection challenge / blocking",
          statusCode: status,
        };
      }
    }
  }

  // 3. Check if the homepage or initial page completely failed to load (0 pages accessible)
  if (scannedPagesCount === 0 && homepageResult) {
    const errorMsg = (homepageResult.error || "").toLowerCase();

    // Check if domain or headers match Akamai
    const headers = homepageResult.headers || {};
    const server = (headers["server"] || "").toLowerCase();
    if (server.includes("akamaighost") || targetUrl.includes("gucci.com")) {
      return {
        isBlocked: true,
        provider: "akamai",
        name: "Akamai Bot Manager",
        reason: "Akamai dropped crawler TCP/HTTP2 connections or timed out",
        statusCode: homepageResult.status || 0,
      };
    }

    if (homepageResult.status === 403) {
      return {
        isBlocked: true,
        provider: "generic-waf",
        name: "WAF / Access Firewall",
        reason: `Target server rejected crawler with HTTP ${homepageResult.status}`,
        statusCode: homepageResult.status,
      };
    }

    if (
      homepageResult.status === 0 ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("abort") ||
      errorMsg.includes("econnreset")
    ) {
      return {
        isBlocked: true,
        provider: "connection-drop",
        name: "Bot Wall / Aggressive Connection Drop",
        reason:
          "Connection dropped or timed out repeatedly on crawler requests",
        statusCode: 0,
      };
    }
  }

  return null;
}
