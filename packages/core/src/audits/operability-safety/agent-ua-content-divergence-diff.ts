import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import {
  AI_CRAWLER_UAS,
  sharedUaProbes,
  sharedControlProbe,
  type UaProbe,
} from "../../gatherers/ua-parity";
import { INSTRUCTION_LEXICON } from "./invisible-instruction-scan";
import { parseHtml, extractJsonLd, getMainContentText } from "../../parser";

/**
 * Word-set overlap below which two variants are no longer the same page.
 *
 * A page rewritten for a crawler shares boilerplate — navigation, footer,
 * headings — so the interesting divergence sits well above zero. 0.85 leaves
 * room for a rotating promo line and still catches a swapped article body.
 */
const SIMILARITY_FLOOR = 0.85;

/** Pages probed per scan. Each costs one baseline plus one request per UA. */
const MAX_URLS = 2;

/** Block classes that are an access decision, not a content difference. */
const ACCESS_DECISIONS = new Set([
  "opaque-403",
  "cf-challenge",
  "pay-per-crawl",
  "anubis-pow",
  "rate-limited",
  "transport-error",
]);

/**
 * Content words, lowercased, with digits and short tokens dropped.
 *
 * Digits go because a cache-varying timestamp or a request id is not a content
 * difference; tokens under three letters go because they are articles and
 * initials, which move with formatting rather than with meaning.
 */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((token) => token.length >= 3),
  );
}

/** Word-set overlap of two texts. Two empty texts count as identical. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** A key-sorted, digit-blind rendering of a value, for comparing two variants. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${key}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return String(value).replace(/\d+/g, "#");
}

/** Every JSON-LD block in a document, order-independent and digit-blind. */
function jsonLdFingerprint(body: string): string {
  return extractJsonLd(parseHtml(body)).map(stable).sort().join("|");
}

/** Words present in one variant and missing from the other, longest first. */
function diffWords(from: Set<string>, to: Set<string>, limit = 8): string[] {
  return [...from]
    .filter((word) => !to.has(word))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
}

/** What the audit concluded about one crawler UA on one URL. */
interface Divergence {
  token: string;
  url: string;
  reason: string;
  similarity: number;
  detail: string;
}

export class AgentUaContentDivergenceDiffAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/agent-ua-content-divergence-diff",
    category: "operability-safety",
    title: "Agent-UA Content Divergence Diff",
    failureTitle: "AI crawlers are served different content from browsers",
    description:
      "Compares the main content, and the JSON-LD, that each AI-crawler User-Agent receives against the same URL fetched as Chrome, and reports where they diverge. An unrecognised control bot is probed too, so bot management is told apart from deliberate agent-specific branching, and a crawler that is simply blocked is reported without lowering the score.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "high",
    dossier:
      "docs/evidence/audits/operability-safety/agent-ua-content-divergence-diff.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "An agent that reads a different page from the one a human sees cannot be checked by the human it answers to. Where the crawler copy is thinner, the answer engine quotes a page the visitor will never find; where it carries text the browser copy does not, the site is speaking to the model privately — which is the delivery mechanism for every instruction-injection attack that does not need a compromise. A JSON-LD block that differs between variants is the same problem in the field a machine trusts most.",
      fix: "Serve one document to every User-Agent. Where a bot-management rule reduces the page for unknown clients, allow the published AI-crawler UAs through it rather than branching on them, and keep the JSON-LD identical across variants. If a crawler should not read the site at all, block it in robots.txt and at the edge rather than serving it a different story.",
      code: `# Branching on the crawler's own name is the defect
if ($http_user_agent ~* "GPTBot|ClaudeBot") {
  rewrite ^ /crawler-copy last;
}

# Serve one document, decide access separately
# robots.txt
User-agent: GPTBot
Disallow: /members/`,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/agent-ua-content-divergence-diff/",
      tags: ["injection-safety", "security", "agent-trust", "cloaking"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const urls = ctx.pages.slice(0, MAX_URLS).map((page) => page.url);
    if (urls.length === 0) {
      return this.notApplicable(
        "No page was fetched, so no UA comparison could be made.",
        "At least one fetched page",
        "None",
      );
    }

    const tokens = AI_CRAWLER_UAS.map((agent) => agent.token);
    const probes = await sharedUaProbes(ctx, urls, tokens);

    const readable = (probe: UaProbe) =>
      probe.baselineStatus >= 200 &&
      probe.baselineStatus < 300 &&
      probe.baselineText.trim() !== "";
    const blocked = probes.filter((probe) =>
      ACCESS_DECISIONS.has(probe.blockClass),
    );
    const comparable = probes.filter(
      (probe) => readable(probe) && !ACCESS_DECISIONS.has(probe.blockClass),
    );

    const blockedNote =
      blocked.length > 0
        ? `access decisions, not counted: ${blocked.map((p) => `${p.token} ${p.blockClass}`).join(", ")}`
        : "";

    if (comparable.length === 0) {
      return this.notApplicable(
        "No crawler UA returned a readable page to compare against the browser response.",
        "A browser response and at least one crawler response to compare",
        blockedNote || "No probe returned a readable page",
      );
    }

    // One control fetch per URL: a site that serves an unknown bot the same
    // reduced page is running bot management, which is not agent branching.
    const controlSimilarity = new Map<string, number>();
    for (const url of new Set(comparable.map((probe) => probe.url))) {
      const baseline =
        comparable.find((probe) => probe.url === url)?.baselineText ?? "";
      const control = await sharedControlProbe(ctx, url);
      if (!control || control.status < 200 || control.status >= 300) {
        controlSimilarity.set(url, 1);
        continue;
      }
      const controlText = getMainContentText(parseHtml(control.body));
      controlSimilarity.set(url, jaccard(words(baseline), words(controlText)));
    }

    const divergences: Divergence[] = [];
    const noise: string[] = [];

    for (const probe of comparable) {
      const baselineWords = words(probe.baselineText);
      const probeWords = words(probe.probeText);
      const similarity = jaccard(baselineWords, probeWords);

      const payload =
        INSTRUCTION_LEXICON.some((re) => re.test(probe.probeText)) &&
        !INSTRUCTION_LEXICON.some((re) => re.test(probe.baselineText));
      if (payload) {
        divergences.push({
          token: probe.token,
          url: probe.url,
          similarity,
          reason: "instruction-shaped text present only in the crawler copy",
          detail: diffWords(probeWords, baselineWords).join(", "),
        });
        continue;
      }

      if (
        jsonLdFingerprint(probe.probeBody) !==
        jsonLdFingerprint(probe.baselineBody)
      ) {
        divergences.push({
          token: probe.token,
          url: probe.url,
          similarity,
          reason: "JSON-LD differs between the browser and crawler copies",
          detail: "structured data is not identical across variants",
        });
        continue;
      }

      if (similarity >= SIMILARITY_FLOOR) continue;

      // The control bot saw the same reduction, so this is bot management
      // reacting to an unknown client, not a rule written for AI crawlers.
      if ((controlSimilarity.get(probe.url) ?? 1) < SIMILARITY_FLOOR) {
        noise.push(probe.token);
        continue;
      }

      divergences.push({
        token: probe.token,
        url: probe.url,
        similarity,
        reason: `main content overlaps the browser copy by ${similarity.toFixed(2)}`,
        detail: `missing from the crawler copy: ${diffWords(baselineWords, probeWords).join(", ")}${
          diffWords(probeWords, baselineWords).length > 0
            ? `; added: ${diffWords(probeWords, baselineWords).join(", ")}`
            : ""
        }`,
      });
    }

    const expected =
      "Every AI-crawler UA served the same main content and JSON-LD as a browser";
    const notes = [
      blockedNote,
      noise.length > 0
        ? `${noise.join(", ")} saw a reduced page the unrecognised control bot saw too — bot management, not UA branching`
        : "",
    ].filter(Boolean);

    if (divergences.length > 0) {
      const worst = divergences.reduce((a, b) =>
        a.similarity <= b.similarity ? a : b,
      );
      const lines = divergences.map(
        (d) => `${d.token} on ${d.url}: ${d.reason} — ${d.detail}`,
      );
      return {
        ...this.fail(
          `${divergences.length} of ${comparable.length} crawler responses differ from the browser response.`,
          expected,
          [...lines, ...notes].join(" | "),
          `Serve one document to every User-Agent; ${worst.token} currently gets a different page.`,
        ),
        details: {
          comparableProbes: comparable.length,
          divergentProbes: divergences.length,
          worstSimilarity: Number(worst.similarity.toFixed(2)),
          divergences: lines.slice(0, 100).map((line) => line.slice(0, 1000)),
          blocked: blocked.map((p) => `${p.token} ${p.blockClass}`),
          botManagement: noise,
        },
      };
    }

    return {
      ...this.pass(
        `All ${comparable.length} crawler responses match the browser response.`,
        expected,
        [
          `${comparable.length} crawler responses match the browser copy`,
          ...notes,
        ].join("; "),
      ),
      details: {
        comparableProbes: comparable.length,
        divergentProbes: 0,
        blocked: blocked.map((p) => `${p.token} ${p.blockClass}`),
        botManagement: noise,
      },
    };
  }
}
