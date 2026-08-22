import { describe, it, expect } from 'vitest';
import { NoBlanketBlockAudit } from './no-blanket-block';
import { AgentGovernanceAudit } from './agent-governance';
import { CrawlDelayAudit } from './crawl-delay';
import { AiBotDirectivesAudit } from './ai-bot-directives';
import { GptbotAudit } from './gptbot';
import { AnthropicAudit } from './anthropic-ai';
import { SensitivePathsAudit } from './sensitive-paths';
import type { Audit } from '../../audit';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

/**
 * Differential harness for every audit that reads `/robots.txt`.
 *
 * The robots consumers all route their parsing and matching through the shared
 * RFC 9309 gatherer (`gatherers/robots.ts`, re-exported by
 * `_robots-txt-helpers.ts`). This file pins the observable output of each
 * consumer — status, score, message, found — across a fixture corpus that
 * deliberately includes the edge cases where a hand-rolled parser and the
 * shared gatherer could disagree: product tokens carrying a `/version` suffix,
 * mixed case, comments, CRLF, a BOM, wildcard `Disallow: *`, and a
 * longest-match Allow that counteracts a blanket Disallow.
 *
 * Any refactor that moves a consumer onto more of the shared path has to leave
 * this table byte-identical. It is the guard that the adoption sweep changes
 * zero scan output.
 */

// ── Fixture corpus ────────────────────────────────────────────

interface Fixture {
  readonly name: string;
  /** `undefined` means no `/robots.txt` entry at all. */
  readonly body?: string;
  readonly status?: number;
}

const FIXTURES: Fixture[] = [
  { name: 'missing' },
  { name: 'non-200', body: '', status: 500 },
  { name: 'empty', body: '' },
  { name: 'html-error-page', body: '<html><body>Not found</body></html>' },
  { name: 'wildcard-allow', body: 'User-agent: *\nAllow: /' },
  { name: 'wildcard-blanket-block', body: 'User-agent: *\nDisallow: /' },
  {
    name: 'blanket-block-countered',
    body: 'User-agent: *\nDisallow: /\nAllow: /',
  },
  { name: 'wildcard-star-disallow', body: 'User-agent: *\nDisallow: *' },
  {
    name: 'both-categories',
    body: [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: CCBot',
      'Disallow: /',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: Claude-User',
      'Allow: /',
      '',
      'User-agent: *',
      'Allow: /',
    ].join('\n'),
  },
  {
    name: 'versioned-product-token',
    body: 'User-agent: GPTBot/1.1\nDisallow: /\n\nUser-agent: *\nAllow: /',
  },
  {
    name: 'mixed-case-tokens',
    body: 'user-agent: gptbot\ndisallow: /\n\nUser-Agent: ANTHROPIC-AI\nAllow: /',
  },
  {
    name: 'anthropic-alias-only',
    body: 'User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
  },
  {
    name: 'comments-and-crlf',
    body: '# leading comment\r\nUser-agent: *   # inline\r\nDisallow: /cart\r\nAllow: /\r\n',
  },
  {
    name: 'bom-prefixed',
    body: '﻿User-agent: *\nDisallow: /checkout\n',
  },
  {
    name: 'crawl-delay-reasonable',
    body: 'User-agent: *\nCrawl-delay: 5\nAllow: /',
  },
  {
    name: 'crawl-delay-excessive',
    body: 'User-agent: *\nCrawl-delay: 30\n\nUser-agent: GPTBot\nCrawl-delay: 2',
  },
  {
    name: 'grouped-agents',
    body: 'User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /',
  },
  {
    name: 'sensitive-paths-disallowed',
    body: 'User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout',
  },
  {
    name: 'youbot-and-ai2bot-explicit',
    body: 'User-agent: YouBot\nAllow: /\n\nUser-agent: AI2Bot\nAllow: /\n\nUser-agent: *\nAllow: /',
  },
  {
    name: 'youbot-blocked',
    body: 'User-agent: YouBot\nDisallow: /\n\nUser-agent: AI2Bot\nAllow: /',
  },
];

/**
 * A page carrying links into two low-value URL families, so
 * `sensitive-paths` always has candidates to judge and its robots.txt
 * matching is actually exercised.
 */
