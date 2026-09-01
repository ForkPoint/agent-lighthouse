import { describe, it, expect } from "vitest";
import { NoBlanketBlockAudit } from "./no-blanket-block";
import { AgentGovernanceAudit } from "./agent-governance";
import { CrawlDelayAudit } from "./crawl-delay";
import { AiBotDirectivesAudit } from "./ai-bot-directives";
import { GptbotAudit } from "./gptbot";
import { AnthropicAudit } from "./anthropic-ai";
import { SensitivePathsAudit } from "./sensitive-paths";
import type { Audit } from "../../audit";
import type { AuditResult } from "../../types";
import {
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
} from "../../__tests__/test-utils";

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
  { name: "missing" },
  { name: "non-200", body: "", status: 500 },
  { name: "empty", body: "" },
  { name: "html-error-page", body: "<html><body>Not found</body></html>" },
  { name: "wildcard-allow", body: "User-agent: *\nAllow: /" },
  { name: "wildcard-blanket-block", body: "User-agent: *\nDisallow: /" },
  {
    name: "blanket-block-countered",
    body: "User-agent: *\nDisallow: /\nAllow: /",
  },
  { name: "wildcard-star-disallow", body: "User-agent: *\nDisallow: *" },
  {
    name: "both-categories",
    body: [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: CCBot",
      "Disallow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: Claude-User",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n"),
  },
  {
    name: "versioned-product-token",
    body: "User-agent: GPTBot/1.1\nDisallow: /\n\nUser-agent: *\nAllow: /",
  },
  {
    name: "mixed-case-tokens",
    body: "user-agent: gptbot\ndisallow: /\n\nUser-Agent: ANTHROPIC-AI\nAllow: /",
  },
  {
    name: "anthropic-alias-only",
    body: "User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /",
  },
  {
    name: "comments-and-crlf",
    body: "# leading comment\r\nUser-agent: *   # inline\r\nDisallow: /cart\r\nAllow: /\r\n",
  },
  {
    name: "bom-prefixed",
    body: "﻿User-agent: *\nDisallow: /checkout\n",
  },
  {
    name: "crawl-delay-reasonable",
    body: "User-agent: *\nCrawl-delay: 5\nAllow: /",
  },
  {
    name: "crawl-delay-excessive",
    body: "User-agent: *\nCrawl-delay: 30\n\nUser-agent: GPTBot\nCrawl-delay: 2",
  },
  {
    name: "grouped-agents",
    body: "User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nAllow: /",
  },
  {
    name: "sensitive-paths-disallowed",
    body: "User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout",
  },
  {
    name: "youbot-and-ai2bot-explicit",
    body: "User-agent: YouBot\nAllow: /\n\nUser-agent: AI2Bot\nAllow: /\n\nUser-agent: *\nAllow: /",
  },
  {
    name: "youbot-blocked",
    body: "User-agent: YouBot\nDisallow: /\n\nUser-agent: AI2Bot\nAllow: /",
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
  { id: "no-blanket-block", audit: new NoBlanketBlockAudit() },
  { id: "agent-governance", audit: new AgentGovernanceAudit() },
  { id: "crawl-delay", audit: new CrawlDelayAudit() },
  { id: "ai-bot-directives", audit: new AiBotDirectivesAudit() },
  { id: "gptbot", audit: new GptbotAudit() },
  { id: "anthropic-ai", audit: new AnthropicAudit() },
  { id: "sensitive-paths", audit: new SensitivePathsAudit() },
];

function contextFor(fixture: Fixture) {
  const pages = [mockPageContext("https://example.com/", PAGE_HTML)];
  if (fixture.body === undefined) return mockCheckContext(pages, {});
  return mockCheckContext(pages, {
    "/robots.txt": mockFetchResult(fixture.body, fixture.status ?? 200),
  });
}

/** One row of the pinned table: the audit's whole observable surface. */
type Row = {
  status: string;
  score: number;
  message: string;
  found: string;
  /** Pinned too: a priority regression is a change in what the user is told to do first. */
  priority: string;
  /** Pinned too: structured evidence now survives validation and reaches reports. */
  details: string;
};

async function runAll(): Promise<Record<string, Record<string, Row>>> {
  const table: Record<string, Record<string, Row>> = {};
  for (const { id, audit } of AUDITS) {
    const perFixture: Record<string, Row> = {};
    for (const fixture of FIXTURES) {
      const result = (await audit.audit(contextFor(fixture))) as AuditResult;
      const check = audit.toCheckResult(result);
      // `evidenceUrl` joins docsUrl/effort as framework-derived metadata: it is
      // a pure function of the audit id, not scan output, so it is excluded
      // here rather than regenerating the baseline.
      const {
        expected: _e,
        found: _f,
        code: _c,
        docsUrl: _d,
        effort: _ef,
        evidenceUrl: _ev,
        ...extra
      } = check.details ?? {};
      perFixture[fixture.name] = {
        status: result.status,
        score: result.score,
        message: result.message ?? "",
        found: result.found ?? "",
        priority: check.priority,
        details: JSON.stringify(extra),
      };
    }
    table[id] = perFixture;
  }
  return table;
}

describe("robots.txt consumers — shared-gatherer differential", () => {
  it("produces the pinned output for every fixture", async () => {
    if (process.env["AL_REGEN_BASELINE"] === "1") {
      // Deliberate regeneration path, used when a scan-output change is
      // intended and reviewed. Never on by default.
      require("node:fs").writeFileSync(
        require("node:path").resolve(__dirname, "_baseline.generated.json"),
        JSON.stringify(await runAll(), null, 2),
      );
    }
    expect(await runAll()).toEqual(BASELINE);
  });
});

// ── Pinned baseline ───────────────────────────────────────────
// Captured from the audits before the gatherer-adoption sweep. Do not
// regenerate: a diff here is a scan-output change, not a test fixup.
//
// Regenerated once, deliberately, in Plan 6: ai-bot-directives claimed
// wildcard-only access on the two fixtures that have no wildcard group at all
// (html-error-page, mixed-case-tokens). Those two messages are the only
// previously pinned values that moved. The table also grew `priority` and
// `details`, which were unpinned before — a priority regression used to pass
// this test.

// Regenerated a second time, deliberately, in the contradiction sweep
// (2026-08-24): agent-governance stopped failing sites whose robots.txt has an
// open catch-all. RFC 9309 §2.2.1 makes the fallback grant every named agent
// the same access the explicit groups would, so there was nothing to separate
// and no vendor rewards the groups being present. Those fixtures move from
// `fail` to `na`; the two blanket-block fixtures now carry the only failure
// the evidence supports. No other audit's rows moved.

// Regenerated a third time, deliberately, in the contradiction sweep
// (2026-08-24): anthropic-ai now scores the live `ClaudeBot` token alone. The
// retired `anthropic-ai` and `Claude-Web` aliases became a non-scoring note, so
// the audit no longer awards half a point for a group Anthropic's crawlers stop
// reading. Four fixtures with no readable robots.txt (`missing`, `non-200`,
// `empty`, `html-error-page`) move from `warn`/0.5 to `na`/0; twelve fixtures
// that leave ClaudeBot able to fetch `/` move from `warn`/0.5 to `pass`/1; the
// three that disallow it stay `fail`/0 with new text at priority `medium`. No
// other audit's rows moved.

const BASELINE: Record<string, Record<string, Row>> = {
  "no-blanket-block": {
    missing: {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "wildcard-allow": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "wildcard-blanket-block": {
      status: "fail",
      score: 0,
      message:
        "User-agent: * has Disallow: / — this blocks all crawlers including AI agents.",
      found: "User-agent: * contains Disallow: /",
      priority: "critical",
      details: "{}",
    },
    "blanket-block-countered": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "wildcard-star-disallow": {
      status: "fail",
      score: 0,
      message:
        "User-agent: * has Disallow: / — this blocks all crawlers including AI agents.",
      found: "User-agent: * contains Disallow: /",
      priority: "critical",
      details: "{}",
    },
    "both-categories": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "versioned-product-token": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "mixed-case-tokens": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "anthropic-alias-only": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "comments-and-crlf": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "bom-prefixed": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "crawl-delay-reasonable": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "crawl-delay-excessive": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "grouped-agents": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "sensitive-paths-disallowed": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "youbot-and-ai2bot-explicit": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
    "youbot-blocked": {
      status: "pass",
      score: 1,
      message: "No blanket Disallow: / found for User-agent: *.",
      found: "Wildcard user-agent does not block all paths",
      priority: "critical",
      details: "{}",
    },
  },
  "agent-governance": {
    missing: {
      status: "na",
      score: 0,
      message:
        "No robots.txt found \u2014 agentic governance cannot be evaluated.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "na",
      score: 0,
      message:
        "No robots.txt found \u2014 agentic governance cannot be evaluated.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "na",
      score: 0,
      message:
        "No robots.txt found \u2014 agentic governance cannot be evaluated.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "na",
      score: 0,
      message:
        "robots.txt names no AI agents and blocks nothing, so every agent is already allowed.",
      found: "No restrictions in robots.txt",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":false}',
    },
    "wildcard-allow": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "wildcard-blanket-block": {
      status: "fail",
      score: 0,
      message:
        "robots.txt blocks every agent through the catch-all group. Under the RFC 9309 fallback that block also applies to live conversational agents, so the site is closed to the agents that cite and link back to it, not only to dataset crawlers.",
      found: "Catch-all blocks all agents, no per-agent exceptions",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "blanket-block-countered": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "wildcard-star-disallow": {
      status: "fail",
      score: 0,
      message:
        "robots.txt blocks every agent through the catch-all group. Under the RFC 9309 fallback that block also applies to live conversational agents, so the site is closed to the agents that cite and link back to it, not only to dataset crawlers.",
      found: "Catch-all blocks all agents, no per-agent exceptions",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "both-categories": {
      status: "pass",
      score: 1,
      message:
        "Granular agentic governance: 2 training crawler(s) and 2 live agent(s) explicitly named with different policies.",
      found: "Training: GPTBot, CCBot; Realtime: ChatGPT-User, Claude-User",
      priority: "medium",
      details:
        '{"trainingAgents":["GPTBot","CCBot"],"realtimeAgents":["ChatGPT-User","Claude-User"],"hasCatchAll":true}',
    },
    "versioned-product-token": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "mixed-case-tokens": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: GPTBot, anthropic-ai / ClaudeBot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["GPTBot","anthropic-ai / ClaudeBot"],"realtimeAgents":[],"hasCatchAll":false}',
    },
    "anthropic-alias-only": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: anthropic-ai / ClaudeBot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["anthropic-ai / ClaudeBot"],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "comments-and-crlf": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "bom-prefixed": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "crawl-delay-reasonable": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "crawl-delay-excessive": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: GPTBot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["GPTBot"],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "grouped-agents": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: GPTBot, CCBot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["GPTBot","CCBot"],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "sensitive-paths-disallowed": {
      status: "na",
      score: 0,
      message:
        "robots.txt grants every agent access through the catch-all group, so training crawlers and live agents already have the same policy and there is nothing to separate.",
      found: "Catch-all grants access",
      priority: "medium",
      details: '{"trainingAgents":[],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "youbot-and-ai2bot-explicit": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: YouBot, AI2Bot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["YouBot","AI2Bot"],"realtimeAgents":[],"hasCatchAll":true}',
    },
    "youbot-blocked": {
      status: "warn",
      score: 0.5,
      message:
        "Only training crawlers are explicitly governed in robots.txt \u2014 no rules for live conversational agents.",
      found: "Training: YouBot, AI2Bot; Realtime: none",
      priority: "medium",
      details:
        '{"trainingAgents":["YouBot","AI2Bot"],"realtimeAgents":[],"hasCatchAll":false}',
    },
  },
  "crawl-delay": {
    missing: {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "warn",
      score: 0.5,
      message: "No robots.txt found — cannot verify crawler permissions.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "wildcard-allow": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "wildcard-blanket-block": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "blanket-block-countered": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "wildcard-star-disallow": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "both-categories": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "versioned-product-token": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "mixed-case-tokens": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "anthropic-alias-only": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "comments-and-crlf": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "bom-prefixed": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "crawl-delay-reasonable": {
      status: "pass",
      score: 1,
      message: "Crawl-delay values are reasonable: *: 5s",
      found: "Crawl-delays: *: 5s",
      priority: "high",
      details: "{}",
    },
    "crawl-delay-excessive": {
      status: "fail",
      score: 0,
      message:
        "Excessive Crawl-delay values found: *: 30s. Values above 10 seconds significantly slow down AI crawlers.",
      found: "Excessive delays: *: 30s",
      priority: "high",
      details: "{}",
    },
    "grouped-agents": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "sensitive-paths-disallowed": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "youbot-and-ai2bot-explicit": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
    "youbot-blocked": {
      status: "pass",
      score: 1,
      message: "No Crawl-delay directives found in robots.txt.",
      found: "No Crawl-delay directives present",
      priority: "high",
      details: "{}",
    },
  },
  "ai-bot-directives": {
    missing: {
      status: "warn",
      score: 0.5,
      message:
        "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "warn",
      score: 0.5,
      message:
        "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "warn",
      score: 0.5,
      message:
        "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed by default: robots.txt has no directive for them and no wildcard rule either.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "wildcard-allow": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "wildcard-blanket-block": {
      status: "fail",
      score: 0,
      message:
        "YouBot, AI2Bot are blocked by robots.txt — the documented consumer path is closed.",
      found:
        "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: blocked (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: blocked (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: blocked (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: blocked (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "blanket-block-countered": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "wildcard-star-disallow": {
      status: "fail",
      score: 0,
      message:
        "YouBot, AI2Bot are blocked by robots.txt — the documented consumer path is closed.",
      found:
        "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: blocked (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: blocked (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: blocked (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: blocked (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "both-categories": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "versioned-product-token": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "mixed-case-tokens": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed by default: robots.txt has no directive for them and no wildcard rule either.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "anthropic-alias-only": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "comments-and-crlf": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "bom-prefixed": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "crawl-delay-reasonable": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "crawl-delay-excessive": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "grouped-agents": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "sensitive-paths-disallowed": {
      status: "warn",
      score: 0.5,
      message:
        "YouBot, AI2Bot are allowed only through the wildcard rule — no explicit directive.",
      found:
        "YouBot: allowed by default (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: allowed by default (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "youbot-and-ai2bot-explicit": {
      status: "pass",
      score: 1,
      message: "YouBot and AI2Bot are explicitly allowed in robots.txt.",
      found:
        "YouBot: explicitly allowed (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: explicitly allowed (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
    "youbot-blocked": {
      status: "fail",
      score: 0,
      message:
        "YouBot is blocked by robots.txt — the documented consumer path is closed.",
      found:
        "YouBot: blocked (scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier))\nAI2Bot: explicitly allowed (scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora)\nBytespider: allowed by default (informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt)\ncohere-ai: allowed by default (informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler))\nDiffbot: allowed by default (informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility)",
      priority: "medium",
      details: "{}",
    },
  },
  gptbot: {
    missing: {
      status: "warn",
      score: 0.5,
      message:
        "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "warn",
      score: 0.5,
      message:
        "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "warn",
      score: 0.5,
      message:
        "robots.txt not found — GPTBot is allowed by default but not explicitly.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "wildcard-allow": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "wildcard-blanket-block": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "blanket-block-countered": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "wildcard-star-disallow": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "both-categories": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "versioned-product-token": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "mixed-case-tokens": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "anthropic-alias-only": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "comments-and-crlf": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "bom-prefixed": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "crawl-delay-reasonable": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "crawl-delay-excessive": {
      status: "pass",
      score: 1,
      message: "GPTBot is explicitly allowed in robots.txt.",
      found: "Explicit rules found for GPTBot — access allowed",
      priority: "medium",
      details: "{}",
    },
    "grouped-agents": {
      status: "fail",
      score: 0,
      message: "GPTBot is blocked by robots.txt.",
      found: "GPTBot is disallowed (Disallow: /)",
      priority: "high",
      details: "{}",
    },
    "sensitive-paths-disallowed": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "youbot-and-ai2bot-explicit": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
    "youbot-blocked": {
      status: "warn",
      score: 0.5,
      message:
        "GPTBot is allowed by default (no specific rules), but not explicitly allowed.",
      found: "No explicit rules for GPTBot — allowed via wildcard or default",
      priority: "medium",
      details: "{}",
    },
  },
  "anthropic-ai": {
    missing: {
      status: "na",
      score: 0,
      message:
        "No robots.txt to read, so there are no crawl rules to evaluate for ClaudeBot.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "non-200": {
      status: "na",
      score: 0,
      message:
        "No robots.txt to read, so there are no crawl rules to evaluate for ClaudeBot.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    empty: {
      status: "na",
      score: 0,
      message:
        "No robots.txt to read, so there are no crawl rules to evaluate for ClaudeBot.",
      found: "No robots.txt found",
      priority: "medium",
      details: "{}",
    },
    "html-error-page": {
      status: "na",
      score: 0,
      message:
        "The response at /robots.txt carries no crawl rules, so there is nothing to evaluate for ClaudeBot.",
      found: "robots.txt contains no user-agent groups and no directives",
      priority: "medium",
      details: "{}",
    },
    "wildcard-allow": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "wildcard-blanket-block": {
      status: "fail",
      score: 0,
      message:
        "ClaudeBot is disallowed at the site root. Anthropic states its bots honour robots.txt, so the block takes effect: the site is excluded from the web content Anthropic collects for potential model training.",
      found: "The catch-all group disallows / and no group names ClaudeBot",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":false,"legacyTokens":[]}',
    },
    "blanket-block-countered": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "wildcard-star-disallow": {
      status: "fail",
      score: 0,
      message:
        "ClaudeBot is disallowed at the site root. Anthropic states its bots honour robots.txt, so the block takes effect: the site is excluded from the web content Anthropic collects for potential model training.",
      found: "The catch-all group disallows / and no group names ClaudeBot",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":false,"legacyTokens":[]}',
    },
    "both-categories": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "versioned-product-token": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "mixed-case-tokens": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group in robots.txt applies to it, so nothing restricts its crawl.",
      found:
        "No group applies to ClaudeBot · legacy anthropic-ai group present — Anthropic's current crawler documentation names only ClaudeBot, Claude-User and Claude-SearchBot, so this group is not a documented Anthropic access control and does not affect this result.",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":false,"allowed":true,"legacyTokens":["anthropic-ai"]}',
    },
    "anthropic-alias-only": {
      status: "fail",
      score: 0,
      message:
        "ClaudeBot is disallowed at the site root. Anthropic states its bots honour robots.txt, so the block takes effect: the site is excluded from the web content Anthropic collects for potential model training.",
      found: "Its own group disallows /",
      priority: "medium",
      details:
        '{"namedGroup":true,"hasCatchAll":true,"allowed":false,"legacyTokens":[]}',
    },
    "comments-and-crlf": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "bom-prefixed": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "crawl-delay-reasonable": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "crawl-delay-excessive": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "grouped-agents": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "sensitive-paths-disallowed": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "youbot-and-ai2bot-explicit": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.",
      found: "Allowed through the catch-all group",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":true,"allowed":true,"legacyTokens":[]}',
    },
    "youbot-blocked": {
      status: "pass",
      score: 1,
      message:
        "ClaudeBot is allowed. No group in robots.txt applies to it, so nothing restricts its crawl.",
      found: "No group applies to ClaudeBot",
      priority: "medium",
      details:
        '{"namedGroup":false,"hasCatchAll":false,"allowed":true,"legacyTokens":[]}',
    },
  },
  "sensitive-paths": {
    missing: {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)",
      priority: "low",
      details: "{}",
    },
    "non-200": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)",
      priority: "low",
      details: "{}",
    },
    empty: {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)",
      priority: "low",
      details: "{}",
    },
    "html-error-page": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout) (no robots.txt is served)",
      priority: "low",
      details: "{}",
    },
    "wildcard-allow": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "wildcard-blanket-block": {
      status: "na",
      score: 0,
      message:
        "robots.txt blanket-blocks AI crawlers, so individual low-value paths are already excluded.",
      found:
        "Blanket block in robots.txt — see access-crawl-control/no-blanket-block",
      priority: "low",
      details: "{}",
    },
    "blanket-block-countered": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "wildcard-star-disallow": {
      status: "na",
      score: 0,
      message:
        "robots.txt blanket-blocks AI crawlers, so individual low-value paths are already excluded.",
      found:
        "Blanket block in robots.txt — see access-crawl-control/no-blanket-block",
      priority: "low",
      details: "{}",
    },
    "both-categories": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "versioned-product-token": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "mixed-case-tokens": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "anthropic-alias-only": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "comments-and-crlf": {
      status: "warn",
      score: 0.5,
      message:
        "Some low-value URL families are still crawlable by AI crawlers: cart/checkout (/checkout).",
      found:
        "Excluded: cart/checkout (/cart); still crawlable: cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "bom-prefixed": {
      status: "warn",
      score: 0.5,
      message:
        "Some low-value URL families are still crawlable by AI crawlers: cart/checkout (/cart).",
      found:
        "Excluded: cart/checkout (/checkout); still crawlable: cart/checkout (/cart)",
      priority: "low",
      details: "{}",
    },
    "crawl-delay-reasonable": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "crawl-delay-excessive": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "grouped-agents": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "sensitive-paths-disallowed": {
      status: "pass",
      score: 1,
      message:
        "Every low-value URL family observed on the site is disallowed for AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found: "Excluded: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "youbot-and-ai2bot-explicit": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
    "youbot-blocked": {
      status: "fail",
      score: 0,
      message:
        "Low-value URL families are crawlable by AI crawlers: cart/checkout (/cart), cart/checkout (/checkout).",
      found:
        "Still crawlable: cart/checkout (/cart), cart/checkout (/checkout)",
      priority: "low",
      details: "{}",
    },
  },
};
