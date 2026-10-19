/**
 * The bot registry: one row per robots.txt product token that an audit reads.
 *
 * Every fact here comes from the operator's own crawler page, re-fetched on
 * the `verified` date. Third-party bot lists are not a source. Audits select
 * their population from this table instead of keeping their own token lists,
 * so a token the operator retires, or a purpose it restates, changes in one
 * place. `scripts/watch-sources.ts` watches every `docUrl` weekly.
 *
 * Two rows carry `documented: false`: Bytespider and cohere-ai. No operator
 * page names them, so no scored audit counts them. They stay in the table only
 * so the informational ai-bot-directives report can still show a site's
 * stance on them.
 */

/** What the operator says the requests behind a token are for. */
export const BotPurpose = {
  /** Fetched content may train the operator's models. */
  Training: "training",
  /** Builds a search index that feeds AI answers. */
  AiSearch: "ai-search",
  /** Fetches a URL because a user asked for it. */
  UserFetch: "user-fetch",
  /** Classic web search. */
  Search: "search",
  /** Documented, but none of the above (ads review, extraction, site-owner crawls). */
  Other: "other",
  /** No operator documentation states a purpose. */
  Unknown: "unknown",
} as const;

export type BotPurpose = (typeof BotPurpose)[keyof typeof BotPurpose];

/** Every robots.txt product token the registry has a row for. */
export const BotToken = {
  GPTBot: "GPTBot",
  OAISearchBot: "OAI-SearchBot",
  ChatGPTUser: "ChatGPT-User",
  OAIAdsBot: "OAI-AdsBot",
  GoogleExtended: "Google-Extended",
  Googlebot: "Googlebot",
  GoogleCloudVertexBot: "Google-CloudVertexBot",
  ClaudeBot: "ClaudeBot",
  ClaudeUser: "Claude-User",
  ClaudeSearchBot: "Claude-SearchBot",
  ApplebotExtended: "Applebot-Extended",
  Applebot: "Applebot",
  CCBot: "CCBot",
  PerplexityBot: "PerplexityBot",
  PerplexityUser: "Perplexity-User",
  MetaExternalAgent: "Meta-ExternalAgent",
  MetaExternalFetcher: "Meta-ExternalFetcher",
  MetaWebIndexer: "Meta-WebIndexer",
  Amazonbot: "Amazonbot",
  AmznSearchBot: "Amzn-SearchBot",
  AmznUser: "Amzn-User",
  DuckAssistBot: "DuckAssistBot",
  Bytespider: "Bytespider",
  CohereAi: "cohere-ai",
  AI2Bot: "AI2Bot",
  MistralAITraining: "MistralAI-Training",
  MistralAIUser: "MistralAI-User",
  MistralAIIndex: "MistralAI-Index",
  YouBot: "YouBot",
  Bingbot: "Bingbot",
  Diffbot: "Diffbot",
  DiffbotUser: "Diffbot-User",
} as const;

export type BotToken = (typeof BotToken)[keyof typeof BotToken];

/** A User-Agent string an audit may send to impersonate the token's requests. */
export interface ProbeUserAgent {
  /** The literal header value sent. */
  ua: string;
  /**
   * True when the string was observed in traffic, not published by the
   * operator. Every consuming dossier records this under
   * `## Implementation deviations`.
   */
  observed: boolean;
}

export interface BotEntry {
  /** The robots.txt product token, in the spelling the operator documents. */
  token: BotToken;
  operator: string;
  purpose: BotPurpose;
  /** True when an operator page names this token. */
  documented: boolean;
  /** The operator's crawler page, or null when there is none. */
  docUrl: string | null;
  /** The operator's published IP list, or null when the page links none. */
  ipRangesUrl: string | null;
  /** True when the operator documents that the bot signs requests (Web Bot Auth). */
  webBotAuth: boolean;
  /**
   * True for a usage-control token such as Google-Extended: robots.txt rules
   * name it, but no request carries it.
   */
  controlToken: boolean;
  /** User-Agent strings as the operator publishes them, placeholders included. */
  userAgents: readonly string[];
  /** The string UA-parity probes send, when one can be sent honestly. */
  probe: ProbeUserAgent | null;
  /** Date the operator page was last re-read for this row. */
  verified: string;
}

const VERIFIED = "2026-10-19";