const PAGE_HTML =
  '<html><head><title>Shop</title></head><body><a href="/cart">Cart</a><a href="/checkout">Checkout</a></body></html>';

const AUDITS: Array<{ id: string; audit: Audit }> = [
  { id: 'no-blanket-block', audit: new NoBlanketBlockAudit() },
  { id: 'agent-governance', audit: new AgentGovernanceAudit() },
  { id: 'crawl-delay', audit: new CrawlDelayAudit() },
  { id: 'ai-bot-directives', audit: new AiBotDirectivesAudit() },
  { id: 'gptbot', audit: new GptbotAudit() },
  { id: 'anthropic-ai', audit: new AnthropicAudit() },
  { id: 'sensitive-paths', audit: new SensitivePathsAudit() },
];

function contextFor(fixture: Fixture) {
  const pages = [mockPageContext('https://example.com/', PAGE_HTML)];
  if (fixture.body === undefined) return mockCheckContext(pages, {});
  return mockCheckContext(pages, {
    '/robots.txt': mockFetchResult(fixture.body, fixture.status ?? 200),
  });
}

/** One row of the pinned table: the audit's whole observable surface. */
type Row = { status: string; score: number; message: string; found: string };

function runAll(): Record<string, Record<string, Row>> {
  const table: Record<string, Record<string, Row>> = {};
  for (const { id, audit } of AUDITS) {
    const perFixture: Record<string, Row> = {};
    for (const fixture of FIXTURES) {
      const result = audit.audit(contextFor(fixture)) as {
        status: string;
        score: number;
        message: string;
        found?: string;
      };
      perFixture[fixture.name] = {
        status: result.status,
        score: result.score,
        message: result.message,
        found: result.found ?? '',
      };
    }
    table[id] = perFixture;
  }
  return table;
}

describe('robots.txt consumers — shared-gatherer differential', () => {
  it('produces the pinned status/score/message/found for every fixture', () => {
    expect(runAll()).toEqual(BASELINE);
  });
});

// ── Pinned baseline ───────────────────────────────────────────
// Captured from the audits before the gatherer-adoption sweep. Do not
// regenerate: a diff here is a scan-output change, not a test fixup.

