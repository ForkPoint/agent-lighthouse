// Graduated from proposal 2026-08-22 (Plan 5, Task 14).
// Evidence dossier: docs/evidence/audits/answer-readiness/snippet-gate-coverage.md
//
// Reads the snippet permissions a page actually grants — meta robots, per-bot
// meta tags and X-Robots-Tag response headers — and measures them against the
// page's own answer content. Repeated X-Robots-Tag field lines reach this audit
// combined with ", " per RFC 9110 §5.3; see packages/core/src/fetcher.ts.
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { CheckContext, PageContext } from "#core/check-context";
import { allJsonLdNodes } from "#core/parser";
import {
  DOCUMENTED_ROBOTS_NAMES,
  GENERIC_ROBOTS_NAME,
  UNDOCUMENTED_ROBOTS_NAMES,
  parseXRobotsTag,
} from "#core/robots-meta-names";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Above this share of main-content characters, suppression is structural. */
const COVERAGE_FLOOR = 0.2;
/** Directives that remove a page from snippet-bearing surfaces outright. */
const BLOCKING = new Set(["nosnippet", "noindex", "none"]);

interface Directive {
  /** `robots meta`, `googlebot meta`, `X-Robots-Tag`. */
  source: string;
  /** `*` for the generic rule, otherwise the named crawler. */
  bot: string;
  token: string;
  /**
   * False under a name no operator documents reading (`gptbot`,
   * `google-extended`, …): listed in `found`, never evaluated.
   */
  documented: boolean;
}

/**
 * Robots meta tags under a documented name, plus the per-bot names sites use
 * that no operator documents (kept only to be listed as not evaluated).
 */
function parseMeta(page: PageContext): Directive[] {
  const out: Directive[] = [];
  page.$("meta[name]").each((_i, el) => {
    const name = (page.$(el).attr("name") ?? "").toLowerCase().trim();
    const documented = DOCUMENTED_ROBOTS_NAMES.has(name);
    if (!documented && !UNDOCUMENTED_ROBOTS_NAMES.has(name)) return;
    const content = (page.$(el).attr("content") ?? "").toLowerCase();
    for (const token of content.split(",")) {
      const trimmed = token.trim();
      if (trimmed)
        out.push({
          source: `${name} meta`,
          bot: name === GENERIC_ROBOTS_NAME ? "*" : name,
          token: trimmed,
          documented,
        });
    }
  });
  return out;
}

/**
 * The (possibly combined) X-Robots-Tag field value, read by the shared parser:
 * a `bot:` prefix scopes the directives after it until the next prefix, and an
 * unprefixed directive on a later combined line goes to the last named bot.
 * A prefix outside the documented names is listed but never evaluated.
 */
function parseHeader(page: PageContext): Directive[] {
  return parseXRobotsTag(page.fetchResult.headers["x-robots-tag"]).map(
    ({ name, token }) => ({
      source: "X-Robots-Tag",
      bot: name === GENERIC_ROBOTS_NAME ? "*" : name,
      token,
      documented: DOCUMENTED_ROBOTS_NAMES.has(name),
    }),
  );
}

const APPLEBOT = "applebot";
/**
 * What Apple documents as keeping a page out of its AI answers. `nosnippet`:
 * "Apple will not use data tagged nosnippet as additional context and
 * up-to-date content when AI models are used to generate output"; `none`:
 * "Applebot won't index, snippet, or follow links on the page". Apple's
 * `noindex` is documented only as keeping the page out of Spotlight and Siri
 * Suggestions, and Apple does not list `max-snippet`, so neither gates here.
 */
const APPLE_BLOCKING = new Set(["nosnippet", "none"]);

