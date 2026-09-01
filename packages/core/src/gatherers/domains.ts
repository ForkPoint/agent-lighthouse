/**
 * Registrable-domain comparison, without a bundled Public Suffix List.
 *
 * Two audits already carried a private copy of this; the Wikidata round trip
 * needed a third, which is where a shared one earns its place. The suffix list
 * is short and deliberate: a full PSL snapshot is a megabyte that ages, and
 * every entry here is a suffix a scanned site plausibly sits under.
 */

/** Two-label public suffixes, under which the registrable name is the third label. */
export const MULTI_SUFFIX: ReadonlySet<string> = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "me.uk",
  "net.uk",
  "com.au",
  "net.au",
  "org.au",
  "edu.au",
  "gov.au",
  "co.nz",
  "co.jp",
  "or.jp",
  "ne.jp",
  "co.za",
  "co.kr",
  "co.il",
  "co.id",
  "co.th",
  "com.br",
  "com.mx",
  "com.ar",
  "com.co",
  "com.pe",
  "co.in",
  "com.sg",
  "com.tr",
  "com.cn",
  "com.hk",
  "com.tw",
  "com.my",
  "com.ph",
  "com.ua",
  "com.pl",
  "com.es",
  "com.pt",
  "com.gr",
]);

/** The registrable name of `host`: eTLD+1 under the suffix list above. */
export function registrableDomain(host: string): string {
  const parts = host
    .toLowerCase()
    .replace(/\.$/, "")
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  return MULTI_SUFFIX.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

/** The registrable domain behind a URL, or an empty string when it has none. */
export function registrableOf(url: string): string {
  try {
    return registrableDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}
