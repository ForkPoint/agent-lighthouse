// Graduated from proposal 2026-08-22 (Plan 5, Task 7).
// Evidence dossier: docs/evidence/audits/operability-safety/form-autofill-token-coverage.md
//
// Scope note (non-double-counting): `autocomplete` (the axe autocomplete-valid
// rule) checks that a token which is ALREADY present is spelled legally. It
// cannot fire on absence, and it has no notion of which token a field should
// carry. This audit measures the other half — coverage — by inferring the
// concept from the label, name, placeholder and type, then asking whether the
// field declares the matching token. `label` covers accessible naming and
// `form-error-messages` covers error wiring on constrained fields; the two
// side findings here are narrower (asterisk-only required-ness, and an error
// element sitting next to a field that points at nothing).
import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import { weightForGrade } from "#core/scorer";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { CheckContext, PageContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";

/** Controls that hold no user identity data, so carry no autofill concept. */
const NON_DATA_TYPES = new Set([
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "file",
  "search",
  "checkbox",
  "radio",
  "range",
  "color",
]);

/**
 * Keyword to WHATWG autofill token, most specific first.
 *
 * Order is the whole correctness argument: "first name" must be tested before
 * "name", and "address line 2" before "address", or a field gets the token of
 * a concept it merely contains the words of.
 */
const CONCEPTS: ReadonlyArray<{ token: string; keywords: readonly string[] }> =
  [
    {
      token: "cc-number",
      keywords: ["card number", "cardnumber", "cc-num", "ccnumber", "cardnum"],
    },
    {
      token: "cc-exp",
      keywords: ["expiry", "expiration", "exp date", "cc-exp", "expdate"],
    },
    {
      token: "cc-csc",
      keywords: ["cvv", "cvc", "security code", "card code", "csc"],
    },
    { token: "cc-name", keywords: ["name on card", "cardholder"] },
    {
      token: "one-time-code",
      keywords: ["one-time", "one time code", "otp", "verification code"],
    },
    {
      token: "address-line2",
      keywords: ["address line 2", "address2", "apt", "suite", "unit"],
    },
    {
      token: "address-line1",
      keywords: ["address line 1", "address1", "street address", "street"],
    },
    { token: "postal-code", keywords: ["zip", "postcode", "postal"] },
    { token: "address-level2", keywords: ["city", "town"] },
    {
      token: "address-level1",
      keywords: ["state", "province", "region", "county"],
    },
    { token: "country-name", keywords: ["country"] },
    {
      token: "given-name",
      keywords: ["first name", "firstname", "given name", "forename"],
    },
    {
      token: "family-name",
      keywords: ["last name", "lastname", "surname", "family name"],
    },
    { token: "username", keywords: ["username", "user name", "login"] },
    {
      token: "organization",
      keywords: ["company", "organisation", "organization", "business"],
    },
    {
      token: "bday",
      keywords: ["date of birth", "birthday", "birth date", "dob"],
    },
    { token: "email", keywords: ["e-mail", "email"] },
    { token: "tel", keywords: ["telephone", "phone", "mobile"] },
    { token: "name", keywords: ["full name", "your name"] },
  ];

/** Tokens whose concept also constrains the input type. */
const REQUIRED_TYPE: Record<string, string> = {
  email: "email",
  tel: "tel",
};

/** URL shapes that decide which of the two password tokens applies. */
const SIGNUP_URL = /sign-?up|register|create-account|join/i;
const LOGIN_URL = /log-?in|sign-?in|auth/i;

/**
 * Form names, ids and action paths that mark a site search or a store
 * locator. "stores?" is word-bounded so "/account/restore" is not a locator.
 * "find" is left out on purpose: checkout postcode-lookup forms are often
 * named "find address", and their postcode field does owe its token.
 */
const QUERY_FORM = /search|locator|(?:^|[^a-z])stores?(?:[^a-z]|$)/i;

/** Tokens that name a place; a choice between them is a location query. */
const LOCATION_TOKENS = new Set([
  "postal-code",
  "address-level1",
  "address-level2",
  "country-name",
]);

/** "City or postcode", "Ville ou code postal": a choice, not one concept. */
const ALTERNATIVES = /\s(?:or|ou)\s/;

const TokenGap = {
  NoToken: "no-token",
  WrongToken: "wrong-token",
  NoIdentifier: "no-identifier",
  WrongType: "wrong-type",
} as const;

type TokenGap = (typeof TokenGap)[keyof typeof TokenGap];

interface FieldFinding {
  pageUrl: string;
  expected: string;
  reason: TokenGap;
}

interface Survey {
  formsSeen: number;
  /** Search and store-locator forms, skipped: they take a query, not profile data. */
  queryForms: number;
  autofillable: number;
  covered: number;
  fieldFindings: FieldFinding[];
  asteriskOnly: number;
  unwiredErrors: number;
  firstUncoveredPage?: string;
}

/** The accessible-ish text an autofill concept can be inferred from. */
function conceptText($el: Cheerio<Element>, labelText: string): string {
  return [
    $el.attr("aria-label") ?? "",
    $el.attr("placeholder") ?? "",
    $el.attr("name") ?? "",
    $el.attr("id") ?? "",
    labelText,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Escape an id for use inside an attribute selector.
 *
 * Ids come out of page content: one containing a quote or a backslash produces
 * a malformed selector, which cheerio either throws on or silently fails to
 * match, turning a valid label into a missing one.
 */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

/** The first concept whose keyword appears in the text. */
function conceptOf(text: string): string | undefined {
  return CONCEPTS.find((concept) =>
    concept.keywords.some((k) => text.includes(k)),
  )?.token;
}

/** Which autofill token this field should declare, if any. */
function inferToken(
  text: string,
  type: string,
  pageUrl: string,
): string | undefined {
  if (type === "password") {
    if (SIGNUP_URL.test(pageUrl)) return "new-password";
    if (LOGIN_URL.test(pageUrl)) return "current-password";
    // Ambiguous page: current-password is the conservative default, since a
    // form that is not identifiably a signup is far more often a sign-in.
    return "current-password";
  }
  if (type === "email") return "email";
  if (type === "tel") return "tel";
  return conceptOf(text);
}

/**
 * A site search or a store locator. Its field takes a keyword or a place to
 * look up, not a value from the user's profile, so no autofill token applies.
 */
function isQueryForm(
  $: CheerioAPI,
  $form: Cheerio<Element>,
  pageUrl: string,
): boolean {
  if (($form.attr("role") ?? "").toLowerCase() === "search") return true;
  if ($form.closest('[role="search"], search').length > 0) return true;
  const hasSearchInput = $form
    .find("input")
    .toArray()
    .some((el) => ($(el).attr("type") ?? "").toLowerCase() === "search");
  if (hasSearchInput) return true;
  let path = "";
  const action = $form.attr("action");
  if (action) {
    try {
      path = new URL(action, pageUrl).pathname;
    } catch {
      path = "";
    }
  }
  return QUERY_FORM.test(
    `${path} ${$form.attr("name") ?? ""} ${$form.attr("id") ?? ""}`,
  );
}

/**
 * Whether a visible name offers a choice between different concepts. "City
 * or postcode" does; "State or province" names one concept twice and does
 * not. A side with no known keyword counts as its own concept.
 */
function offersAlternatives($el: Cheerio<Element>, labelText: string): boolean {
  return [
    $el.attr("aria-label") ?? "",
    $el.attr("placeholder") ?? "",
    labelText,
  ]
    .map((name) => name.toLowerCase())
    .some((name) => {
      const parts = name
        .split(ALTERNATIVES)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length < 2) return false;
      const concepts = new Set(
        parts.map((part) => conceptOf(part) ?? `?${part}`),
      );
      return concepts.size > 1;
    });
}

/** The bare token of an autocomplete value, minus any section/billing prefix. */
function bareToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : undefined;
}

function collectIds(page: PageContext): Set<string> {
  const ids = new Set<string>();
  page.$("[id]").each((_, el) => {
    const id = page.$(el).attr("id");
    if (id) ids.add(id);
  });
  return ids;
}

function resolves(value: string | undefined, ids: Set<string>): boolean {
  if (!value) return false;
  return value.split(/\s+/).some((token) => token && ids.has(token));
}

function survey(ctx: CheckContext): Survey {
  const result: Survey = {
    formsSeen: 0,
    queryForms: 0,
    autofillable: 0,
    covered: 0,
    fieldFindings: [],
    asteriskOnly: 0,
    unwiredErrors: 0,
  };

  for (const page of ctx.pages) {
    const $ = page.$;
    const forms = $("form");
    if (forms.length === 0) continue;
    result.formsSeen += forms.length;
    const ids = collectIds(page);

    forms.each((_, form) => {
      const $form = $(form);
      if (isQueryForm($, $form, page.url)) {
        result.queryForms += 1;
        return;
      }

      $form.find("input, select, textarea").each((_, el) => {
        const $el = $(el);
        const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
        const type =
          tag === "input" ? ($el.attr("type") ?? "text").toLowerCase() : tag;
        if (tag === "input" && NON_DATA_TYPES.has(type)) return;

        // A `for`-linked <label> and a wrapping <label> are both names; take both.
        const id = $el.attr("id");
        const labelText =
          (id ? $(`label[for="${cssEscape(id)}"]`).text() : "") +
          " " +
          $el.closest("label").text();
        const expected = inferToken(
          conceptText($el, labelText),
          type,
          page.url,
        );

        // Required-ness and error wiring are assessed on every data control, not
        // only the ones carrying an autofill concept.
        const reallyRequired =
          $el.attr("required") !== undefined ||
          ($el.attr("aria-required") ?? "").toLowerCase() === "true";
        if (labelText.includes("*") && !reallyRequired)
          result.asteriskOnly += 1;

        const described =
          resolves($el.attr("aria-errormessage"), ids) ||
          resolves($el.attr("aria-describedby"), ids);
        const errorSibling = $el
          .parent()
          .find('[class*="error"], [class*="invalid"], [role="alert"]')
          .first();
        if (errorSibling.length > 0 && !described) result.unwiredErrors += 1;

        if (!expected) return;
        // "City or postcode" is a location query: no one token is right.
        if (LOCATION_TOKENS.has(expected) && offersAlternatives($el, labelText))
          return;
        result.autofillable += 1;

        const declared = bareToken($el.attr("autocomplete"));
        const hasIdentifier = Boolean($el.attr("name") || $el.attr("id"));
        const typeNeeded = REQUIRED_TYPE[expected];
        const typeOk = !typeNeeded || type === typeNeeded;

        if (declared === expected && hasIdentifier && typeOk) {
          result.covered += 1;
          return;
        }
        const reason: FieldFinding["reason"] = !declared
          ? TokenGap.NoToken
          : declared !== expected
            ? TokenGap.WrongToken
            : !hasIdentifier
              ? TokenGap.NoIdentifier
              : TokenGap.WrongType;
        result.fieldFindings.push({ pageUrl: page.url, expected, reason });
        result.firstUncoveredPage ??= page.url;
      });
    });
  }

  return result;
}

/** The shortest actionable sentence for one uncovered field. */
function describe(finding: FieldFinding): string {
  const token = `autocomplete="${finding.expected}"`;
  switch (finding.reason) {
    case TokenGap.NoToken:
      return `a field that should declare ${token} declares no autocomplete at all`;
    case TokenGap.WrongToken:
      return `a field that should declare ${token} declares a different token`;
    case TokenGap.NoIdentifier:
      return `a field declaring ${token} carries neither a name nor an id, so it has no stable handle`;
    case TokenGap.WrongType:
      return `a field declaring ${token} does not carry the matching type="${REQUIRED_TYPE[finding.expected]}"`;
  }
}

const EXPECTED =
  "Every form field that maps to a standard autofill concept declares the matching autocomplete token, a stable name or id, and a consistent input type";

const SAMPLE = `<!-- The token is the contract: an agent maps profile data to it by lookup. -->
<label for="email">Email *</label>
<input id="email" name="email" type="email"
       autocomplete="email" required
       aria-invalid="true" aria-describedby="email-error">
<span id="email-error" role="alert">Enter a valid email address.</span>

<label for="zip">ZIP</label>
<input id="zip" name="zip" type="text" autocomplete="postal-code">`;

export class FormAutofillTokenCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/form-autofill-token-coverage",
    category: "operability-safety",
    title: "Form Autofill Token Coverage",
    failureTitle: "Form Autofill Token Coverage",
    description:
      "Per-form score for whether every field an agent must populate carries the machine-readable identity an agent needs: a stable name/id, a correct input type, a WHATWG autocomplete token when the field maps to a standard autofill concept, programmatic constraints, and error wiring via aria-invalid/aria-describedby. Scored as covered-fields / autofillable-fields per form.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/operability-safety/form-autofill-token-coverage.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        'Falsifiable claim: an agent filling a checkout must map each field to a value from user profile data. When the field declares autocomplete="postal-code", that mapping is a table lookup against a ratified vocabulary; when it declares name="field_7" with a visual-only label, the mapping is an inference that fails on ambiguous cases (address-line2 vs address-level2, cc-exp vs bday, tel-national vs tel). WebSuite measures the consequence directly: complex form filling succeeds 12.5% and 0% for the two agents tested, against 85%/76% for simple operational clicks. Test: add correct autocomplete tokens to a failing form and re-run the same fill task.',
      fix: "Give every field that maps to a standard autofill concept its WHATWG token (email, tel, postal-code, address-level1/2, cc-number, one-time-code, new-password on signup, current-password on sign-in), plus a stable name or id and the matching input type. Express required-ness with the required attribute rather than an asterisk in the label, and point each field at its error element with aria-describedby or aria-errormessage.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/form-autofill-token-coverage/",
      tags: [
        "forms",
        "autocomplete",
        "autofill",
        "agent-operability",
        "accessibility",
      ],
    },
  };

  private recommendation() {
    return {
      priority: CheckPriority.High,
      description: FormAutofillTokenCoverageAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const s = survey(ctx);

    if (s.formsSeen === 0) {
      return this.notApplicable(
        "No <form> on the scanned pages, so there is no field for an agent to populate.",
        EXPECTED,
        "No form on the scanned pages",
      );
    }
    if (s.autofillable === 0 && s.asteriskOnly === 0 && s.unwiredErrors === 0) {
      const skipped =
        s.queryForms > 0
          ? `; ${s.queryForms} search or store-locator form(s) skipped`
          : "";
      return this.notApplicable(
        "No field on the scanned forms maps to a standard autofill concept.",
        EXPECTED,
        `${s.formsSeen} form(s), no autofillable field${skipped}`,
      );
    }

    const side: string[] = [];
    if (s.asteriskOnly > 0)
      side.push(`${s.asteriskOnly} required by a visual asterisk only`);
    if (s.unwiredErrors > 0)
      side.push(`${s.unwiredErrors} error message not wired to its field`);
    const found = [
      `${s.covered} of ${s.autofillable} autofillable field(s) covered`,
      ...side,
    ].join("; ");

    const worst = s.fieldFindings[0];
    const detail = worst ? ` For example, ${describe(worst)}.` : "";
    const sideSentence = side.length
      ? ` Separately: ${s.asteriskOnly > 0 ? `${s.asteriskOnly} field(s) are marked mandatory only by an asterisk in the label, which is invisible to the accessibility tree` : ""}${s.asteriskOnly > 0 && s.unwiredErrors > 0 ? "; " : ""}${s.unwiredErrors > 0 ? `${s.unwiredErrors} field(s) sit next to an error element they do not reference` : ""}.`
      : "";

    if (s.covered === s.autofillable && side.length === 0) {
      return this.pass(
        `All ${s.autofillable} autofillable field(s) declare the matching autocomplete token, a stable name or id, and a consistent type.`,
        EXPECTED,
        found,
        ctx.pages[0]?.url,
      );
    }

    if (s.autofillable > 0 && s.covered === 0) {
      return this.fail(
        `None of the ${s.autofillable} autofillable field(s) declare the autocomplete token their concept requires, so an agent must guess which profile value each field wants.${detail}${sideSentence}`,
        EXPECTED,
        found,
        this.recommendation(),
        s.firstUncoveredPage,
      );
    }

    return this.warn(
      `${s.covered} of ${s.autofillable} autofillable field(s) declare the token their concept requires.${detail}${sideSentence}`,
      EXPECTED,
      found,
      this.recommendation(),
      s.firstUncoveredPage ?? ctx.pages[0]?.url,
    );
  }
}
