import type { AuditMeta, AuditResult } from "../../types";
import type { CheckContext } from "../../check-context";
import type { CrawlerBot } from "./_robots-txt-helpers";
import { CrawlerBotAudit } from "./_crawler-bot-audit";
import {
  parseRobotsFile,
  hasNamedGroup,
  isPathAllowed,
  matchesUserAgent,
} from "../../gatherers/robots";
import { weightForGrade } from "../../scorer";

/** The token this audit scores, spelled as Anthropic documents it. */
const TOKEN = "ClaudeBot";

/**
 * Anthropic tokens that circulate in robots.txt templates but appear in no
 * current Anthropic documentation. Reported, never scored.
 */
const LEGACY_TOKENS = ["anthropic-ai", "Claude-Web"] as const;

/** The remedy for the one state this audit fails. */
const FIX_SNIPPET = `User-agent: ${TOKEN}\nAllow: /`;

export class AnthropicAudit extends CrawlerBotAudit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/anthropic-ai",
    category: "access-crawl-control",
    title: "ClaudeBot crawl access",
    failureTitle: "ClaudeBot disallowed by robots.txt",
    description:
      "ClaudeBot collects web content that may contribute to Anthropic's model training, and Anthropic states its bots honour robots.txt. This check reads the robots.txt rules that actually apply to ClaudeBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access. The legacy `anthropic-ai` and `Claude-Web` tokens are reported when present but never scored, because Anthropic's current crawler documentation names neither.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/anthropic-ai.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Disallowing ClaudeBot keeps the site out of the web content Anthropic collects for potential model training. It is an effective, documented control, so it is only a problem where the block was not intended. It buys back very little traffic either way: Cloudflare Radar measures Anthropic's crawl-to-refer ratio at roughly 50,000:1, so the allow-side case is about corpus inclusion rather than referral visibility.",
      fix: "If the block was not intended, remove the Disallow rule that applies to ClaudeBot, or add a named `User-agent: ClaudeBot` group with `Allow: /` — under RFC 9309 §2.2.1 a named group overrides the catch-all for that crawler. A `User-agent: anthropic-ai` group is not a substitute: Anthropic documents only ClaudeBot, Claude-User and Claude-SearchBot.",
      code: FIX_SNIPPET,
      effort: "trivial",
      tags: ["robots-txt", "anthropic", "crawler-permissions"],
    },
  };

  protected bot: CrawlerBot = {
    botName: TOKEN,
    displayName: TOKEN,
    category: "training",
  };

  /**
   * Scores one live token's access state, not a two-token composite.
   *
   * The shipped rule combined `anthropic-ai` and `ClaudeBot` through
   * `isAnthropicAllowed`, which returns `allowed: a || b` when both are
   * explicit. This dossier's own research grades the legacy token C with
   * "Consumers: none-known" and instructs that its presence be treated as
   * "harmless legacy cruft — never as evidence a site has configured Anthropic
   * access, and never award or deduct points for it". The OR did the opposite
   * in both directions: an allowed `anthropic-ai` group masked a blocked
   * ClaudeBot, and a stale legacy-only `Disallow: /` failed a site ClaudeBot
   * crawls freely. Only ClaudeBot decides the status now; a legacy group is
   * appended to `found` as a non-scoring note.
   *
   * The pass condition also moved from the shape of the file to the access it
   * grants, following the disposition
   * `access-crawl-control/meta-external-agent` took on the same branch. The
   * inherited rule passed on `allowed && explicitly` and warned at 0.5 on
   * `allowed && !explicitly`, so a site whose robots.txt reads
   * `User-agent: *` / `Allow: /` scored half marks at weight 1.0 for not
   * naming a token. The grade A here rests on Anthropic stating its bots
   * honour robots.txt — a fact about whether a disallow takes effect, not
   * about whether a group names the token — and under RFC 9309 §2.2.1 the
   * catch-all and named cases grant identical access.
   *
   * The override is confined to this class. Twenty sibling bot audits inherit
   * the base rule; changing it there would move every one of them.
   */
  override audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];
    const expected = `robots.txt rules that leave ${TOKEN} able to fetch /`;

    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        `No robots.txt to read, so there are no crawl rules to evaluate for ${TOKEN}.`,
        expected,
        "No robots.txt found",
      );
    }

    const { groups, sitemaps } = parseRobotsFile(robotsFile.body);

    // A 200 that carries no groups, no sitemaps and no directives is a soft 404
    // — an HTML error page served at /robots.txt — not a permissive rules file.
    if (groups.length === 0 && sitemaps.length === 0) {
      return this.notApplicable(
        `The response at /robots.txt carries no crawl rules, so there is nothing to evaluate for ${TOKEN}.`,
        expected,
        "robots.txt contains no user-agent groups and no directives",
      );
    }

    const legacyTokens = LEGACY_TOKENS.filter((token) =>
      groups.some((group) => matchesUserAgent(group.userAgent, token)),
    );
    // Reported, never scored: the note states what the sources establish — that
    // Anthropic documents no consumer for these tokens — and stops there.
    const legacyNote =
      legacyTokens.length === 0
        ? ""
        : ` · legacy ${legacyTokens.join(" / ")} group present — Anthropic's current crawler documentation` +
          " names only ClaudeBot, Claude-User and Claude-SearchBot, so this group is not a documented" +
          " Anthropic access control and does not affect this result.";

    const named = hasNamedGroup(groups, TOKEN);
    const hasCatchAll = groups.some((group) => group.userAgent.trim() === "*");
    const allowed = isPathAllowed(groups, TOKEN, "/");
    const details = {
      namedGroup: named,
      hasCatchAll,
      allowed,
      legacyTokens: [...legacyTokens],
    };

    if (allowed) {
      const [message, found] = named
        ? [
            `${TOKEN} is allowed by its own robots.txt group.`,
            `User-agent: ${TOKEN} group permits /`,
          ]
        : hasCatchAll
          ? [
              `${TOKEN} is allowed. No group names it, so under RFC 9309 §2.2.1 it obeys the catch-all group, which permits /.`,
              "Allowed through the catch-all group",
            ]
          : [
              `${TOKEN} is allowed. No group in robots.txt applies to it, so nothing restricts its crawl.`,
              `No group applies to ${TOKEN}`,
            ];
      return {
        ...this.pass(message, expected, `${found}${legacyNote}`),
        details,
      };
    }

    const found = named
      ? "Its own group disallows /"
      : `The catch-all group disallows / and no group names ${TOKEN}`;

    return {
      ...this.fail(
        `${TOKEN} is disallowed at the site root. Anthropic states its bots honour robots.txt, so the block takes effect: the site is excluded from the web content Anthropic collects for potential model training.`,
        expected,
        `${found}${legacyNote}`,
        { priority: "medium" },
      ),
      details: { ...details, code: FIX_SNIPPET },
    };
  }
}
