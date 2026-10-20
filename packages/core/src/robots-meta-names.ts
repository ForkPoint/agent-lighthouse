/**
 * Which robots-directive names a crawler operator documents reading, and a
 * shared parser for the `X-Robots-Tag` header.
 *
 * Every name here comes from the operator's own page (verified 2026-10-20):
 *
 * - Google: "Google supports two user agent tokens in the robots meta tag;
 *   other values are ignored" — `googlebot` and `googlebot-news`.
 *   https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
 * - Bing: "you can replace the generic name="robots" with name="bingbot"".
 *   https://www.bing.com/webmasters/help/robots-meta-tags-and-attributes-that-bing-supports-5198d240
 * - Apple: `<meta name="applebot" content="nosnippet">` and
 *   `X-Robots-Tag: applebot: nosnippet`. https://support.apple.com/en-us/119829
 *
 * Audits that read robots directives import these sets instead of keeping their
 * own lists, so a name no operator documents cannot score in one audit while
 * another declares it unread.
 */
import { BotToken } from "#core/bot-registry";

/** The generic name: every crawler that reads robots directives honours it. */
export const GENERIC_ROBOTS_NAME = "robots";

/**
 * Names whose directives an operator documents honouring, in a meta tag's
 * `name` attribute and as an `X-Robots-Tag` user-agent prefix. Bing documents
 * `name="bingbot"` and that each tag "can also be specified as X-Robots-Tag",
 * not a `bingbot:` prefix as such; the prefix is read as the header form of the
 * documented meta name.
 */
export const DOCUMENTED_ROBOTS_NAMES: ReadonlySet<string> = new Set([
  GENERIC_ROBOTS_NAME,
  BotToken.Googlebot.toLowerCase(),
  "googlebot-news",
  BotToken.Bingbot.toLowerCase(),
  BotToken.Applebot.toLowerCase(),
]);

/**
 * Per-crawler names sites put in robots meta tags or `X-Robots-Tag` prefixes
 * that no operator documents reading there. OpenAI, Anthropic, Perplexity and
 * Common Crawl document robots.txt only; Google-Extended and Applebot-Extended
 * are robots.txt product tokens; Bing's pages name `bingbot`, not `msnbot`.
 * Audits may name a directive under one of these, never score it.
 */
export const UNDOCUMENTED_ROBOTS_NAMES: ReadonlySet<string> = new Set([
  ...[
    BotToken.GoogleExtended,
    BotToken.ApplebotExtended,
    BotToken.GPTBot,
    BotToken.OAISearchBot,
    BotToken.ChatGPTUser,
    BotToken.ClaudeBot,
    BotToken.ClaudeSearchBot,
    BotToken.ClaudeUser,
    BotToken.PerplexityBot,
    BotToken.CCBot,
  ].map((token) => token.toLowerCase()),
  "msnbot",
]);

/** Directives whose value follows a colon, so a colon there is not a bot prefix. */
const VALUED_DIRECTIVES = new Set([
  "max-snippet",
  "max-image-preview",
  "max-video-preview",
  "unavailable_after",
]);

/** One directive read from `X-Robots-Tag`. */
export interface HeaderDirective {
  /** `robots` for an unprefixed rule, otherwise the lower-cased prefix. */
  name: string;
  /** Lower-cased token, with spaces around a value colon removed. */
  token: string;
}

/** Lower-case a directive and close the gap in `max-snippet : 0`. */
function normalizeToken(token: string): string {
  return token
    .trim()
    .toLowerCase()
    .replace(/\s*:\s*/, ":");
}

/**
 * Parse a (possibly combined) `X-Robots-Tag` field value.
 *
 * A `bot:` prefix scopes the directives that follow it until the next prefix:
 * Google's own example is `otherbot: noindex, nofollow`. Repeated field lines
 * reach the audits combined with ", " (RFC 9110 §5.3, see `fetcher.ts`), so
 * line boundaries are gone, and an unprefixed directive on a later line is
 * attributed to the last named bot.
 */
export function parseXRobotsTag(raw: string | undefined): HeaderDirective[] {
  if (!raw) return [];
  const out: HeaderDirective[] = [];
  let name = GENERIC_ROBOTS_NAME;
  for (const segment of raw.split(",")) {
    const trimmed = segment.trim().toLowerCase();
    if (!trimmed) continue;
    const prefixed = /^([a-z0-9._-]+)\s*:\s*(.+)$/.exec(trimmed);
    if (prefixed && !VALUED_DIRECTIVES.has(prefixed[1]!)) {
      name = prefixed[1]!;
      out.push({ name, token: normalizeToken(prefixed[2]!) });
      continue;
    }
    out.push({ name, token: normalizeToken(trimmed) });
  }
  return out;
}
