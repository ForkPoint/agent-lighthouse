import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { isSafeUrl } from "../../url-utils";
import { extractMarkdownLinks } from "../../parser";
import { sharedProbeUrl } from "../../gatherers/discovery";
function isOk(res: { status: number }): boolean {
  return res.status >= 200 && res.status < 300;
}

export class LlmsTxtLinksValidAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-txt-links-valid",
    category: "machine-discovery",
    title: "llms.txt links are valid",
    failureTitle: "llms.txt links are valid",
    description:
      "Reports whether the links inside a published llms.txt resolve. Link validity is spec-optional and no known consumer enforces it — Chrome Lighthouse, the only shipping checker, fetches no link at all — so this check is reported and never scored.",
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/machine-discovery/llms-txt-links-valid.md",
    requires: ["origin-reachable"],
    defaultPriority: "low",
    guidance: {
      impact:
        "A broken link inside llms.txt points at nothing, the same as a broken link anywhere else. No documented agent consumer reads the file, so the cost is to any human or tool that follows it, not to a measured AI outcome.",
      fix: "Optional. If you publish an llms.txt, check that its links resolve to HTTP 200 and drop the ones that do not.",
      code: "- [Page Name](/correct-path): Description of the page content",
      effort: "easy",
      docsUrl: "https://llmstxt.org/",
      tags: ["llms-txt", "broken-links", "discoverability"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const result = ctx.rootFiles["/llms.txt"];

    if (!result || !isOk(result)) {
      // No file, nothing to validate. This audit measures the links inside a
      // published llms.txt; it is not a second vote on whether the file exists.
      return this.notApplicable(
        "No llms.txt at the site root, so there are no links to validate.",
        "All links return HTTP 200",
        "File not found",
      );
    }

    const links = extractMarkdownLinks(result.body);

    if (links.length === 0) {
      return this.warn(
        "No links found in llms.txt to validate.",
        "All links return HTTP 200",
        "No links found",
        {
          priority: "low",
          description:
            "An llms.txt with no links is an index of nothing. If you publish the file, list your key pages in it.",
          code: `- [Home](/): Main landing page\n- [About](/about/): Company information`,
        },
      );
    }

    // Resolve relative URLs and filter out unsafe ones (SSRF protection)
    const resolved: string[] = [];
    for (const l of links) {
      try {
        const abs = new URL(l.url, ctx.baseUrl).href;
        if (await isSafeUrl(abs)) resolved.push(abs);
      } catch {
        // skip malformed URLs
      }
    }

    const results = await Promise.all(
      resolved.map((url) => sharedProbeUrl(ctx, url)),
    );
    const broken = results
      .filter((r) => !r || r.status !== 200)
      .map((r, i) => ({ url: resolved[i]!, status: r?.status ?? 0 }));

    if (broken.length > 0) {
      const topBroken = broken
        .slice(0, 10)
        .map((r) => `${r.url} (${r.status})`)
        .join(", ");
      const brokenSummary =
        broken.length > 10
          ? `${topBroken} (+${broken.length - 10} more)`
          : topBroken;
      return this.warn(
        `${broken.length}/${links.length} link(s) are broken.`,
        "All links return HTTP 200",
        `Broken: ${brokenSummary}`,
        {
          priority: "low",
          description:
            "Broken links in llms.txt cause AI agents to hit dead ends, wasting their context window and degrading user experience. Fix the URLs to point to valid pages or remove links to pages that no longer exist.",
          code: `- [Page Name](/correct-path): Description of the page`,
        },
      );
    }

    return this.pass(
      `All ${links.length} link(s) return HTTP 200.`,
      "All links return HTTP 200",
      `${links.length}/${links.length} valid`,
    );
  }
}
