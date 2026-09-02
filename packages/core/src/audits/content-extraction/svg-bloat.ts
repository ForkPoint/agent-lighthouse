import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { countTokens } from "../../gatherers/tokens";

/**
 * Base64 payloads inlined into the document, wherever they sit.
 *
 * Matched against the raw body rather than against parsed attributes, because a
 * data URI is just as costly inside a `style` attribute, inside a `<style>`
 * block or inside a `srcset` as it is in an `src`, and the raw body catches all
 * of them with one pattern.
 */
const DATA_URI_RE =
  /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{200,}/gi;

/** Below this the payload is a tracking pixel or a tiny mask, not a token problem. */
const DATA_URI_MIN_CHARS = 200;

/** Inlined base64 above this many tokens crowds real content out of the window. */
const DATA_URI_WARN_TOKENS = 1000;

/** Above this, one asset costs more context than most pages carry in prose. */
const DATA_URI_FAIL_TOKENS = 5000;

const FLAG_THRESHOLD_BYTES = 2048;
const SINGLE_FAIL_BYTES = 10240; // 10KB
const TOTAL_FAIL_BYTES = 20480; // 20KB
const TOTAL_WARN_BYTES = 8192; // 8KB
const MARKUP_SNIPPET_CHARS = 120;

interface SvgFinding {
  pageUrl: string;
  bytes: number;
  snippet: string;
}

/** One inlined base64 payload, priced in tokens rather than in bytes. */
interface DataUriFinding {
  pageUrl: string;
  mediaType: string;
  tokens: number;
}

/**
 * Every base64 data URI in one page's raw body, with its token cost.
 *
 * Tokens, not bytes, because that is what the asset actually costs an agent:
 * base64 has no word structure for a BPE tokenizer to compress, so it prices
 * far worse per byte than the prose it is displacing.
 */
function dataUrisOf(body: string, pageUrl: string): DataUriFinding[] {
  const out: DataUriFinding[] = [];
  for (const match of body.matchAll(DATA_URI_RE)) {
    const payload = match[0];
    if (payload.length < DATA_URI_MIN_CHARS) continue;
    out.push({
      pageUrl,
      mediaType: payload.slice(5, payload.indexOf(";")),
      tokens: countTokens(payload),
    });
  }
  return out;
}