const OPENAI_DOC = "https://developers.openai.com/api/docs/bots";
const ANTHROPIC_DOC =
  "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler";
const ANTHROPIC_IPS = "https://claude.com/crawling/bots.json";
const GOOGLE_DOC =
  "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers";
const GOOGLE_IPS =
  "https://developers.google.com/static/crawling/ipranges/common-crawlers.json";
const APPLE_DOC = "https://support.apple.com/en-us/119829";
const PERPLEXITY_DOC =
  "https://docs.perplexity.ai/docs/resources/perplexity-crawlers";
const META_DOC =
  "https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/";
const AMAZON_DOC = "https://developer.amazon.com/amazonbot";
const MISTRAL_DOC = "https://docs.mistral.ai/robots";
const DIFFBOT_DOC = "https://www.diffbot.com/docs/crawl/faq/robots-txt";

/** Shared defaults for a documented row; each entry states what differs. */
function documented(
  entry: Pick<BotEntry, "token" | "operator" | "purpose" | "docUrl"> &
    Partial<BotEntry>,
): BotEntry {
  return {
    documented: true,
    ipRangesUrl: null,
    webBotAuth: false,
    controlToken: false,
    userAgents: [],
    probe: null,
    verified: VERIFIED,
    ...entry,
  };
}

/**
 * The table. Order is significant: derived lists (the robots.txt crawler
 * tables, the UA probe set) keep this order, and report text lists bots in it.
 */
