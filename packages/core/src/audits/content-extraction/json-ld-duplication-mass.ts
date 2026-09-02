import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { countTokens } from "../../gatherers/tokens";
import { shingles } from "../../gatherers/text-metrics";
import { allJsonLdNodes } from "../../parser";

/** Strings shorter than this are labels, not bodies of text. */
const BODY_STRING_CHARS = 500;

/** Above this share of a long string's windows also in the DOM, the text is shipped twice. */
const OVERLAP_REPORT_FLOOR = 0.5;

/** Properties that carry prose rather than a name or an identifier. */
const BODY_PROPERTIES = new Set([
  "articlebody",
  "text",
  "description",
  "reviewbody",
  "abstract",
  "transcript",
]);

/** A stable rendering of a node, for spotting the same node declared twice. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${key}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return String(value);
}

/** Long prose strings inside a node, with the property that carried them. */
function bodyStrings(node: object): Array<{ property: string; text: string }> {
  const out: Array<{ property: string; text: string }> = [];
  const walk = (value: unknown, property: string): void => {
    if (typeof value === "string") {
      if (
        value.length >= BODY_STRING_CHARS &&
        BODY_PROPERTIES.has(property.toLowerCase())
      ) {
        out.push({ property, text: value });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, property));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      ))
        walk(child, key);
    }
  };
  walk(node, "");
  return out;
}

export class JsonLdDuplicationMassAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/json-ld-duplication-mass",
    category: "content-extraction",
    title: "JSON-LD duplication mass",
    failureTitle: "Structured data repeats text the page already carries",
    description:
      "Counts what the page's JSON-LD costs in `o200k_base` tokens, finds nodes declared twice across blocks, and measures how much of any long prose property — `articleBody`, `description`, `reviewBody` — repeats text already present in the DOM. Reported, not scored: duplication is a cost an operator may have chosen, and no consumer path proves it changes an answer.",
    scoreDisplayMode: "informative",
    tier: "informative",
    evidenceGrade: "C",
    weight: weightForGrade("C", "informative"),
    defaultPriority: "low",
    dossier:
      "docs/evidence/audits/content-extraction/json-ld-duplication-mass.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "A non-rendering agent tokenizes the whole document, JSON-LD included. Where a block repeats the article body the DOM already carries, the page ships that text twice and the agent pays for both copies out of one context window. The same holds for a node declared identically in two blocks: the second copy adds tokens and no facts.",
      fix: "Keep JSON-LD to the facts a parser needs — identifiers, prices, dates, relationships — and let the prose live in the DOM. Where a schema property genuinely needs body text, a summary is usually enough. Merge blocks that declare the same `@id` into one.",
      effort: "easy",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/json-ld-duplication-mass/",
      tags: ["structured-data", "tokens", "content"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        "No page was fetched, so no structured data could be measured.",
        "At least one fetched page",
        "None",
      );
    }

    const blocks = page
      .$('script[type="application/ld+json"]')
      .toArray()
      .map((el) => page.$(el).html() ?? "")
      .filter((raw) => raw.trim() !== "");

    if (blocks.length === 0) {
      return this.notApplicable(
        "The page carries no JSON-LD.",
        "JSON-LD to measure",
        "No application/ld+json blocks",
      );
    }

    const jsonLdTokens = blocks.reduce((sum, raw) => sum + countTokens(raw), 0);
    const documentTokens = countTokens(page.fetchResult.body ?? "");

    const nodes = allJsonLdNodes(page.jsonLd);
    const seen = new Map<string, number>();
    const duplicateTypes: string[] = [];
    for (const node of nodes) {
      const key = canonical(node);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count === 2) {
        const type = (node as { "@type"?: unknown })["@type"];
        duplicateTypes.push(
          Array.isArray(type) ? String(type[0]) : String(type ?? "node"),
        );
      }
    }
    const duplicateNodes = duplicateTypes.length;

    const domShingles = shingles(page.$("body").text());
    let worstOverlap = 0;
    let worstProperty = "";
    let duplicatedTokens = 0;
    for (const node of nodes) {
      for (const { property, text } of bodyStrings(node)) {
        const own = shingles(text);
        if (own.size === 0) continue;
        const shared = [...own].filter((s) => domShingles.has(s)).length;
        const overlap = shared / own.size;
        if (overlap > worstOverlap) {
          worstOverlap = overlap;
          worstProperty = property;
        }
        if (overlap >= OVERLAP_REPORT_FLOOR)
          duplicatedTokens += Math.round(countTokens(text) * overlap);
      }
    }

    const share = documentTokens === 0 ? 0 : jsonLdTokens / documentTokens;
    const found = `${jsonLdTokens} tokens of this ${documentTokens}-token page are structured data (${(share * 100).toFixed(1)}%); ${duplicatedTokens} of those repeat text already in the DOM${
      worstProperty
        ? ` (worst: ${worstProperty} at ${(worstOverlap * 100).toFixed(0)}% overlap)`
        : ""
    }; ${duplicateNodes} node(s) declared twice${
      duplicateNodes > 0 ? ` (${[...new Set(duplicateTypes)].join(", ")})` : ""
    }.`;
    const details = {
      jsonLdTokens,
      documentTokens,
      jsonLdShare: Number(share.toFixed(4)),
      duplicateNodes,
      duplicatedBodyTokens: duplicatedTokens,
      duplicatedBodyOverlap: Number(worstOverlap.toFixed(3)),
      duplicatedProperty: worstProperty,
      blocks: blocks.length,
    };
    const expected =
      "Structured data carries facts a parser needs, not a second copy of the page text";

    if (duplicatedTokens > 0 || duplicateNodes > 0) {
      return {
        ...this.warn(
          `${duplicatedTokens} tokens of structured data repeat text the page already carries.`,
          expected,
          found,
          "Keep prose in the DOM and JSON-LD to the facts a parser needs; merge blocks that declare the same @id.",
          page.url,
        ),
        displayValue: `${jsonLdTokens} JSON-LD tokens`,
        details,
      };
    }

    return {
      ...this.pass(
        `Structured data costs ${jsonLdTokens} tokens and repeats nothing the DOM already carries.`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${jsonLdTokens} JSON-LD tokens`,
      details,
    };
  }
}
