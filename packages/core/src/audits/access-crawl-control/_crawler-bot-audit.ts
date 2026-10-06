import type { AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import type { CrawlerBot } from "./_robots-txt-helpers";
import {
  parseRobotsFile,
  hasNamedGroup,
  isPathAllowed,
} from "../../gatherers/robots";

/**
 * Base audit class for the per-bot robots.txt permission checks.
 *
 * Scores the access state, not the shape of the file. Under RFC 9309 §2.2.1 a
 * crawler obeys the group that names its product token and falls back to the
 * `*` group only when none does, so an open catch-all grants exactly the
 * access a named group would. The rule used to pass only on a named group and
 * warn at 0.5 on inherited access. No vendor documents a difference, and the
 * fix it prescribed, a named `Allow: /` group, silently drops every catch-all
 * Disallow for that bot. `meta-external-agent` and `anthropic-ai` made the
 * same change first; see "Inherited access passes (2026-10-06)" in each bot's
 * dossier.
 */
export abstract class CrawlerBotAudit extends Audit {
  protected abstract bot: CrawlerBot;

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];
    const { bot } = this;
    const token = bot.botName;
    const expected = `No robots.txt rule that disallows / for ${token}`;

    // Absent artifact, absent verdict. RFC 9309 §2.3.1.3 lets a crawler fetch
    // anything when robots.txt is unavailable, so there is no rule to grade.
    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        `No robots.txt to read, so there are no crawl rules to evaluate for ${bot.displayName}.`,
        expected,
        "No robots.txt found",
      );
    }

    const { groups, sitemaps } = parseRobotsFile(robotsFile.body);

    // A 200 that carries no groups, no sitemaps and no directives is a soft 404
    // — an HTML error page served at /robots.txt — not a permissive rules file.
    if (groups.length === 0 && sitemaps.length === 0) {
      return this.notApplicable(
        `The response at /robots.txt carries no crawl rules, so there is nothing to evaluate for ${bot.displayName}.`,
        expected,
        "robots.txt contains no user-agent groups and no directives",
      );
    }

    const named = hasNamedGroup(groups, token);
    const hasCatchAll = groups.some((group) => group.userAgent.trim() === "*");
    // A usage-control token is read by its operator's other crawlers. No
    // request carries it, so the copy must not say it crawls.
    const tokenNote = bot.controlToken
      ? ` ${bot.displayName} is a usage-control token, not a crawler: no request carries it, and the rule governs how content its operator's crawlers fetch may be used.`
      : "";

    if (isPathAllowed(groups, token, "/")) {
      const [message, found] = named
        ? [
            `${bot.displayName} is allowed by its own robots.txt group.`,
            `User-agent: ${token} group permits /`,
          ]
        : hasCatchAll
          ? [
              `${bot.displayName} is allowed. No group names it, so under RFC 9309 §2.2.1 the catch-all group applies, and it permits /.`,
              "Allowed through the catch-all group",
            ]
          : [
              `${bot.displayName} is allowed. No group in robots.txt applies to it, so nothing restricts it.`,
              `No group applies to ${token}`,
            ];
      return this.pass(`${message}${tokenNote}`, expected, found);
    }

    return this.fail(
      `${bot.displayName} is blocked by robots.txt.${tokenNote}`,
      expected,
      named
        ? `Its own group (User-agent: ${token}) disallows /`
        : `The catch-all group disallows / and no group names ${token}`,
      {
        priority: "high",
        description: `If the block was not intended, remove the Disallow rule that applies to ${token}. A named User-agent: ${token} group with Allow: / also lifts it, but under RFC 9309 §2.2.1 a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line ${token} should still obey.`,
        code: `User-agent: ${token}\nAllow: /`,
      },
    );
  }
}
