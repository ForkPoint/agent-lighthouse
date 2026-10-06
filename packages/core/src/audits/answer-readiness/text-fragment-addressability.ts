// Graduated from proposal 2026-08-22 (Plan 5, Task 15).
// Evidence dossier: docs/evidence/audits/answer-readiness/text-fragment-addressability.md
//
// Simulates the text-fragment matching algorithm over the parsed DOM: can a
// citing surface build a `#:~:text=` link that lands on this page's answer
// sentence, or does the link silently degrade to page-top?
import type { AnyNode, Element } from "domhandler";
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import { allJsonLdNodes } from "../../parser";
import { notRendered } from "../../dom-visibility";

/** Elements the spec's block-boundary rule treats as block-level. */
const BLOCK_SELECTOR =
  "p,div,li,td,th,h1,h2,h3,h4,h5,h6,section,article,blockquote,dd,dt,figcaption,pre,details,summary,main,aside,header,footer";

/** Characters that survive in the source but not in the matcher's comparison. */
const HAZARDS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /­/, label: "soft hyphen (U+00AD)" },
  { pattern: /[​‌‍]/, label: "zero-width character (U+200B–U+200D)" },
  { pattern: /[‘’“”]/, label: "smart quote" },
];

/** Longest span emitted whole; longer answers use the start,end form. */
const MAX_START_CHARS = 300;
/** Words of same-block context used to disambiguate a repeated span. */
const CONTEXT_WORDS = 5;

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  const clean = normalize(text);
  const match = /^[^.!?]+[.!?]/.exec(clean);
  return (match ? match[0] : clean).trim();
}

/** Percent-encode a fragment term, including the `-` and `,` delimiters. */
function encodeTerm(text: string): string {
  return encodeURIComponent(text).replace(/-/g, "%2D").replace(/,/g, "%2C");
}

interface BlockRun {
  text: string;
  /** False for text inside a subtree the markup keeps from rendering. */
  rendered: boolean;
}

/** Elements whose text is never rendered, so never searched. */
const UNRENDERED = new Set(["script", "style", "noscript", "template", "head"]);

/**
 * The text runs the matcher searches, in document order. The spec assigns
 * each text node its nearest block ancestor and searches the run of text
 * nodes that share one, breaking at every block-level element. So a block
 * that holds a heading and bare text beside it yields two runs, the heading's
 * and the bare text's, and a leaf block yields one. Text in a subtree the
 * markup keeps from rendering is kept apart and marked, because the matcher
 * searches only rendered text.
 */
function blockRuns(page: PageContext): BlockRun[] {
  const $ = page.$;
  const out: BlockRun[] = [];
  let run = "";
  let runRendered = true;
  const flush = () => {
    const text = normalize(run);
    if (text) out.push({ text, rendered: runRendered });
    run = "";
  };
  const walk = (node: AnyNode, rendered: boolean) => {
    if (node.type === "text") {
      if (rendered !== runRendered) {
        flush();
        runRendered = rendered;
      }
      run += (node as { data?: string }).data ?? "";
      return;
    }
    const tag = (node as { tagName?: string }).tagName?.toLowerCase();
    if (!tag || UNRENDERED.has(tag)) return;
    // notRendered walks the ancestors itself. A visibility:visible child of
    // a visibility:hidden block renders, so the parent's state cannot decide.
    const own = !notRendered($, node);
    const block = $(node).is(BLOCK_SELECTOR);
    if (block) flush();
    for (const child of (node as Element).children ?? []) walk(child, own);
    if (block) flush();
  };
  $("body").each((_i, body) => walk(body, true));
  flush();
  return out;
}

/** Fewest words a heading-derived span needs to be an answer rather than a label. */
const MIN_ANSWER_WORDS = 3;
/** Most leaf blocks followed to finish a sentence that markup split. */
const MAX_SENTENCE_BLOCKS = 3;
/** Terminal punctuation that ends a sentence: followed by a space or the end. */
const SENTENCE_END = /[.!?](?=\s|$)/;
/** A block that opens with a capital starts a sentence rather than continuing one. */
const OPENS_SENTENCE = /^\p{Lu}/u;

