import type { AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { CrawlerBot } from './_robots-txt-helpers';
import { parseRobotsTxt, isAllowed, isAnthropicAllowed } from './_robots-txt-helpers';

/**
 * Base audit class for crawler bot permission checks (2.1-2.21).
 * Each bot audit extends this with the appropriate bot configuration.
 */
export abstract class CrawlerBotAudit extends Audit {
  protected abstract bot: CrawlerBot;

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles['/robots.txt'];
    const { bot } = this;

    // If robots.txt is missing or errored, treat as warn
    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.warn(
        `robots.txt not found — ${bot.displayName} is allowed by default but not explicitly.`,
        `Explicit User-agent: ${bot.botName} with Allow: / in robots.txt`,
        'No robots.txt found',
        {
          priority: 'medium',
          description: `Without an explicit robots.txt rule, ${bot.displayName} may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.`,
          code: `User-agent: ${bot.botName}\nAllow: /`,
        },
      );
    }

    const groups = parseRobotsTxt(robotsFile.body);

    // Special handling for anthropic-ai / ClaudeBot (check 2.3)
    const result =
      bot.aliases && bot.aliases.length > 0
        ? isAnthropicAllowed(groups)
        : isAllowed(groups, bot.botName);

    if (result.allowed && result.explicitly) {
      return this.pass(
        `${bot.displayName} is explicitly allowed in robots.txt.`,
        `No Disallow: / for User-agent: ${bot.botName}; explicit Allow: / preferred`,
        `Explicit rules found for ${bot.botName} — access allowed`,
      );
    }

    if (result.allowed && !result.explicitly) {
      return this.warn(
        `${bot.displayName} is allowed by default (no specific rules), but not explicitly allowed.`,
        `No Disallow: / for User-agent: ${bot.botName}; explicit Allow: / preferred`,
        `No explicit rules for ${bot.botName} — allowed via wildcard or default`,
        {
          priority: 'medium',
          description: `${bot.displayName} is currently allowed only through the wildcard rule, which could change if you later add a blanket block. An explicit User-agent entry for ${bot.botName} ensures stable access and signals to the crawler that your site is AI-friendly.`,
          code: `User-agent: ${bot.botName}\nAllow: /`,
        },
      );
    }

    // Blocked
    return this.fail(
      `${bot.displayName} is blocked by robots.txt.`,
      `No Disallow: / for User-agent: ${bot.botName}; explicit Allow: / preferred`,
      `${bot.botName} is disallowed (Disallow: /)`,
      {
        priority: 'high',
        description: `Blocking ${bot.displayName} prevents your content from appearing in AI-powered search results and answers. If you want AI assistants to reference your site, remove the Disallow rule and add an explicit Allow.`,
        code: `User-agent: ${bot.botName}\nAllow: /`,
      },
    );
  }
}
