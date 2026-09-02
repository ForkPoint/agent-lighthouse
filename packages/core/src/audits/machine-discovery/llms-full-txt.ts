import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import type { FetchResult } from "../../fetcher";

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class LlmsFullTxtAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-full-txt",
    category: "machine-discovery",
    title: "llms-full.txt present",
    failureTitle: "llms-full.txt present",
    description:
      "llms-full.txt provides the complete content of your site in a single file, allowing AI agents to ingest everything in one request instead of crawling page by page.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/machine-discovery/llms-full-txt.md",
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "high",
    guidance: {
      impact:
        "Without llms-full.txt, AI agents must crawl your site page by page, which is slow and often incomplete. This means AI assistants give shallow or outdated answers about your products and services.",
      fix: "Create a /llms-full.txt file at your site root containing the full text content of all important pages in markdown format. Include headings, descriptions, and key details for each page.",
      code: "# Your Site Name\n\n> Full content version for AI agents.\n\n## Home\nYour homepage content here...\n\n## About\nYour about page content here...\n\n## Documentation\nYour documentation content here...",
      effort: "moderate",
      docsUrl: "https://llmstxt.org/",
      tags: ["llms-txt", "discoverability"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles["/llms-full.txt"];

    if (!result || !isOk(result)) {
      return this.fail(
        "No llms-full.txt file found at the site root.",
        "GET /llms-full.txt returns 200",
        result ? `HTTP ${result.status}` : "No response",
        {
          priority: "high",
          description:
            "llms-full.txt provides the complete content of your site in a single file, allowing AI agents to ingest everything in one request instead of crawling page by page. This dramatically improves response quality when users ask about your site.",
          code: `# Your Site Name\n\n> Full content version for AI agents.\n\n## Home\nYour homepage content here...\n\n## About\nYour about page content here...\n\n## Documentation\nYour documentation content here...`,
          docsUrl: "https://llmstxt.org/",
        },
      );
    }

    return this.pass(
      "llms-full.txt exists and returns HTTP 200.",
      "HTTP 200",
      `HTTP ${result.status}`,
    );
  }
}
