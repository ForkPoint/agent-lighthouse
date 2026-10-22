// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit used to
// pass any article page containing `<dfn>`, a `<dl>` with a ≥6-word `<dd>`, or
// a `<strong>`/`<b>` label ending in ':' followed by ≥6 words — and fail
// everything else. The bold-colon branch has no spec, no role mapping and no
// consumer (graded D on its own), and every blog post with
// "<strong>Note:</strong> …" satisfied it, so the audit reduced to "does this
// page contain a bolded label". Its word counting was English-only, so a CJK
// `<dd>` could never reach the threshold; and it inverted the direction it
// meant to reward — a well-written prose glossary FAILED while a spec sheet
// with a bold label passed.
// Evidence dossier: docs/evidence/audits/answer-readiness/direct-definitions.md
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { readerText } from "#core/dom-visibility";
import { inPageChrome } from "#core/page-chrome";
import { weightForGrade } from "#core/scorer";
import type { CheckContext, PageContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/**
 * Per-language lexical patterns.
 *
 * `intent`: the page is answering "what is X?" — a definitional question, a
 * glossary, or a terminology index. `copula`: the page states a definition in
 * prose, which extraction reads perfectly well even though it carries no
 * term/definition role.
 *
 * The explicit `<dfn>` signal needs none of this and works in every
 * language; these tables exist only so the lexical fallbacks are not
 * English-only, which is what the required rework asks for.
 */
interface LanguageRules {
  intent: RegExp;
  copula: RegExp;
}

const LANGUAGES: Record<string, LanguageRules> = {
  en: {
    intent:
      /\bwhat (?:is|are)\b|(?<!\b(?:hi|high|standard|hd|uhd|4k)[- ])\bdefinitions?\b(?![- ](?:hd|uhd|4k)\b)|\bglossary\b|\bterminology\b|\bmeaning of\b/i,
    copula:
      /\b(?:is|are)\s+(?:a|an|the)\b|\brefers? to\b|\bis defined as\b|\bstands for\b/i,
  },
  es: {
    intent:
      /\bqu[ée]\s+(?:es|son)\b|(?<!\b(?:alta|est[áa]ndar)\s)\bdefinici[óo]n\b(?!\s+(?:alta|est[áa]ndar)\b)|\bglosario\b|\bterminolog[íi]a\b/i,
    copula:
      /\b(?:es|son)\s+(?:un|una|unos|unas|el|la|los|las)\b|\bse refiere a\b/i,
  },
  fr: {
    intent:
      /\bqu['’]est-ce\s+qu|(?<!\b(?:haute|standard)\s)\bd[ée]finition\b(?!\s+(?:haute|standard)\b)|\bglossaire\b|\bterminologie\b/i,
    copula: /\b(?:est|sont)\s+(?:un|une|des|le|la|les|l['’])|\bd[ée]signe\b/i,
  },
  de: {
    intent:
      /\bwas\s+(?:ist|sind)\b|(?<!\b(?:hi|high|standard|hd|uhd|4k)[- ])\bdefinition\b(?![- ](?:hd|uhd|4k)\b)|\bglossar\b|\bbegriffe\b/i,
    copula: /\b(?:ist|sind)\s+(?:ein|eine|einer|der|die|das)\b|\bbezeichnet\b/i,
  },
  pt: {
    // No trailing \b after an accented vowel: JS word boundaries are ASCII-only,
    // so /é\b/ never matches. Same reason the Italian rule below ends on [èe].
    intent:
      /\bo\s+que\s+(?:[ée]|s[ãa]o)|(?<!\b(?:alta|padr[ãa]o)\s)\bdefini[çc][ãa]o\b(?!\s+(?:alta|padr[ãa]o)\b)|\bgloss[áa]rio/i,
    copula:
      /\b(?:[ée]|s[ãa]o)\s+(?:um|uma|uns|umas|o|a|os|as)\b|\brefere-se a\b/i,
  },
  it: {
    intent:
      /\b(?:che\s+)?cos['’]?\s*[èe]|(?<!\b(?:alta|standard)\s)\bdefinizione\b(?!\s+(?:alta|standard)\b)|\bglossario\b/i,
    copula:
      /\b(?:[èe]|sono)\s+(?:un|uno|una|il|lo|la|i|gli|le)\b|\bsi riferisce a\b/i,
  },
  nl: {
    intent:
      /\bwat\s+(?:is|zijn)\b|(?<!\b(?:hoge|standaard)\s)\bdefinitie\b|\bwoordenlijst\b|\bbegrippen\b/i,
    copula: /\b(?:is|zijn)\s+(?:een|de|het)\b|\bverwijst naar\b/i,
  },
  ru: {
    intent: /что\s+так(?:ое|ие)|определени|глоссари|терминолог/i,
    copula: /\s—\s|\bэто\b|\bназывается\b/i,
  },
  ja: { intent: /とは|用語集|定義/, copula: /とは|のこと|である|です/ },
  zh: {
    intent: /什[么麼]是|是什[么麼]|术语表|術語表|定[义義]/,
    copula: /是一?[种種个個类類项項]|指的是|即/,
  },
  ko: {
    intent: /무엇|용어집|정의|이란|란\s*\?/,
    copula: /(?:이란|란|은|는).{0,40}(?:이다|입니다|말한다)/,
  },
};

/** The document's primary language subtag, defaulting to English. */
function languageOf(page: PageContext): LanguageRules {
  const lang =
    (page.$("html").attr("lang") ?? "").trim().toLowerCase().split("-")[0] ??
    "";
  return LANGUAGES[lang] ?? LANGUAGES["en"]!;
}

const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Whether text is substantive after the page has shown definitional intent.
 * Length alone cannot distinguish a definition from a product specification.
 *
 * Two measures, because one of them is language-dependent: six whitespace-
 * separated words, OR twenty non-whitespace characters. The second is what
 * makes the check work for CJK, where `split(/\s+/)` reads a whole sentence as
 * a single word — the bug that kept every CJK `<dd>` below the old threshold.
 */
function isSubstantive(text: string): boolean {
  const t = collapse(text);
  if (!t) return false;
  return (
    t.split(/\s+/).filter(Boolean).length >= 6 ||
    t.replace(/\s+/g, "").length >= 20
  );
}

/**
 * The visible text of each matching element in the page's own content.
 * Elements in site chrome or asides are skipped: a footer "Glossary" block or
 * a footer `<dfn>` would otherwise mark every page on the site. Hidden
 * descendants are pruned from each element's text.
 */
function contentTexts(page: PageContext, selector: string): string[] {
  const $ = page.$;
  return $(selector)
    .toArray()
    .filter(
      (el) =>
        !inPageChrome($, el) &&
        $(el).closest('aside, [role="complementary"]').length === 0,
    )
    .map((el) => collapse(readerText($, el)))
    .filter(Boolean);
}

/** Headline text a definitional question would be written into. */
function headingText(page: PageContext): string {
  return collapse(
    [page.$("title").text(), ...contentTexts(page, "h1, h2, h3")].join(" "),
  );
}

/** The opening prose of the page body, where a definition sentence would sit. */
function openingProse(page: PageContext): string {
  const scope = page.$("main").length > 0 ? "main p" : "body p";
  return contentTexts(page, scope).slice(0, 3).join(" ");
}

const Coverage = {
  Markup: "markup",
  Prose: "prose",
  None: "none",
} as const;

type Coverage = (typeof Coverage)[keyof typeof Coverage];

interface Assessed {
  url: string;
  coverage: Coverage;
  /** Human-readable markup signals found on this page. */
  signals: string[];
}

/**
 * Assess one page, or return undefined when it shows no definitional intent.
 *
 * Intent is explicit (`<dfn>`) or lexical. A `<dl>` can hold metadata or product
 * specifications, so its presence cannot establish definitions. Replacing the old
 * `isArticleContentPage` gate with this one is what stops a /contact or
 * /privacy page from being the sole "article" and producing a site-level verdict
 * about definitions.
 */
function assess(page: PageContext): Assessed | undefined {
  const rules = languageOf(page);
  const signals: string[] = [];

  const dfnCount = contentTexts(page, "dfn").length;
  if (dfnCount > 0) signals.push(`<dfn> (${dfnCount})`);

  const substantiveDd = contentTexts(page, "dl dd").filter(
    isSubstantive,
  ).length;
  if (substantiveDd > 0)
    signals.push(`<dl> with substantive definitions (${substantiveDd})`);

  const structuralIntent = dfnCount > 0;
  const lexicalIntent = rules.intent.test(headingText(page));
  if (!structuralIntent && !lexicalIntent) return undefined;

  if (signals.length > 0)
    return { url: page.url, coverage: Coverage.Markup, signals };

  const prose = openingProse(page);
  if (isSubstantive(prose) && rules.copula.test(prose)) {
    return { url: page.url, coverage: Coverage.Prose, signals };
  }
  return { url: page.url, coverage: Coverage.None, signals };
}

const EXPECTED =
  "Pages that define a term pair it with its definition using <dfn> or <dl>/<dt>/<dd>";

const SAMPLE = `<dl>
  <dt><dfn>Unified content preparation</dfn></dt>
  <dd>The process of structuring site content for consumption by both humans
      and AI agents.</dd>
</dl>`;

export class DirectDefinitionsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/direct-definitions",
    category: "answer-readiness",
    title: "Definition markup on definitional pages",
    failureTitle: "Definition markup on definitional pages",
    description:
      "HTML-AAM maps <dfn> and <dt>/<dd> to the term and definition roles, and WHATWG requires the definition to sit alongside the term it defines, so the pairing survives extraction intact. No consumer is documented as acting on that mapping, and prose definitions are read perfectly well, so this is reported as upside on pages that already answer a definitional question — never as a defect.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/audits/answer-readiness/direct-definitions.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    // Never a defect, so never above the actionable items.
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "A term marked with <dfn> or paired in a <dl> carries an explicit term/definition role through the accessibility tree and through extractors that preserve structure. A prose definition carries the same information without the roles — measurably fine for retrieval, and Google states no special markup is needed for generative search — so the upside here is modest and the absence of markup is not a problem to fix.",
      fix: 'On pages that answer "what is X?", wrap the term in <dfn> at its defining instance, or pair terms and definitions in a <dl>/<dt>/<dd>. Keep the definition in the same paragraph or list group as the term, which is what the HTML spec requires for the pairing to be conformant. Note that markdown conversion flattens <dl>, so do not restructure prose that already reads well.',
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-dfn-element",
      tags: ["content-structure", "html", "answer-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const assessed = ctx.pages
      .map(assess)
      .filter((a): a is Assessed => a !== undefined);

    if (assessed.length === 0) {
      return this.notApplicable(
        'No scanned page shows definitional intent — none asks "what is X?", indexes terminology, or marks a term with <dfn> — so there is nothing to pair.',
        EXPECTED,
        "No page with definitional intent",
      );
    }

    const withMarkup = assessed.filter((a) => a.coverage === Coverage.Markup);
    const prose = assessed.filter((a) => a.coverage === Coverage.Prose);
    const coverage = `${withMarkup.length} of ${assessed.length} definitional page(s) use <dfn> or <dl> markup`;

    if (withMarkup.length === assessed.length) {
      const signals = [...new Set(withMarkup.flatMap((a) => a.signals))];
      return this.pass(
        `Every definitional page pairs its terms with definition markup: ${signals.join(", ")}.`,
        EXPECTED,
        `${coverage} — ${signals.join(", ")}`,
        withMarkup[0]!.url,
      );
    }

    // Warn is the strongest verdict this audit can reach. The evidence records
    // no consumer acting on the term/definition roles, markdown pipelines
    // flatten `<dl>` anyway, and Google states no special markup is needed —
    // so failing a page whose definitions are perfectly readable prose would be
    // guidance in the wrong direction, which is what the old audit did.
    const proseNote =
      prose.length > 0
        ? ` ${prose.length} of them state the definition in prose, which extraction reads without difficulty.`
        : "";
    const first = assessed.find((a) => a.coverage !== Coverage.Markup)!;

    return this.warn(
      `${coverage}.${proseNote} Pairing the term with <dfn> or a <dl> adds the term/definition roles HTML-AAM defines; it is an improvement rather than a fix.`,
      EXPECTED,
      `${coverage}${prose.length > 0 ? `, ${prose.length} prose-only` : ""}`,
      CheckPriority.Low,
      first.url,
    );
  }
}