/** The most restrictive snippet permission a named crawler ends up with. */
function resolve(directives: Directive[], bot: string) {
  const mine = directives.filter((d) => d.bot === "*" || d.bot === bot);
  const apple = bot === APPLEBOT;
  const blocking = apple ? APPLE_BLOCKING : BLOCKING;
  let blocked: Directive | undefined;
  let maxSnippet = Number.POSITIVE_INFINITY;
  let maxSnippetSource: Directive | undefined;
  for (const directive of mine) {
    if (blocking.has(directive.token)) blocked ??= directive;
    if (apple) continue;
    const budget = /^max-snippet\s*:\s*(-?\d+)$/.exec(directive.token);
    if (budget) {
      const value = Number(budget[1]);
      const effective = value < 0 ? Number.POSITIVE_INFINITY : value;
      if (effective < maxSnippet) {
        maxSnippet = effective;
        maxSnippetSource = directive;
      }
    }
  }
  return { blocked, maxSnippet, maxSnippetSource };
}

function mainRoot(page: PageContext) {
  const $ = page.$;
  for (const selector of ["main", "article", "body"]) {
    const found = $(selector).first();
    if (found.length > 0) return found;
  }
  return $("body");
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The first sentence of a block, or its opening 300 characters. */
function firstSentence(text: string): string {
  const clean = normalize(text);
  const match = /^[^.!?]+[.!?]/.exec(clean);
  return (match ? match[0] : clean.slice(0, 300)).trim();
}

/** Answer texts declared in FAQPage / HowTo markup. */
function markedUpAnswers(page: PageContext): {
  type?: string;
  answers: string[];
} {
  const answers: string[] = [];
  let type: string | undefined;
  for (const node of allJsonLdNodes(page.jsonLd)) {
    const record = node as Record<string, unknown>;
    const raw = record["@type"];
    const types =
      typeof raw === "string" ? [raw] : Array.isArray(raw) ? raw : [];
    if (types.includes("FAQPage")) type ??= "FAQPage";
    if (types.includes("HowTo")) type ??= "HowTo";
    const entities = record["mainEntity"];
    for (const entity of Array.isArray(entities)
      ? entities
      : entities
        ? [entities]
        : []) {
      const answer = (entity as Record<string, unknown>)["acceptedAnswer"];
      const text = answer && (answer as Record<string, unknown>)["text"];
      if (typeof text === "string" && text.trim())
        answers.push(normalize(text));
    }
  }
  return { ...(type ? { type } : {}), answers };
}

interface Analysis {
  pageUrl: string;
  directives: Directive[];
  /** Directives under an undocumented name: listed, never evaluated. */
  unevaluated: Directive[];
  /** Crawlers whose resolved permission blocks snippets outright. */
  blockedBots: Array<{ bot: string; why: Directive | string }>;
  markupType?: string;
  coverage: number;
  suppressedChars: number;
  mainChars: number;
  /** Answer text a data-nosnippet subtree removes, quoted for the finding. */
  suppressedSpans: string[];
  hasNosnippetSubtree: boolean;
  budget?: { limit: number; source: string; answer: string };
}

function analyse(page: PageContext): Analysis {
  const $ = page.$;
  const all = [...parseMeta(page), ...parseHeader(page)];
  const directives = all.filter((d) => d.documented);
  const bots = new Set<string>(["*", "googlebot", "bingbot"]);
  for (const directive of directives) bots.add(directive.bot);

  const blockedBots: Analysis["blockedBots"] = [];
  for (const bot of bots) {
    const { blocked, maxSnippet, maxSnippetSource } = resolve(directives, bot);
    if (blocked) blockedBots.push({ bot, why: blocked });
    else if (maxSnippet === 0 && maxSnippetSource)
      blockedBots.push({ bot, why: maxSnippetSource });
  }

  const root = mainRoot(page);
  const mainText = normalize(root.text());
  const suppressed = root.find("[data-nosnippet]");
  let suppressedChars = 0;
  const suppressedTexts: string[] = [];
  suppressed.each((_i, el) => {
    // Only outermost subtrees, so a nested marker is not counted twice.
    if ($(el).parents("[data-nosnippet]").length > 0) return;
    const text = normalize($(el).text());
    suppressedChars += text.length;
    if (text) suppressedTexts.push(text);
  });

  const suppressedSpans: string[] = [];
  // The sentence that answers a heading is the span these surfaces quote.
  root.find("h2, h3").each((_i, heading) => {
    const next = $(heading).next();
    if (next.length === 0) return;
    const inside =
      next.is("[data-nosnippet]") ||
      next.parents("[data-nosnippet]").length > 0 ||
      next.find("[data-nosnippet]").length > 0;
    if (inside) suppressedSpans.push(firstSentence(next.text()));
  });
  const markup = markedUpAnswers(page);
  for (const answer of markup.answers) {
    if (suppressedTexts.some((text) => text.includes(answer.slice(0, 60)))) {
      suppressedSpans.push(firstSentence(answer));
    }
  }
  suppressed.filter("table").each((_i, el) => {
    suppressedSpans.push(`table: ${firstSentence($(el).text())}`);
  });

  const analysis: Analysis = {
    pageUrl: page.url,
    directives,
    unevaluated: all.filter((d) => !d.documented),
    blockedBots,
    ...(markup.type ? { markupType: markup.type } : {}),
    coverage: mainText.length === 0 ? 0 : suppressedChars / mainText.length,
    suppressedChars,
    mainChars: mainText.length,
    suppressedSpans,
    hasNosnippetSubtree: suppressed.length > 0,
  };

  // A snippet budget shorter than the answer truncates it below usefulness.
  const { maxSnippet, maxSnippetSource } = resolve(directives, "*");
  if (Number.isFinite(maxSnippet) && maxSnippet > 0) {
    const answer = primaryAnswer(root);
    if (answer && answer.length > maxSnippet) {
      analysis.budget = {
        limit: maxSnippet,
        source: maxSnippetSource!.token,
        answer,
      };
    }
  }

  return analysis;
}

/** The first sentence after the h1, falling back to the first h2. */
function primaryAnswer(root: ReturnType<typeof mainRoot>): string | undefined {
  for (const selector of ["h1", "h2"]) {
    const heading = root.find(selector).first();
    if (heading.length === 0) continue;
    const next = heading.next();
    if (next.length === 0) continue;
    const sentence = firstSentence(next.text());
    if (sentence) return sentence;
  }
  const paragraph = root.find("p").first();
  return paragraph.length > 0 ? firstSentence(paragraph.text()) : undefined;
}

const EXPECTED =
  "No snippet-blocking directive for an AI-relevant crawler, data-nosnippet under 20% of the main content and clear of the answer spans, and a max-snippet budget at least as long as the primary answer";

const SAMPLE = `<!-- Let the answer be quoted. Suppress only what must not be reused. -->
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<h2>What is resoling?</h2>
<p>Resoling replaces the outsole and midsole of a welted boot.</p>
<p data-nosnippet>Prices shown are for logged-in trade accounts only.</p>`;

export class SnippetGateCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/snippet-gate-coverage",
    category: "answer-readiness",
    title: "Snippet-gate coverage analysis",
    failureTitle: "Snippet-gate coverage analysis",
    description:
      "Computes the site's effective snippet permissions per crawler — merging <meta name=\"robots\">, per-bot meta tags, and X-Robots-Tag response headers — then measures those permissions against the page's actual answer content: is max-snippet numerically smaller than the primary answer span, and does data-nosnippet coverage overlap the answer span, the FAQ answers, or the main-content tables. Reports the specific suppressed text, not just the directive.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/answer-readiness/snippet-gate-coverage.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Google states the eligibility gate directly: to appear as a supporting link a page 'must be indexed and eligible to be shown in Google Search with a snippet', and names nosnippet, data-nosnippet, max-snippet and noindex as the controls that limit what AI Overviews and AI Mode can show. This makes the causal chain fully documented rather than inferred: a max-snippet value shorter than the answer sentence truncates the answer below usefulness, and data-nosnippet wrapping the answer removes it from AI surfaces entirely while leaving it visible to humans — an invisible failure that page-level SEO reports do not surface because the directive itself is technically 'valid'.",
      fix: "Drop nosnippet and noindex from any page you want quoted, and set max-snippet:-1 rather than a short numeric budget. Keep data-nosnippet for material that must not be reused — trade pricing, licensed quotations — and off the sentence that answers a heading, the FAQ answers and the main-content tables. Where a per-bot X-Robots-Tag header contradicts the page meta, remove one of them: the most restrictive value wins, so the header silently overrides the markup.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/snippet-gate-coverage/",
      tags: ["snippet", "robots", "ai-overviews", "answer-selection"],
    },
  };

  private recommendation() {
    return {
      priority: CheckPriority.High,
      description: SnippetGateCoverageAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable(
        "No pages were scanned, so there are no snippet permissions to resolve.",
        EXPECTED,
        "No pages scanned",
      );
    }

    const a = analyse(page);
    if (a.mainChars === 0) {
      return this.notApplicable(
        "The page carries no main-content text, so there is no answer span for a snippet directive to gate.",
        EXPECTED,
        "No main-content text",
      );
    }

    const directiveList =
      a.directives.length === 0
        ? "no snippet directives"
        : a.directives
            .map(
              (d) =>
                `${d.source}${d.bot === "*" ? "" : ` ${d.bot}`} ${d.token}`,
            )
            .join("; ");
    const unevaluated =
      a.unevaluated.length === 0
        ? ""
        : `; not evaluated, outside the documented robots names: ${a.unevaluated
            .map((d) => `${d.source} ${d.bot} ${d.token}`)
            .join("; ")}`;
    const pct = `${(a.coverage * 100).toFixed(1)}%`;

    const findings: string[] = [];
    if (a.blockedBots.length > 0) {
      const describeWhy = (why: Directive | string) =>
        typeof why === "string" ? why : `${why.source} ${why.token}`;
      const others = a.blockedBots.filter((b) => b.bot !== APPLEBOT);
      const apple = a.blockedBots.find((b) => b.bot === APPLEBOT);
      const sentences: string[] = [];
      if (others.length > 0) {
        const bots = others
          .map((b) => (b.bot === "*" ? "every crawler" : b.bot))
          .join(", ");
        sentences.push(
          `Snippets are blocked for ${bots} by ${describeWhy(others[0]!.why)}, so the page is not eligible to be shown with a snippet.`,
        );
      }
      if (apple) {
        // Apple's own wording, not Google's eligibility language.
        sentences.push(
          `Applebot is told not to snippet the page by ${describeWhy(apple.why)}: Apple documents that it then generates no description or web answer and does not use the content as context for AI-generated output.`,
        );
      }
      // Marking answers up and then forbidding snippets is one mistake, not two.
      const markupClause = a.markupType
        ? ` The page also publishes ${a.markupType} markup, so it is marked up to be quoted and forbidden from being quoted in the same response.`
        : "";
      findings.push(`${sentences.join(" ")}${markupClause}`);
    }
    if (a.coverage > COVERAGE_FLOOR) {
      findings.push(
        `data-nosnippet covers ${pct} of the main content (${a.suppressedChars} of ${a.mainChars} characters), over the 20% floor.`,
      );
    }
    if (a.suppressedSpans.length > 0) {
      findings.push(
        `data-nosnippet removes ${a.suppressedSpans.length} answer span(s) from every snippet surface, including: "${a.suppressedSpans[0]}".`,
      );
    }
    if (a.budget) {
      findings.push(
        `${a.budget.source} truncates the primary answer at ${a.budget.limit} of ${a.budget.answer.length} characters: "${a.budget.answer.slice(0, a.budget.limit)}…".`,
      );
    }

    const found = `${findings.length} snippet finding(s); ${directiveList}${unevaluated}; data-nosnippet ${pct} of main content`;

    if (findings.length > 0) {
      return this.fail(
        findings.join(" "),
        EXPECTED,
        found,
        this.recommendation(),
        a.pageUrl,
      );
    }

    if (a.hasNosnippetSubtree) {
      return this.warn(
        `data-nosnippet covers ${pct} of the main content and misses the answer spans, but every marked subtree is invisible to AI surfaces — confirm each one is meant to be.`,
        EXPECTED,
        found,
        this.recommendation(),
        a.pageUrl,
      );
    }

    return this.pass(
      "Snippets are permitted for every AI-relevant crawler, and no answer span is suppressed.",
      EXPECTED,
      found,
      a.pageUrl,
    );
  }
}
