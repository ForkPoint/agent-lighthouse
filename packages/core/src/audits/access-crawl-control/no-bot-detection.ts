import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

const BOT_DETECTION_PATTERNS: Array<{
  name: string;
  pattern: string;
}> = [
  { name: 'Cloudflare Turnstile', pattern: 'challenges.cloudflare.com' },
  { name: 'DataDome', pattern: 'datadome.co' },
  { name: 'hCaptcha', pattern: 'hcaptcha.com' },
  { name: 'reCAPTCHA', pattern: 'recaptcha' },
];

export class NoBotDetectionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/no-bot-detection',
    category: 'access-crawl-control',
    title: 'No aggressive bot-detection blocking agents',
    failureTitle: 'No aggressive bot-detection blocking agents',
    description:
      'Bot-detection services like Cloudflare Turnstile, DataDome, and reCAPTCHA can block legitimate AI agents from accessing your content. Configure your service to allowlist known AI user-agents.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/access-crawl-control/no-bot-detection.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'Bot-detection services like Cloudflare Turnstile, DataDome, and reCAPTCHA can block legitimate AI agents from accessing your content. When agents are challenged, they cannot complete page fetches, making your content inaccessible to AI-powered search and assistants.',
      fix: 'Configure your bot-detection service to allowlist known AI agent user-agents (GPTBot, ChatGPT-User, Claude-User, PerplexityBot) so they bypass challenges while still protecting against malicious bots.',
      code: '// Allowlist these AI agent user-agents in your WAF/CDN config:\n// GPTBot, ChatGPT-User, OAI-SearchBot (OpenAI)\n// Claude-User, Claude-SearchBot, anthropic-ai (Anthropic)\n// PerplexityBot, Google-Extended, Bravebot, DuckAssistBot',
      effort: 'moderate',
      tags: ['security', 'bot-detection', 'crawler-permissions'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    // A throttled scan proves nothing about who the site admits. HTTP 429 is a
    // statement about this scan's request rate, and failing on it told a
    // storefront that serves GPTBot perfectly well that its firewall blocks AI
    // crawlers.
    if (ctx.wafProtection?.isRateLimit) {
      return this.notApplicable(
        'The scan was rate-limited (HTTP 429), so it never saw enough of the site to judge bot defenses. Re-run the scan after a pause.',
        'No JavaScript-based bot challenges that would block legitimate AI agents',
        'Scan rate-limited',
      );
    }

    // If active WAF protection or aggressive connection dropping was detected
    if (ctx.wafProtection?.isBlocked) {
      return this.fail(
        `Bot-defense firewall detected blocking AI crawler connections: ${ctx.wafProtection.name} (${ctx.wafProtection.reason}).`,
        'No JavaScript-based bot challenges that would block legitimate AI agents',
        `Blocked by ${ctx.wafProtection.name}`,
        {
          priority: 'critical',
          description:
            'A Web Application Firewall (WAF) or bot defense system is actively dropping, resetting, or challenging crawler HTTP connections. Legitimate AI search crawlers (GPTBot, Claude, Perplexity) cannot access or index your store content unless allowlisted.',
          code: '// Example: Allowlist AI crawler user-agents in your WAF settings\n// Akamai / Cloudflare / DataDome WAF Custom Rules:\n// Allow User-Agent matching "GPTBot" OR "ChatGPT-User" OR "Claude-User" OR "PerplexityBot"',
        },
      );
    }

    if (!ctx.pages || ctx.pages.length === 0) {
      return this.warn(
        'No pages were scanned to check for bot-detection scripts.',
        'No JavaScript-based bot challenges that would block legitimate AI agents',
        'No pages scanned',
        {
          priority: 'low',
          description:
            'Aggressive bot-detection scripts can block legitimate AI agents like ChatGPT Browse, Google Mariner, and Claude from accessing your pages. Ensure your security settings allowlist known AI user-agents.',
          code: '// Example: allowlist AI agents in your WAF/CDN config\n// Cloudflare: Security > WAF > Custom Rules\n// Allow User-Agent contains "GPTBot" OR "ChatGPT-User" OR "Claude-User"',
        },
      );
    }

    const detectedServices: Map<string, string[]> = new Map();

    for (const page of ctx.pages) {
      const html = page.fetchResult.body.toLowerCase();

      for (const { name: serviceName, pattern } of BOT_DETECTION_PATTERNS) {
        if (html.includes(pattern.toLowerCase())) {
          if (!detectedServices.has(serviceName)) {
            detectedServices.set(serviceName, []);
          }
          detectedServices.get(serviceName)!.push(page.url);
        }
      }
    }

    if (detectedServices.size === 0) {
      return this.pass(
        'No aggressive bot-detection scripts found on scanned pages.',
        'No JavaScript-based bot challenges that would block legitimate AI agents',
        `Checked ${ctx.pages.length} page(s) — no bot-detection scripts found`,
      );
    }

    const serviceNames = Array.from(detectedServices.keys());
    const details = serviceNames
      .map((s) => `${s} (on ${detectedServices.get(s)!.length} page(s))`)
      .join('; ');

    return this.warn(
      `Bot-detection scripts detected: ${details}. These may block legitimate AI agents like ChatGPT Agent, GoogleAgent-Mariner, and NovaAct.`,
      'No JavaScript-based bot challenges that would block legitimate AI agents',
      `Detected: ${serviceNames.join(', ')}`,
      {
        priority: 'high',
        description:
          'Bot-detection services like Cloudflare Turnstile, DataDome, and reCAPTCHA can block legitimate AI agents from accessing your content. Configure your service to allowlist known AI user-agents so they are not challenged, while still protecting against malicious bots.',
        code: '// Allowlist these AI agent user-agents in your bot-detection config:\n// GPTBot, ChatGPT-User, OAI-SearchBot (OpenAI)\n// Claude-User, Claude-SearchBot, anthropic-ai (Anthropic)\n// PerplexityBot (Perplexity)\n// Google-Extended (Google AI)\n// Bravebot, DuckAssistBot\n//\n// Example Cloudflare WAF rule:\n// IF User-Agent contains "ChatGPT-User" OR "Claude-User"\n// THEN Skip all managed challenges',
      },
    );
  }
}