/**
 * The answer span a heading introduces, or `undefined` when it introduces none.
 *
 * The dossier's span is "the first sentence after each h2/h3". Three things
 * that follow a heading are not one:
 * - another heading — a carousel of category titles is a list of labels;
 * - a call to action or a label under three words — "Shop now" repeated under
 *   every tile is a button, and its repeats are not an ambiguity to report;
 * - a wrapper of leaf blocks that never finishes a sentence — a tile grid's
 *   text is the concatenation of its tiles, and it crosses block boundaries by
 *   construction, not by an author splitting an answer.
 * A wrapper whose leaf blocks finish a sentence within `MAX_SENTENCE_BLOCKS`
 * stays a candidate, because a sentence split across sibling blocks is the
 * failure the spec's block rule describes.
 */
function answerAfter(page: PageContext, heading: Element): string | undefined {
  const $ = page.$;
  const next = $(heading).next();
  if (next.length === 0 || next.is("h1,h2,h3,h4,h5,h6")) return undefined;

  const leaves = (next.find(BLOCK_SELECTOR).toArray() as Element[])
    .filter((el) => $(el).find(BLOCK_SELECTOR).length === 0)
    .filter((el) => !notRendered($, el))
    .map((el) => normalize($(el).text()))
    .filter(Boolean);
  // A hidden wrapper can still hold a visibility:visible leaf, so only a
  // wrapper with no rendered leaf is skipped whole.
  if (leaves.length === 0 && notRendered($, next.get(0)!)) return undefined;

  let span = "";
  if (leaves.length === 0) {
    span = firstSentence(next.text());
  } else {
    let joined = "";
    for (const text of leaves.slice(0, MAX_SENTENCE_BLOCKS)) {
      // An unfinished block followed by one that opens a sentence was a
      // label, such as a card title over its description. The sentence
      // starts at the new block.
      joined =
        joined && !OPENS_SENTENCE.test(text) ? `${joined} ${text}` : text;
      const end = SENTENCE_END.exec(joined);
      if (end) {
        span = joined.slice(0, end.index + 1);
        break;
      }
    }
  }
  return span.split(" ").filter(Boolean).length >= MIN_ANSWER_WORDS
    ? span
    : undefined;
}

interface Candidate {
  /** Where the span came from, for the finding. */
  origin: string;
  text: string;
}

function candidates(page: PageContext): Candidate[] {
  const $ = page.$;
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const add = (origin: string, text: string) => {
    const clean = normalize(text);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({ origin, text: clean });
  };

  $("h2, h3").each((_i, heading) => {
    if (notRendered($, heading)) return;
    const span = answerAfter(page, heading as Element);
    if (span === undefined) return;
    add(
      `first sentence after "${normalize($(heading).text()).slice(0, 60)}"`,
      span,
    );
  });
  $("dd").each((_i, el) => {
    if (notRendered($, el)) return;
    add(
      "definition list answer",
      $(el)
        .text()
        .slice(0, MAX_START_CHARS * 2),
    );
  });

  const documentText = normalize($("body").text());
  for (const node of allJsonLdNodes(page.jsonLd)) {
    const entities = (node as Record<string, unknown>)["mainEntity"];
    for (const entity of Array.isArray(entities)
      ? entities
      : entities
        ? [entities]
        : []) {
      const answer = (entity as Record<string, unknown>)["acceptedAnswer"];
      const text = answer && (answer as Record<string, unknown>)["text"];
      // Only markup that is also on the page can be cited from the page.
      if (typeof text === "string" && documentText.includes(normalize(text))) {
        add("FAQPage answer", text);
      }
    }
  }

  return out;
}

