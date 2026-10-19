import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { weightForGrade } from "#core/scorer";
import { isSafeUrl } from "#core/url-utils";
import { extractMarkdownLinks } from "#core/parser";
import { sharedProbeUrl } from "#core/gatherers/discovery";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { isRootArtifact, rootArtifactMiss } from "#core/gatherers/root-files";
import { LLMS_TXT_NO_EFFECT, LLMS_TXT_NOTICE } from "./_llms-txt-notice";

/**
 * How many links one scan checks. A large llms.txt lists hundreds of pages;
 * fetching all of them is a crawl, and on a protected site the burst itself
 * trips the WAF, so every later request of the scan reads 403. Twenty links
 * spread over the file show whether its links resolve.
 */
const MAX_LINKS = 20;

/** Requests in flight at once against the origin. */
const CONCURRENCY = 4;

/**
 * Answers that say the scanner was refused or got nothing, not that the link
 * is wrong: a login wall, a WAF, a rate limit, or no response at all.
 */
const UNVERIFIABLE = new Set([0, 401, 403, 429]);

/** An even-strided sample, so a long file is checked from start to end. */
function evenSample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const stride = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * stride)]!);
}

/** `probe` over every item, at most `limit` at a time, results in order. */
async function mapLimited<T, R>(
  items: T[],
  limit: number,
  probe: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await probe(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

export class LlmsTxtLinksValidAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/llms-txt-links-valid",
    category: "machine-discovery",
    title: "llms.txt links are valid",
    failureTitle: "llms.txt links are valid",
    description:
      "Reports whether the links inside a published llms.txt resolve. Link validity is spec-optional and no known consumer enforces it — Chrome Lighthouse, the only shipping checker, fetches no link at all — so this check is reported and never scored.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/machine-discovery/llms-txt-links-valid.md",
    deprecated: LLMS_TXT_NOTICE,
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "A broken link inside llms.txt points at nothing, the same as a broken link anywhere else. No documented agent consumer reads the file, so the cost is to any human or tool that follows it, not to a measured AI outcome.",
      fix: "Optional. If you publish an llms.txt, check that its links resolve to HTTP 200 and drop the ones that do not.",
      code: "- [Page Name](/correct-path): Description of the page content",
      effort: FixEffort.Easy,
      docsUrl: "https://llmstxt.org/",
      tags: ["llms-txt", "broken-links", "discoverability"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const result = ctx.rootFiles["/llms.txt"];

    if (!isRootArtifact(result)) {
      // No file, nothing to validate. This audit measures the links inside a
      // published llms.txt; it is not a second vote on whether the file exists.
      return this.notApplicable(
        "No llms.txt at the site root, so there are no links to validate.",
        "All links return HTTP 200",
        rootArtifactMiss(result),
      );
    }

    const links = extractMarkdownLinks(result.body);

    if (links.length === 0) {
      // Reported, not warned: Chrome Lighthouse flags a file with no links,
      // but no AI vendor reads the file.
      return this.pass(
        `No links found in llms.txt to validate; Chrome Lighthouse flags a file with no links. ${LLMS_TXT_NO_EFFECT}`,
        "All links return HTTP 200",
        "No links found",
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

    const checked = evenSample(resolved, MAX_LINKS);
    const results = await mapLimited(checked, CONCURRENCY, async (url) => ({
      url,
      status:
        (await sharedProbeUrl(ctx, url, { followRedirects: true }))?.status ??
        0,
    }));
    const unverifiable = results.filter((r) => UNVERIFIABLE.has(r.status));
    const broken = results.filter(
      (r) => r.status !== 200 && !UNVERIFIABLE.has(r.status),
    );
    const scope =
      checked.length < links.length
        ? `${checked.length} of ${links.length} link(s) checked`
        : `${checked.length} link(s) checked`;
    const unverifiedNote =
      unverifiable.length > 0
        ? `; ${unverifiable.length} could not be verified (${unverifiable
            .slice(0, 5)
            .map((r) => `${r.url} (${r.status})`)
            .join(", ")})`
        : "";

    if (broken.length > 0) {
      const topBroken = broken
        .slice(0, 10)
        .map((r) => `${r.url} (${r.status})`)
        .join(", ");
      const brokenSummary =
        broken.length > 10
          ? `${topBroken} (+${broken.length - 10} more)`
          : topBroken;
      // Named, not warned: a person or a tool the user points at the file
      // would hit these dead ends, but no AI vendor reads the file.
      return this.pass(
        `${broken.length} of ${checked.length} checked link(s) are broken. ${LLMS_TXT_NO_EFFECT}`,
        "All links return HTTP 200",
        `${scope}. Broken: ${brokenSummary}${unverifiedNote}`,
      );
    }

    if (results.length > 0 && unverifiable.length === results.length) {
      return this.notApplicable(
        "No checked link in llms.txt could be verified: each one was refused or went unanswered, which says nothing about the link itself.",
        "All links return HTTP 200",
        `${scope}${unverifiedNote}`,
      );
    }

    const valid = results.length - unverifiable.length;
    return this.pass(
      `${valid} of ${checked.length} checked link(s) return HTTP 200.`,
      "All links return HTTP 200",
      `${scope}; ${valid} valid${unverifiedNote}`,
    );
  }
}