export const BOT_REGISTRY: readonly BotEntry[] = [
  documented({
    token: BotToken.GPTBot,
    operator: "OpenAI",
    purpose: BotPurpose.Training,
    docUrl: OPENAI_DOC,
    ipRangesUrl: "https://openai.com/gptbot.json",
    // OpenAI says that "when fetching robots.txt files, we may add a
    // robots.txt marker to the user-agent string", but, unlike for
    // OAI-SearchBot, prints no GPTBot string with the marker (verified
    // 2026-10-19). Writing one here would invent it, so only the printed
    // string is listed.
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
    ],
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
      observed: false,
    },
  }),
  documented({
    token: BotToken.OAISearchBot,
    operator: "OpenAI",
    purpose: BotPurpose.AiSearch,
    docUrl: OPENAI_DOC,
    ipRangesUrl: "https://openai.com/searchbot.json",
    userAgents: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; robots.txt; +https://openai.com/searchbot",
    ],
    probe: {
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
      observed: false,
    },
  }),
  documented({
    token: BotToken.ChatGPTUser,
    operator: "OpenAI",
    purpose: BotPurpose.UserFetch,
    docUrl: OPENAI_DOC,
    ipRangesUrl: "https://openai.com/chatgpt-user.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
    ],
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
      observed: false,
    },
  }),
  documented({
    token: BotToken.OAIAdsBot,
    operator: "OpenAI",
    purpose: BotPurpose.Other,
    docUrl: OPENAI_DOC,
    ipRangesUrl: "https://openai.com/adsbot.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-AdsBot/1.0; +https://openai.com/adsbot",
    ],
  }),
  documented({
    token: BotToken.GoogleExtended,
    operator: "Google",
    purpose: BotPurpose.Training,
    docUrl: GOOGLE_DOC,
    // "Google-Extended doesn't have a separate HTTP request user agent string."
    controlToken: true,
  }),
  documented({
    token: BotToken.Googlebot,
    operator: "Google",
    purpose: BotPurpose.Search,
    docUrl: GOOGLE_DOC,
    ipRangesUrl: GOOGLE_IPS,
    userAgents: [
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/W.X.Y.Z Safari/537.36",
    ],
    // Never probed: Cloudflare ships a fake-Googlebot managed rule.
  }),
  documented({
    token: BotToken.GoogleCloudVertexBot,
    operator: "Google",
    purpose: BotPurpose.Other,
    docUrl: GOOGLE_DOC,
    ipRangesUrl: GOOGLE_IPS,
  }),
  documented({
    token: BotToken.ClaudeBot,
    operator: "Anthropic",
    purpose: BotPurpose.Training,
    docUrl: ANTHROPIC_DOC,
    ipRangesUrl: ANTHROPIC_IPS,
    // Anthropic publishes no User-Agent string; the probe string is observed.
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      observed: true,
    },
  }),
  documented({
    token: BotToken.ClaudeUser,
    operator: "Anthropic",
    purpose: BotPurpose.UserFetch,
    docUrl: ANTHROPIC_DOC,
    ipRangesUrl: ANTHROPIC_IPS,
    // Anthropic publishes no User-Agent string; the probe string is observed.
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
      observed: true,
    },
  }),
  documented({
    token: BotToken.ClaudeSearchBot,
    operator: "Anthropic",
    purpose: BotPurpose.AiSearch,
    docUrl: ANTHROPIC_DOC,
    ipRangesUrl: ANTHROPIC_IPS,
  }),
  documented({
    token: BotToken.ApplebotExtended,
    operator: "Apple",
    purpose: BotPurpose.Training,
    docUrl: APPLE_DOC,
    // "Applebot-Extended does not crawl webpages."
    controlToken: true,
  }),
  documented({
    token: BotToken.Applebot,
    operator: "Apple",
    // Apple says Applebot data "may also be used to help train Apple
    // foundation models"; the opt-out for that use is Applebot-Extended.
    purpose: BotPurpose.Search,
    docUrl: APPLE_DOC,
    ipRangesUrl: "https://search.developer.apple.com/applebot.json",
    userAgents: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1 (Applebot/0.1; +http://www.apple.com/go/applebot)",
    ],
  }),
  documented({
    token: BotToken.CCBot,
    operator: "Common Crawl",
    purpose: BotPurpose.Training,
    docUrl: "https://commoncrawl.org/ccbot",
    ipRangesUrl: "https://index.commoncrawl.org/ccbot.json",
    userAgents: ["CCBot/2.0 (https://commoncrawl.org/faq/)"],
  }),
  documented({
    token: BotToken.PerplexityBot,
    operator: "Perplexity",
    // "It is not used to crawl content for AI foundation models."
    purpose: BotPurpose.AiSearch,
    docUrl: PERPLEXITY_DOC,
    ipRangesUrl: "https://www.perplexity.com/perplexitybot.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    ],
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
      observed: false,
    },
  }),
  documented({
    token: BotToken.PerplexityUser,
    operator: "Perplexity",
    purpose: BotPurpose.UserFetch,
    docUrl: PERPLEXITY_DOC,
    ipRangesUrl: "https://www.perplexity.com/perplexity-user.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    ],
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
      observed: false,
    },
  }),
  documented({
    token: BotToken.MetaExternalAgent,
    operator: "Meta",
    purpose: BotPurpose.Training,
    docUrl: META_DOC,
    // Meta says log entries "will be similar to" these; no IP list is linked.
    userAgents: [
      "meta-externalagent/1.1 (+/documentation/sharing/webmasters/web-crawlers)",
      "meta-externalagent/1.1",
    ],
  }),
  documented({
    token: BotToken.MetaExternalFetcher,
    operator: "Meta",
    purpose: BotPurpose.UserFetch,
    docUrl: META_DOC,
    userAgents: [
      "meta-externalfetcher/1.1 (+/documentation/sharing/webmasters/web-crawlers)",
      "meta-externalfetcher/1.1",
    ],
  }),
  documented({
    token: BotToken.MetaWebIndexer,
    operator: "Meta",
    purpose: BotPurpose.AiSearch,
    docUrl: META_DOC,
    userAgents: [
      "meta-webindexer/1.1 (+/documentation/sharing/webmasters/web-crawlers)",
      "meta-webindexer/1.1",
    ],
  }),
  documented({
    token: BotToken.Amazonbot,
    operator: "Amazon",
    purpose: BotPurpose.Training,
    docUrl: AMAZON_DOC,
    ipRangesUrl: "https://developer.amazon.com/amazonbot/ip-addresses/",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36",
    ],
  }),
  documented({
    token: BotToken.AmznSearchBot,
    operator: "Amazon",
    purpose: BotPurpose.AiSearch,
    docUrl: AMAZON_DOC,
    ipRangesUrl:
      "https://developer.amazon.com/amazonbot/searchbot-ip-addresses/",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/W.X.Y.Z Safari/537.36",
    ],
  }),
  documented({
    token: BotToken.AmznUser,
    operator: "Amazon",
    purpose: BotPurpose.UserFetch,
    docUrl: AMAZON_DOC,
    ipRangesUrl: "https://developer.amazon.com/amazonbot/live-ip-addresses/",
    // The Chrome version is a placeholder, so no literal probe string exists.
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/W.X.Y.Z Safari/537.36",
    ],
  }),
  documented({
    token: BotToken.DuckAssistBot,
    operator: "DuckDuckGo",
    purpose: BotPurpose.AiSearch,
    docUrl:
      "https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot",
    ipRangesUrl: "https://duckduckgo.com/duckassistbot.json",
    userAgents: [
      "DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)",
    ],
  }),
  {
    token: BotToken.Bytespider,
    operator: "ByteDance",
    purpose: BotPurpose.Unknown,
    documented: false,
    docUrl: null,
    ipRangesUrl: null,
    webBotAuth: false,
    controlToken: false,
    userAgents: [],
    probe: null,
    verified: VERIFIED,
  },
  {
    token: BotToken.CohereAi,
    operator: "Cohere",
    purpose: BotPurpose.Unknown,
    documented: false,
    docUrl: null,
    ipRangesUrl: null,
    webBotAuth: false,
    controlToken: false,
    userAgents: [],
    probe: null,
    verified: VERIFIED,
  },
  documented({
    token: BotToken.AI2Bot,
    operator: "Allen Institute for AI",
    purpose: BotPurpose.Training,
    docUrl: "https://allenai.org/crawler",
    userAgents: [
      "Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)",
    ],
  }),
  documented({
    token: BotToken.MistralAITraining,
    operator: "Mistral AI",
    purpose: BotPurpose.Training,
    docUrl: MISTRAL_DOC,
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Training/1.0; +https://docs.mistral.ai/robots)",
    ],
  }),
  documented({
    token: BotToken.MistralAIUser,
    operator: "Mistral AI",
    purpose: BotPurpose.UserFetch,
    docUrl: MISTRAL_DOC,
    ipRangesUrl: "https://mistral.ai/mistralai-user-ips.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)",
    ],
    probe: {
      ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)",
      observed: false,
    },
  }),
  documented({
    token: BotToken.MistralAIIndex,
    operator: "Mistral AI",
    purpose: BotPurpose.AiSearch,
    docUrl: MISTRAL_DOC,
    ipRangesUrl: "https://mistral.ai/mistralai-index-ips.json",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Index/1.0; +https://docs.mistral.ai/robots)",
    ],
  }),
  documented({
    token: BotToken.YouBot,
    operator: "You.com",
    purpose: BotPurpose.AiSearch,
    docUrl: "https://you.com/docs/youbot",
    // You.com names one /24 in prose ("68.67.112.0/24") and links no list.
    // "YouBot uses Cloudflare's Web Bot Auth standard for authentication."
    webBotAuth: true,
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/X.X.X.X Safari/537.36",
    ],
  }),
  documented({
    token: BotToken.Bingbot,
    operator: "Microsoft",
    purpose: BotPurpose.Search,
    docUrl:
      "https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0",
    userAgents: [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/W.X.Y.Z Safari/537.36",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    ],
    // Never probed: Cloudflare ships a fake-Bingbot managed rule.
  }),
  documented({
    token: BotToken.Diffbot,
    operator: "Diffbot",
    // "General, proactive web crawling for building a general search engine";
    // Diffbot "does not crawl pages for training generative AI foundation models".
    purpose: BotPurpose.Other,
    docUrl: DIFFBOT_DOC,
  }),
  documented({
    token: BotToken.DiffbotUser,
    operator: "Diffbot",
    // "Used by requests originating on behalf of a human user browsing a URL"
    // in Diffbot's own software, not an AI answer engine.
    purpose: BotPurpose.Other,
    docUrl: DIFFBOT_DOC,
  }),
];

/** The registry row for a token. Throws on a token the registry lacks. */
export function botEntry(token: BotToken): BotEntry {
  const entry = BOT_REGISTRY.find((bot) => bot.token === token);
  if (!entry) throw new Error(`Bot registry has no row for ${token}`);
  return entry;
}

/** Documented rows whose purpose is one of `purposes`, in registry order. */
export function botsByPurpose(
  ...purposes: readonly BotPurpose[]
): readonly BotEntry[] {
  return BOT_REGISTRY.filter(
    (bot) => bot.documented && purposes.includes(bot.purpose),
  );
}