interface Verdict {
  candidate: Candidate;
  addressable: boolean;
  /** Why not, when it is not. */
  reason?: string;
  url?: string;
  hazards: string[];
}

function assess(
  page: PageContext,
  candidate: Candidate,
  blocks: BlockRun[],
): Verdict {
  const hazards = HAZARDS.filter(({ pattern }) =>
    pattern.test(candidate.text),
  ).map((h) => h.label);
  const containing = blocks.filter(
    (block) => block.rendered && block.text.includes(candidate.text),
  );

  if (
    containing.length === 0 &&
    blocks.some(
      (block) => !block.rendered && block.text.includes(candidate.text),
    )
  ) {
    return {
      candidate,
      addressable: false,
      reason:
        "the span sits in a subtree the page does not render (hidden, display:none or a closed dialog), and the matcher searches only rendered text; hidden=until-found or <details> keeps it reachable",
      hazards,
    };
  }

  if (containing.length === 0) {
    return {
      candidate,
      addressable: false,
      reason:
        "the span crosses a block boundary, and the spec requires each term to match inside one block-level element",
      hazards,
    };
  }

  // Every occurrence anywhere in the document, not only in distinct blocks.
  let occurrences = 0;
  for (const block of blocks) {
    if (!block.rendered) continue;
    let from = 0;
    for (;;) {
      const at = block.text.indexOf(candidate.text, from);
      if (at === -1) break;
      occurrences += 1;
      from = at + candidate.text.length;
    }
  }

  const host = containing[0]!;
  const at = host.text.indexOf(candidate.text);
  const before = host.text.slice(0, at).trim();
  const after = host.text.slice(at + candidate.text.length).trim();

  if (occurrences > 1 && !before && !after) {
    return {
      candidate,
      addressable: false,
      reason:
        "the span occurs more than once and its block offers no prefix or suffix to disambiguate it",
      hazards,
    };
  }

  const words = (text: string, fromEnd: boolean) => {
    const parts = text.split(" ").filter(Boolean);
    return (
      fromEnd ? parts.slice(-CONTEXT_WORDS) : parts.slice(0, CONTEXT_WORDS)
    ).join(" ");
  };

  const terms: string[] = [];
  if (occurrences > 1 && before)
    terms.push(`${encodeTerm(words(before, true))}-`);
  if (candidate.text.length > MAX_START_CHARS) {
    terms.push(encodeTerm(words(candidate.text, false)));
    terms.push(encodeTerm(words(candidate.text, true)));
  } else {
    terms.push(encodeTerm(candidate.text));
  }
  if (occurrences > 1 && !before && after)
    terms.push(`-${encodeTerm(words(after, false))}`);

  return {
    candidate,
    addressable: true,
    url: `${page.url}#:~:text=${terms.join(",")}`,
    hazards,
  };
}

const EXPECTED =
  "Every answer span sits inside one block-level element, is unique or disambiguable with same-block context, carries no normalization hazard, and the page does not send Document-Policy: force-load-at-top";

const SAMPLE = `<!-- Keep the answer sentence inside one block element. -->
<h2>What is resoling?</h2>
<p>Resoling replaces the outsole and midsole of a welted boot.</p>

<!-- Not: the sentence is split across two blocks, so no fragment can match it -->
<h2>What is resoling?</h2>
<div><p>Resoling replaces the outsole</p><p>and midsole of a welted boot.</p></div>`;

