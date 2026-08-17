import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { isSafeUrl } from '../../fetcher';
import { extractMarkdownLinks } from '../../parser';

export class NoBrokenAiEndpointsAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.18',
    category: 'technical-readiness',
    title: 'No broken AI endpoints',
    failureTitle: 'No broken AI endpoints',
    description:
      "AI agents follow URLs in your ai-catalog.json, llms.txt, and navigation.json to build a map of your site's AI-consumable resources. Broken links cause agents to lose trust in your manifest files entirely, potentially ignoring all listed endpoints. Fix or remove broken URLs.",
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'high',
    guidance: {
      impact:
        'Broken URLs in your AI manifest files (ai-catalog.json, llms.txt, navigation.json) cause agents to lose trust in your entire manifest. After encountering broken links, AI systems may stop following any of your listed endpoints, effectively making all your AI-facing resources undiscoverable.',
      fix: 'Audit all URLs referenced in your ai-catalog.json, llms.txt, and navigation.json files. Fix or remove any that return 404, 500, or connection errors. Set up monitoring to catch broken endpoints before AI agents do.',
      code: '# Verify your AI endpoint URLs:\ncurl -sI https://yoursite.com/llms.txt | head -1\ncurl -sI https://yoursite.com/.well-known/ai-catalog.json | head -1\ncurl -sI https://yoursite.com/openapi.json | head -1',
      effort: 'easy',
      tags: ['ai-files', 'reliability', 'endpoints'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const page = ctx.pages?.[0];

    // Collect URLs from ai-catalog.json, llms.txt, and navigation.json
    const urlsToCheck = new Set<string>();

    // From ai-catalog.json
    const aiCatalog = ctx.rootFiles['/.well-known/ai-catalog.json'];
    if (aiCatalog && aiCatalog.status === 200 && aiCatalog.body) {
      try {
        const catalog = JSON.parse(aiCatalog.body);
        if (catalog.services && Array.isArray(catalog.services)) {
          for (const service of catalog.services) {
            if (service.url) {
              urlsToCheck.add(
                service.url.startsWith('http') ? service.url : `${ctx.baseUrl}${service.url}`,
              );
            }
          }
        }
      } catch {
        // Invalid JSON — skip
      }
    }

    // From llms.txt — extract URLs.
    // Use the shared Markdown-link parser for list/inline links, then add any
    // remaining loose bare URLs. The old `/https?:\/\/[^\s)>]+/g` regex swept up
    // trailing backticks, brackets, and periods (`https://…SKILL.md\``), which
    // fabricated phantom "broken" endpoints. Strip trailing punctuation so each
    // URL is validated as written; the Set de-dupes by normalized URL.
    const llmsTxt = ctx.rootFiles['/llms.txt'];
    if (llmsTxt && llmsTxt.status === 200 && llmsTxt.body) {
      for (const link of extractMarkdownLinks(llmsTxt.body)) {
        urlsToCheck.add(link.url);
      }
      const matches = llmsTxt.body.match(/https?:\/\/[^\s)\]>`"']+/g);
      if (matches) {
        for (const raw of matches) {
          const url = raw.replace(/[.,;:!?'")\]`>]+$/, '');
          // v8 ignore next — regex `+` guarantees raw is non-empty; stripping
          // trailing punctuation from `http://…` always leaves ≥7 chars
          /* v8 ignore next */
          if (url) urlsToCheck.add(url);
        }
      }
    }

    // From navigation.json
    const navJson = ctx.rootFiles['/navigation.json'];
    if (navJson && navJson.status === 200 && navJson.body) {
      try {
        const nav = JSON.parse(navJson.body);
        const extractUrls = (obj: unknown): void => {
          if (Array.isArray(obj)) {
            for (const item of obj) extractUrls(item);
          } else if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
              if ((key === 'url' || key === 'href') && typeof value === 'string') {
                urlsToCheck.add(value.startsWith('http') ? value : `${ctx.baseUrl}${value}`);
              } else {
                extractUrls(value);
              }
            }
          }
        };
        extractUrls(nav);
      } catch {
        // Invalid JSON — skip
      }
    }

    if (urlsToCheck.size === 0) {
      return this.warn(
        'No AI endpoint URLs found in ai-catalog.json, llms.txt, or navigation.json to validate.',
        'All URLs from AI-related files return 200',
        'No URLs to validate',
        undefined,
        page?.url,
      );
    }

    const broken: Array<{ url: string; status: number }> = [];
    const valid: string[] = [];

    // Filter out unsafe URLs (SSRF protection) and limit count
    const allUrls = Array.from(urlsToCheck).slice(0, 20);
    const urls: string[] = [];
    for (const url of allUrls) {
      if (await isSafeUrl(url)) urls.push(url);
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          let result = await ctx.fetch({ url, method: 'HEAD' });
          if (result.status >= 400) {
            result = await ctx.fetch({ url, method: 'GET' });
          }
          if (result.status >= 400 && (url.includes('/mcp') || url.includes('/api/'))) {
            const postResult = await ctx.fetch({
              url,
              method: 'POST',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                  clientInfo: { name: 'agent-lighthouse', version: '1.0.0' },
                },
              }),
              contentType: 'application/json',
            });
            if (postResult.status >= 200 && postResult.status < 400) {
              result = postResult;
            }
          }
          return { url, status: result.status };
        } catch {
          return { url, status: 0 };
        }
      }),
    );

    for (const result of results) {
      if (result.status >= 200 && result.status < 400) {
        valid.push(result.url);
      } else {
        broken.push(result);
      }
    }

    if (broken.length === 0) {
      return this.pass(
        `All ${valid.length} AI endpoint URL(s) are reachable.`,
        'All URLs from AI-related files return 200',
        `${valid.length} URL(s) checked, all reachable`,
        page?.url,
      );
    }

    const brokenDetails = broken
      .slice(0, 5)
      .map((b) => `${b.url} (${b.status || 'error'})`)
      .join('; ');

    if (broken.length === urls.length) {
      return this.fail(
        `${broken.length} of ${urls.length} AI endpoint URL(s) are broken or unreachable: ${brokenDetails}`,
        'All URLs from AI-related files return 200',
        `Broken: ${broken.length}; Valid: ${valid.length}`,
        {
          priority: 'high',
          description:
            "AI agents follow URLs in your ai-catalog.json, llms.txt, and navigation.json to build a map of your site's AI-consumable resources. Broken links cause agents to lose trust in your manifest files entirely, potentially ignoring all listed endpoints. Fix or remove broken URLs.",
          code: '# Verify all URLs in your AI files:\ncurl -I https://yoursite.com/llms.txt\ncurl -I https://yoursite.com/.well-known/ai-catalog.json',
        },
        page?.url,
      );
    }

    return this.warn(
      `${broken.length} of ${urls.length} AI endpoint URL(s) are broken or unreachable: ${brokenDetails}`,
      'All URLs from AI-related files return 200',
      `Broken: ${broken.length}; Valid: ${valid.length}`,
      {
        priority: 'high',
        description:
          "AI agents follow URLs in your ai-catalog.json, llms.txt, and navigation.json to build a map of your site's AI-consumable resources. Broken links cause agents to lose trust in your manifest files entirely, potentially ignoring all listed endpoints. Fix or remove broken URLs.",
        code: '# Verify all URLs in your AI files:\ncurl -I https://yoursite.com/llms.txt\ncurl -I https://yoursite.com/.well-known/ai-catalog.json',
      },
      page?.url,
    );
  }
}