/** Token cost of the geometry attributes an SVG carries into an agent's context. */
function svgPathTokens(markup: string): number {
  let total = 0;
  for (const match of markup.matchAll(/\s(?:d|points)="([^"]*)"/gi))
    total += countTokens(match[1] ?? "");
  return total;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`;
}

export class SvgBloatAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/svg-bloat",
    category: "content-extraction",
    title: "SVGs not bloating agent context",
    failureTitle: "Large inline SVGs bloating agent context",
    description:
      'When an LLM converts your HTML to Markdown or reads raw markup, every inline SVG is inlined as thousands of path-data tokens, and every base64 data URI is inlined verbatim. Decorative icon sprites, charts, and complex illustrations can silently consume tens of thousands of tokens of agent context per page — "SVG context poisoning" — crowding out the actual content the agent should read. SVGs marked aria-hidden="true" or role="presentation" are stripped by most accessibility-tree extractors and do not count. Keep visible SVGs small, move decorative ones behind aria-hidden, and prefer raster images or CSS for complex graphics. Inlined base64 assets are priced in real `o200k_base` tokens and reported separately, because their fix differs: move the asset to a real URL with descriptive alt text.',
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/svg-bloat.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Large inline SVGs are inlined verbatim as path-data tokens when an LLM converts your page to Markdown. A single 10KB icon or chart can consume thousands of tokens of agent context per page load, inflating agent cost and pushing real content out of the context window — reducing the quality of what agents extract and say about your site.",
      fix: 'Mark decorative SVGs with aria-hidden="true" so agent pipelines strip them. For visible graphics, simplify path data with SVGO, extract complex SVGs to external files referenced via <img>, or replace them with raster images when they exceed a few kilobytes.',
      code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
      effort: "easy",
      docsUrl: "https://github.com/svg/svgo",
      tags: ["svg", "context-window", "tokens", "performance"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalCount = 0;
    let unhiddenCount = 0;
    let unhiddenBytes = 0;
    let pathTokens = 0;
    const flagged: SvgFinding[] = [];
    const dataUris: DataUriFinding[] = [];

    for (const page of ctx.pages) {
      dataUris.push(...dataUrisOf(page.fetchResult.body ?? "", page.url));
      page.$("svg").each((_, el) => {
        totalCount++;
        const $el = page.$(el);
        if (
          $el.attr("aria-hidden") === "true" ||
          $el.attr("role") === "presentation"
        ) {
          return;
        }
        unhiddenCount++;
        const markup = page.$.html(el) ?? "";
        const bytes = Buffer.byteLength(markup);
        unhiddenBytes += bytes;
        pathTokens += svgPathTokens(markup);
        if (bytes > FLAG_THRESHOLD_BYTES) {
          const oneLine = markup.replace(/\s+/g, " ").trim();
          const snippet =
            oneLine.length > MARKUP_SNIPPET_CHARS
              ? `${oneLine.slice(0, MARKUP_SNIPPET_CHARS)}...`
              : oneLine;
          flagged.push({ pageUrl: page.url, bytes, snippet });
        }
      });
    }

    const dataUriTokens = dataUris.reduce((sum, item) => sum + item.tokens, 0);

    if (totalCount === 0 && dataUris.length === 0) {
      return this.notApplicable(
        "No inline SVG elements and no inlined base64 payloads found on any page.",
        "No oversized unhidden inline SVGs and no inlined base64 assets.",
        "No SVGs or data URIs present",
      );
    }

    // Two buckets, two different fixes: an SVG is optimised or hidden, a data
    // URI is moved to a real URL with alt text. The report keeps them apart.
    const dataUriNote =
      dataUris.length === 0
        ? ""
        : ` ${dataUris.length} inlined base64 payload(s) cost ${dataUriTokens} tokens (largest: ${
            [...dataUris].sort((a, b) => b.tokens - a.tokens)[0]?.mediaType ??
            ""
          }); a real URL plus alt text costs about 15.`;
    const details = {
      svgCount: totalCount,
      unhiddenSvgCount: unhiddenCount,
      unhiddenSvgBytes: unhiddenBytes,
      svgPathTokens: pathTokens,
      dataUriCount: dataUris.length,
      dataUriTokens,
    };

    const summary =
      `${totalCount} SVG(s) total, ${unhiddenCount} unhidden, ` +
      `${formatBytes(unhiddenBytes)} unhidden bytes across ${ctx.pages.length} page(s).${dataUriNote}`;

    if (dataUriTokens >= DATA_URI_FAIL_TOKENS) {
      return {
        ...this.fail(
          `${summary} Inlined base64 assets alone cost ${dataUriTokens} tokens of agent context.`,
          "No inlined base64 asset large enough to displace page content.",
          summary,
          {
            priority: "medium",
            description:
              "Base64 data URIs are inlined verbatim into whatever an agent reads, and base64 tokenizes far worse per byte than prose. Move the asset to a real URL and give it descriptive alt text: a URL plus alt costs about 15 tokens and tells a model strictly more than 4,000 tokens of base64 ever will.",
          },
        ),
        details,
      };
    }

    if (
      flagged.length === 0 &&
      unhiddenBytes <= TOTAL_WARN_BYTES &&
      dataUriTokens < DATA_URI_WARN_TOKENS
    ) {
      return {
        ...this.pass(
          `${summary} All unhidden SVGs are small enough for agent context.`,
          "Unhidden SVGs stay under 2KB each and under 8KB total.",
          `${formatBytes(unhiddenBytes)} of unhidden SVG markup`,
        ),
        details,
      };
    }

    flagged.sort((a, b) => b.bytes - a.bytes);
    const largest = flagged[0];
    const offenders = flagged.length
      ? ` Top offenders:\n${flagged
          .slice(0, 5)
          .map((f) => `${formatBytes(f.bytes)} at ${f.pageUrl}: ${f.snippet}`)
          .join("\n")}`
      : "";
    const found = `${summary}${offenders}`;
    const expected =
      "Unhidden SVGs stay under 2KB each and under 8KB total; nothing over 10KB per SVG or 20KB total.";

    if (
      (largest && largest.bytes > SINGLE_FAIL_BYTES) ||
      unhiddenBytes > TOTAL_FAIL_BYTES
    ) {
      const largestNote = largest
        ? ` — largest unhidden SVG is ${formatBytes(largest.bytes)}`
        : "";
      return {
        ...this.fail(
          `${summary} Severe SVG context bloat detected${largestNote}.`,
          expected,
          found,
          {
            priority: "medium",
            description:
              'Large unhidden inline SVGs are inlined as path-data tokens when an LLM reads your page, consuming thousands of tokens of agent context. Mark decorative SVGs aria-hidden="true", simplify paths with SVGO, or move complex graphics to external files.',
            code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
          },
        ),
        details,
      };
    }

    const warnReason = flagged.length
      ? `${flagged.length} unhidden SVG(s) exceed 2KB and may bloat agent context.`
      : dataUriTokens >= DATA_URI_WARN_TOKENS
        ? `inlined base64 assets cost ${dataUriTokens} tokens of agent context.`
        : `unhidden SVGs total ${formatBytes(unhiddenBytes)}, bloating agent context.`;
    return {
      ...this.warn(`${summary} ${warnReason}`, expected, found, {
        priority: "medium",
        description:
          'Unhidden inline SVGs over 2KB add meaningful token overhead when an LLM converts your page to Markdown. Mark decorative SVGs aria-hidden="true" or optimize them with SVGO to keep agent context focused on real content.',
        code: '<svg aria-hidden="true" focusable="false" ...>...</svg>',
      }),
      details,
    };
  }
}