const BASELINE: Record<string, Record<string, Row>> = {
  "no-blanket-block": {
    "missing": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "wildcard-allow": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "wildcard-blanket-block": {
      "status": "fail",
      "score": 0,
      "message": "User-agent: * has Disallow: / — this blocks all crawlers including AI agents.",
      "found": "User-agent: * contains Disallow: /"
    },
    "blanket-block-countered": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "wildcard-star-disallow": {
      "status": "fail",
      "score": 0,
      "message": "User-agent: * has Disallow: / — this blocks all crawlers including AI agents.",
      "found": "User-agent: * contains Disallow: /"
    },
    "both-categories": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "versioned-product-token": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "mixed-case-tokens": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "anthropic-alias-only": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "comments-and-crlf": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "bom-prefixed": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "crawl-delay-reasonable": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "crawl-delay-excessive": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "grouped-agents": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "sensitive-paths-disallowed": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    },
    "youbot-blocked": {
      "status": "pass",
      "score": 1,
      "message": "No blanket Disallow: / found for User-agent: *.",
      "found": "Wildcard user-agent does not block all paths"
    }
  },
  "agent-governance": {
    "missing": {
      "status": "na",
      "score": 0,
      "message": "No robots.txt found — agentic governance cannot be evaluated.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "na",
      "score": 0,
      "message": "No robots.txt found — agentic governance cannot be evaluated.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "na",
      "score": 0,
      "message": "No robots.txt found — agentic governance cannot be evaluated.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt contains no AI-agent-specific rules.",
      "found": "No AI crawler user-agents named"
    },
    "wildcard-allow": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "wildcard-blanket-block": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "blanket-block-countered": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "wildcard-star-disallow": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "both-categories": {
      "status": "pass",
      "score": 1,
      "message": "Granular agentic governance: 2 training crawler(s) and 2 live agent(s) explicitly named with different policies.",
      "found": "Training: GPTBot, CCBot; Realtime: ChatGPT-User, Claude-User"
    },
    "versioned-product-token": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "mixed-case-tokens": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: GPTBot, anthropic-ai / ClaudeBot; Realtime: none"
    },
    "anthropic-alias-only": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: anthropic-ai / ClaudeBot; Realtime: none"
    },
    "comments-and-crlf": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "bom-prefixed": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "crawl-delay-reasonable": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "crawl-delay-excessive": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: GPTBot; Realtime: none"
    },
    "grouped-agents": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: GPTBot, CCBot; Realtime: none"
    },
    "sensitive-paths-disallowed": {
      "status": "fail",
      "score": 0,
      "message": "robots.txt only defines a catch-all User-agent: * — no AI-agent-specific rules found.",
      "found": "Only User-agent: * present"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: YouBot, AI2Bot; Realtime: none"
    },
    "youbot-blocked": {
      "status": "warn",
      "score": 0.5,
      "message": "Only training crawlers are explicitly governed in robots.txt — no rules for live conversational agents.",
      "found": "Training: YouBot, AI2Bot; Realtime: none"
    }
  },
  "crawl-delay": {
    "missing": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — cannot verify crawler permissions.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "wildcard-allow": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "wildcard-blanket-block": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "blanket-block-countered": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "wildcard-star-disallow": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "both-categories": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "versioned-product-token": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "mixed-case-tokens": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "anthropic-alias-only": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "comments-and-crlf": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "bom-prefixed": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "crawl-delay-reasonable": {
      "status": "pass",
      "score": 1,
      "message": "Crawl-delay values are reasonable: *: 5s",
      "found": "Crawl-delays: *: 5s"
    },
    "crawl-delay-excessive": {
      "status": "fail",
      "score": 0,
      "message": "Excessive Crawl-delay values found: *: 30s. Values above 10 seconds significantly slow down AI crawlers.",
      "found": "Excessive delays: *: 30s"
    },
    "grouped-agents": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "sensitive-paths-disallowed": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    },
    "youbot-blocked": {
      "status": "pass",
      "score": 1,
      "message": "No Crawl-delay directives found in robots.txt.",
      "found": "No Crawl-delay directives present"
    }
  },
  "ai-bot-directives": {
    "missing": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "warn",
      "score": 0.5,
      "message": "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "wildcard-allow": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "wildcard-blanket-block": {
      "status": "fail",
      "score": 0,
      "message": "YouBot, AI2Bot are blocked by robots.txt — the documented consumer path is closed.",
      "found": "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: blocked (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: blocked (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: blocked (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: blocked (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "blanket-block-countered": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "wildcard-star-disallow": {
      "status": "fail",
      "score": 0,
      "message": "YouBot, AI2Bot are blocked by robots.txt — the documented consumer path is closed.",
      "found": "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: blocked (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: blocked (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: blocked (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: blocked (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "both-categories": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "versioned-product-token": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "mixed-case-tokens": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "anthropic-alias-only": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "comments-and-crlf": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "bom-prefixed": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "crawl-delay-reasonable": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "crawl-delay-excessive": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "grouped-agents": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "sensitive-paths-disallowed": {
      "status": "warn",
      "score": 0.5,
      "message": "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      "found": "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "pass",
      "score": 1,
      "message": "YouBot and AI2Bot are explicitly allowed in robots.txt.",
      "found": "YouBot: explicitly allowed (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: explicitly allowed (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    },
    "youbot-blocked": {
      "status": "fail",
      "score": 0,
      "message": "YouBot is blocked by robots.txt — the documented consumer path is closed.",
      "found": "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: explicitly allowed (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)"
    }
  },
  "gptbot": {
    "missing": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "wildcard-allow": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "wildcard-blanket-block": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "blanket-block-countered": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "wildcard-star-disallow": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "both-categories": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "versioned-product-token": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "mixed-case-tokens": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "anthropic-alias-only": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "comments-and-crlf": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "bom-prefixed": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "crawl-delay-reasonable": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "crawl-delay-excessive": {
      "status": "pass",
      "score": 1,
      "message": "GPTBot is explicitly allowed in robots.txt.",
      "found": "Explicit rules found for GPTBot — access allowed"
    },
    "grouped-agents": {
      "status": "fail",
      "score": 0,
      "message": "GPTBot is blocked by robots.txt.",
      "found": "GPTBot is disallowed (Disallow: /)"
    },
    "sensitive-paths-disallowed": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    },
    "youbot-blocked": {
      "status": "warn",
      "score": 0.5,
      "message": "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for GPTBot — allowed via wildcard or default"
    }
  },
  "anthropic-ai": {
    "missing": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — anthropic-ai / ClaudeBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "non-200": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — anthropic-ai / ClaudeBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "empty": {
      "status": "warn",
      "score": 0.5,
      "message": "robots.txt not found — anthropic-ai / ClaudeBot is allowed by default but not explicitly.",
      "found": "No robots.txt found"
    },
    "html-error-page": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "wildcard-allow": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "wildcard-blanket-block": {
      "status": "fail",
      "score": 0,
      "message": "anthropic-ai / ClaudeBot is blocked by robots.txt.",
      "found": "anthropic-ai is disallowed (Disallow: /)"
    },
    "blanket-block-countered": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "wildcard-star-disallow": {
      "status": "fail",
      "score": 0,
      "message": "anthropic-ai / ClaudeBot is blocked by robots.txt.",
      "found": "anthropic-ai is disallowed (Disallow: /)"
    },
    "both-categories": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "versioned-product-token": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "mixed-case-tokens": {
      "status": "pass",
      "score": 1,
      "message": "anthropic-ai / ClaudeBot is explicitly allowed in robots.txt.",
      "found": "Explicit rules found for anthropic-ai — access allowed"
    },
    "anthropic-alias-only": {
      "status": "fail",
      "score": 0,
      "message": "anthropic-ai / ClaudeBot is blocked by robots.txt.",
      "found": "anthropic-ai is disallowed (Disallow: /)"
    },
    "comments-and-crlf": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "bom-prefixed": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "crawl-delay-reasonable": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "crawl-delay-excessive": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "grouped-agents": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "sensitive-paths-disallowed": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    },
    "youbot-blocked": {
      "status": "warn",
      "score": 0.5,
      "message": "anthropic-ai / ClaudeBot is allowed by default (no specific rules), but not explicitly allowed.",
      "found": "No explicit rules for anthropic-ai — allowed via wildcard or default"
    }
  },
  "sensitive-paths": {
    "missing": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)"
    },
    "non-200": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)"
    },
    "empty": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)"
    },
    "html-error-page": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)"
    },
    "wildcard-allow": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "wildcard-blanket-block": {
      "status": "na",
      "score": 0,
      "message": "robots.txt blanket-blocks AI crawlers, so individual low-value paths are already excluded.",
      "found": "Blanket block in robots.txt — see access-crawl-control/no-blanket-block"
    },
    "blanket-block-countered": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "wildcard-star-disallow": {
      "status": "na",
      "score": 0,
      "message": "robots.txt blanket-blocks AI crawlers, so individual low-value paths are already excluded.",
      "found": "Blanket block in robots.txt — see access-crawl-control/no-blanket-block"
    },
    "both-categories": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "versioned-product-token": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "mixed-case-tokens": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "anthropic-alias-only": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "comments-and-crlf": {
      "status": "warn",
      "score": 0.5,
      "message": "Some low-value URL families are still crawlable by AI crawlers: cart/checkout (/checkout).",
      "found": "Excluded: cart/checkout (/cart); still crawlable: cart/checkout (/checkout)"
    },
    "bom-prefixed": {
      "status": "warn",
      "score": 0.5,
      "message": "Some low-value URL families are still crawlable by AI crawlers: cart/checkout (/cart).",
      "found": "Excluded: cart/checkout (/checkout); still crawlable: cart/checkout (/cart)"
    },
    "crawl-delay-reasonable": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "crawl-delay-excessive": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "grouped-agents": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "sensitive-paths-disallowed": {
      "status": "pass",
      "score": 1,
      "message": "Every low-value URL family observed on the site is disallowed for AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Excluded: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "youbot-and-ai2bot-explicit": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    },
    "youbot-blocked": {
      "status": "fail",
      "score": 0,
      "message": "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      "found": "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)"
    }
  }
};