export class TextFragmentAddressabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/text-fragment-addressability",
    category: "answer-readiness",
    title: "Text-fragment citation addressability",
    failureTitle: "Text-fragment citation addressability",
    description:
      "Determines whether a citing surface can construct a working `#:~:text=` deep link to the page's actual answer sentences. Hard-fails on the documented `Document-Policy: force-load-at-top` opt-out header, then simulates the spec's matching algorithm over the parsed DOM to prove each candidate answer span is (a) contained in a single block-level element, (b) unambiguous or disambiguable with a same-block prefix/suffix, and (c) free of characters that break normalization. Outputs the working fragment URLs as a fix artifact.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier:
      "docs/evidence/audits/answer-readiness/text-fragment-addressability.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Google Search auto-generates text-fragment URLs to land users on the exact featured-snippet text, and the spec requires each of prefix/start/end/suffix to match within a single block-level element. When an answer sentence is fragmented across block boundaries, or the header opt-out is set, the fragment silently fails and the link degrades to page-top. Falsifiable and directly testable: take the citing surface’s own generated URL, load it, and observe whether the browser scrolls and highlights. Two failure classes are binary and deterministic — the opt-out header, and a start string that straddles two blocks.",
      fix: "Remove `force-load-at-top` from the `Document-Policy` response header; it is header-only, so there is nothing to remove in the markup. Keep each answer sentence inside one block-level element rather than splitting it across sibling paragraphs, spans-in-divs or table cells. Strip soft hyphens and zero-width characters from body copy. Where an answer sentence repeats verbatim across the page, give at least one occurrence some same-block context so a citing surface can pin it.",
      code: SAMPLE,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/text-fragment-addressability/",
      tags: ["citation", "text-fragment", "deep-link", "answer-selection"],
    },
  };

  private recommendation() {
    return {
      priority: "medium" as const,
      description: TextFragmentAddressabilityAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        "No pages were scanned, so there is no answer span to address.",
        EXPECTED,
        "No pages scanned",
      );
    }

    const policy = page.fetchResult.headers["document-policy"] ?? "";
    if (/force-load-at-top/i.test(policy)) {
      return this.fail(
        'The response sends Document-Policy: force-load-at-top, which disables text-fragment scrolling for the whole document, so every generated citation link lands at page-top. Document Policy is header-only: a <meta http-equiv="Document-Policy"> is neither a valid way to set it nor a valid place to detect it, so the fix belongs in the server or CDN configuration.',
        EXPECTED,
        `Document-Policy: ${policy}`,
        this.recommendation(),
        page.url,
      );
    }

    const spans = candidates(page);
    if (spans.length === 0) {
      return this.notApplicable(
        "The page carries no h2/h3 answer spans, no definition-list answers and no FAQPage answers, so there is nothing a citing surface would deep-link to.",
        EXPECTED,
        "No candidate answer spans",
      );
    }

    const blocks = blockRuns(page);
    const verdicts = spans.map((span) => assess(page, span, blocks));
    const addressable = verdicts.filter((v) => v.addressable);
    const broken = verdicts.filter((v) => !v.addressable);
    const hazardous = verdicts.filter((v) => v.hazards.length > 0);

    const examples = addressable
      .slice(0, 3)
      .map((v) => v.url!)
      .join(" ");
    const found = `${addressable.length}/${verdicts.length} answer span(s) addressable${examples ? `; e.g. ${examples}` : ""}`;

    if (broken.length > 0) {
      const worst = broken[0]!;
      return this.fail(
        `${broken.length} of ${verdicts.length} answer span(s) cannot be reached by a text fragment, so a citation link degrades to page-top. Example — ${worst.candidate.origin}: ${worst.reason}: "${worst.candidate.text.slice(0, 120)}".`,
        EXPECTED,
        found,
        this.recommendation(),
        page.url,
      );
    }

    if (hazardous.length > 0) {
      const worst = hazardous[0]!;
      return this.warn(
        `${hazardous.length} answer span(s) carry a normalization hazard — ${worst.hazards.join(", ")} — which the matcher compares literally, so a fragment copied from rendered text can miss. Example: "${worst.candidate.text.slice(0, 120)}".`,
        EXPECTED,
        found,
        this.recommendation(),
        page.url,
      );
    }

    return this.pass(
      `All ${verdicts.length} answer span(s) yield a working text fragment.`,
      EXPECTED,
      found,
      page.url,
    );
  }
}
