/**
 * Cookies for one redirect chain.
 *
 * Some storefronts set a session or locale cookie on the first hop and keep
 * redirecting until the cookie comes back. A browser sends it back, so the
 * chain ends; a client that drops it loops until its hop limit. The fetcher
 * walks redirects itself, so it has to carry them.
 *
 * The jar lives for one fetch. Nothing is shared between fetches or scans, so
 * no state leaks from one request into another, and the first request of a
 * fetch never carries a cookie.
 *
 * Only what a chain needs is implemented: host-only and Domain cookies, Path,
 * Secure, and removal by Max-Age or a past Expires. There is no public suffix
 * list; a Domain attribute without an inner dot is refused instead, and the
 * jar is discarded when the fetch ends.
 */

interface StoredCookie {
  name: string;
  value: string;
  /** Lower-case host or Domain attribute, without a leading dot. */
  domain: string;
  hostOnly: boolean;
  path: string;
  secure: boolean;
}

/** RFC 6265 section 5.1.4: the directory of the request path. */
function defaultPath(url: URL): string {
  const path = url.pathname;
  if (!path.startsWith("/")) return "/";
  const last = path.lastIndexOf("/");
  return last <= 0 ? "/" : path.slice(0, last);
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/";
}

/** One Set-Cookie header, or undefined when the jar must ignore it. */
function parse(
  header: string,
  from: URL,
): { cookie: StoredCookie; expired: boolean } | undefined {
  const [pair = "", ...attributes] = header.split(";");
  const eq = pair.indexOf("=");
  if (eq <= 0) return undefined;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  if (!name) return undefined;

  const host = from.hostname.toLowerCase();
  let domain = host;
  let hostOnly = true;
  let path = defaultPath(from);
  let secure = false;
  // RFC 6265 section 5.3, step 3: Max-Age wins over Expires, whatever their
  // order, so each is kept apart and Max-Age decides when it is present.
  let maxAgeExpired: boolean | undefined;
  let expiresExpired = false;
  for (const attribute of attributes) {
    const at = attribute.indexOf("=");
    const key = (at === -1 ? attribute : attribute.slice(0, at))
      .trim()
      .toLowerCase();
    const raw = at === -1 ? "" : attribute.slice(at + 1).trim();
    if (key === "domain" && raw) {
      const wanted = raw.replace(/^\./, "").toLowerCase();
      // A cookie for another site, or for a bare suffix such as "com", is
      // refused rather than scoped wider than the host that set it.
      if (!wanted.includes(".") || !domainMatches(host, wanted))
        return undefined;
      domain = wanted;
      hostOnly = false;
    } else if (key === "path" && raw.startsWith("/")) {
      path = raw;
    } else if (key === "secure") {
      secure = true;
    } else if (key === "max-age" && /^-?\d+$/.test(raw)) {
      maxAgeExpired = Number(raw) <= 0;
    } else if (key === "expires" && raw) {
      const when = Date.parse(raw);
      expiresExpired = !Number.isNaN(when) && when <= Date.now();
    }
  }
  return {
    cookie: { name, value, domain, hostOnly, path, secure },
    expired: maxAgeExpired ?? expiresExpired,
  };
}

export class RedirectCookieJar {
  private readonly cookies: StoredCookie[] = [];

  /** Store every Set-Cookie of a response from `from`. */
  store(setCookie: string | string[] | undefined, from: string): void {
    if (setCookie === undefined) return;
    const url = new URL(from);
    for (const header of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const parsed = parse(header, url);
      if (!parsed) continue;
      const { cookie, expired } = parsed;
      const index = this.cookies.findIndex(
        (c) =>
          c.name === cookie.name &&
          c.domain === cookie.domain &&
          c.path === cookie.path,
      );
      if (index !== -1) this.cookies.splice(index, 1);
      if (!expired) this.cookies.push(cookie);
    }
  }

  /** The Cookie header value for a request to `to`, or undefined. */
  header(to: string): string | undefined {
    const url = new URL(to);
    const host = url.hostname.toLowerCase();
    const https = url.protocol === "https:";
    const pairs = this.cookies
      .filter(
        (c) =>
          (c.hostOnly ? host === c.domain : domainMatches(host, c.domain)) &&
          pathMatches(url.pathname || "/", c.path) &&
          (!c.secure || https),
      )
      // RFC 6265 section 5.4: longer paths first.
      .sort((a, b) => b.path.length - a.path.length)
      .map((c) => `${c.name}=${c.value}`);
    return pairs.length > 0 ? pairs.join("; ") : undefined;
  }
}
