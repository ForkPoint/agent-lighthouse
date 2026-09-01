import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import {
  readabilityArticle,
  semanticText,
  densityText,
  READABILITY_CHAR_THRESHOLD,
  type Extracted,
} from "../../gatherers/extraction";
import { shingles, jaccard } from "../../gatherers/text-metrics";
import type { CheerioAPI } from "cheerio";

/** Below this much visible text there is no article for anyone to extract. */
const MIN_VISIBLE_CHARS = 200;

/** Above this pairwise overlap the extractors are reading the same article. */
const AGREEMENT_FLOOR = 0.8;

/** Below this they are reading different documents, not the same one imperfectly. */
const DISAGREEMENT_FLOOR = 0.6;

/** Words shown from the worst pair's symmetric difference. */
const DIFF_WORDS = 12;

/**
 * Every character a reader would see, chrome included.
 *
 * Deliberately not the main-content extractor: the question this gates is
 * whether there is any text on the page for the extractors to disagree about,
 * and asking one of them would decide that question with the tool under test.
 */
function visibleText($: CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript, template").remove();
  return body.text().replace(/\s+/g, " ").trim();
}

/** Words in one extraction and not the other, longest first. */
function difference(a: Set<string>, b: Set<string>): string[] {
  return [...a]
    .filter((word) => !b.has(word))
    .sort((x, y) => y.length - x.length)
    .slice(0, DIFF_WORDS);
}

export class ExtractionDeterminismAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/extraction-determinism",
    category: "content-extraction",
    title: "Extraction determinism (multi-extractor agreement)",
    failureTitle:
      "What an agent reads from this page depends on which extractor it uses",
    description:
      "Runs three independent main-content extractors over the page — `@mozilla/readability`, a semantic-container selector, and a text-density scorer — and compares their output pairwise with five-word shingles. Where they disagree, what an agent quotes from this page is decided by its pipeline rather than by the page.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "high",
    dossier:
      "docs/evidence/audits/content-extraction/extraction-determinism.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "Every agent pipeline strips a page down before a model reads it, and they do not all strip the same way. When the extractors disagree, the same URL yields different answers depending on which tool fetched it — and the page cannot be tested, because there is no single thing it says. When readability declines a page outright, the most widely deployed extractor of the three hands an agent nothing at all.",
      fix: "Put the article in one container — `<main>` or `<article>` — with the chrome outside it, and keep the largest block of prose on the page the one you want quoted. Readability keys on paragraph density and link density, so a body split across many small wrappers, or padded with link-heavy blocks, is what makes the three disagree.",
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/extraction-determinism/",
      tags: ["content", "extraction", "agent-readiness"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        "No page was fetched, so no extraction could be compared.",
        "At least one fetched page",
        "None",
      );
    }

    const html = page.$.html() ?? "";
    const visible = visibleText(page.$);
    if (visible.length < MIN_VISIBLE_CHARS) {
      return this.notApplicable(
        "The page carries too little visible text for any extractor to have an article to find.",
        `At least ${MIN_VISIBLE_CHARS} characters of visible text`,
        `${visible.length} characters`,
      );
    }

    const readability = readabilityArticle(html, page.url);
    const expected = `All three extractors agree above ${AGREEMENT_FLOOR} pairwise`;

    if (!readability) {
      return {
        ...this.fail(
          "Readability declined this page, so the most widely deployed extractor hands an agent nothing.",
          expected,
          "readability declined the document; the page carries visible text a reader can see and an agent cannot.",
          "Put the article in one <main> or <article> container so a paragraph-density extractor can find it.",
          page.url,
        ),
        details: { readability: "declined", visibleChars: visible.length },
      };
    }

    if (readability.text.length < READABILITY_CHAR_THRESHOLD) {
      return {
        ...this.fail(
          `Readability extracted ${readability.text.length} characters, under its own ${READABILITY_CHAR_THRESHOLD}-character threshold.`,
          expected,
          `readability returned ${readability.text.length} characters, below the ${READABILITY_CHAR_THRESHOLD}-character threshold at which it reports a document as readerable.`,
          "Put the article in one container and keep chrome out of it.",
          page.url,
        ),
        details: {
          readabilityChars: readability.text.length,
          visibleChars: visible.length,
        },
      };
    }

    const extractions: Extracted[] = [
      readability,
      semanticText(html),
      densityText(html),
    ];
    const sets = extractions.map((extraction) => shingles(extraction.text));

    let worst = { pair: "", similarity: 1, a: 0, b: 1 };
    for (let i = 0; i < extractions.length; i += 1) {
      for (let j = i + 1; j < extractions.length; j += 1) {
        const similarity = jaccard(
          sets[i] as Set<string>,
          sets[j] as Set<string>,
        );
        if (similarity < worst.similarity) {
          worst = {
            pair: `${extractions[i]?.source} vs ${extractions[j]?.source}`,
            similarity,
            a: i,
            b: j,
          };
        }
      }
    }

    const onlyA = difference(
      sets[worst.a] as Set<string>,
      sets[worst.b] as Set<string>,
    );
    const onlyB = difference(
      sets[worst.b] as Set<string>,
      sets[worst.a] as Set<string>,
    );
    const symmetricDifference = [...onlyA, ...onlyB].slice(0, DIFF_WORDS * 2);

    const found = `Worst pair ${worst.pair} agrees at ${worst.similarity.toFixed(2)}. Only in ${
      extractions[worst.a]?.source
    }: ${onlyA.join(" | ") || "nothing"}. Only in ${extractions[worst.b]?.source}: ${
      onlyB.join(" | ") || "nothing"
    }.`;
    const details = {
      worstPair: worst.pair,
      worstPairSimilarity: Number(worst.similarity.toFixed(3)),
      readabilityChars: readability.text.length,
      symmetricDifference: symmetricDifference.map((word) =>
        word.slice(0, 1000),
      ),
    };

    if (worst.similarity < DISAGREEMENT_FLOOR) {
      return {
        ...this.fail(
          `Two extractors read this page as different articles (${worst.similarity.toFixed(2)} overlap).`,
          expected,
          found,
          "Put the article in one container and keep link-heavy blocks out of it.",
          page.url,
        ),
        displayValue: `${worst.similarity.toFixed(2)} worst-pair agreement`,
        details,
      };
    }

    if (worst.similarity < AGREEMENT_FLOOR) {
      return {
        ...this.warn(
          `The extractors partly disagree about what this page says (${worst.similarity.toFixed(2)} overlap).`,
          expected,
          found,
          "Move chrome out of the main container so every extractor keeps the same text.",
          page.url,
        ),
        displayValue: `${worst.similarity.toFixed(2)} worst-pair agreement`,
        details,
      };
    }

    return {
      ...this.pass(
        `All three extractors read the same article (worst pair ${worst.similarity.toFixed(2)}).`,
        expected,
        found,
        page.url,
      ),
      displayValue: `${worst.similarity.toFixed(2)} worst-pair agreement`,
      details,
    };
  }
}
