// Shared survey for the two autofill-token audits. The credential audit
// (form-autofill-token-coverage) and the profile audit
// (profile-autofill-token-coverage) read the same fields and split them by
// token: credential tokens have documented agent consumers, profile tokens
// have only browser autofill. Evidence: the two dossiers under
// docs/evidence/audits/operability-safety/.
import type { Cheerio, CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import type { CheckContext, PageContext } from "#core/check-context";
import { Audit } from "#core/audit";
import type { AuditResult } from "#core/types";
import { CheckPriority } from "#core/types";

/** Which half of the autofill vocabulary an audit judges. */
export const AutofillScope = {
  Credential: "credential",
  Profile: "profile",
} as const;

export type AutofillScope = (typeof AutofillScope)[keyof typeof AutofillScope];

/**
 * Tokens an AI agent is documented to fill through a password manager:
 * Gemini in Chrome with Google Password Manager, Claude with 1Password.
 */
export const CREDENTIAL_TOKENS: ReadonlySet<string> = new Set([
  "username",
  "current-password",
  "new-password",
  "one-time-code",
]);

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

interface FieldReading {
  expected: string | undefined;
  /** "City or postcode": a location query, so no one token is right. */
  locationQuery: boolean;
  /** Undefined when the field is covered. */
  gap?: TokenGap;
  asteriskOnly: boolean;
  unwiredError: boolean;
}

/** What one control declares, before its gap is judged. */
interface RawField {
  reading: FieldReading;
  type: string;
  declared: string | undefined;
  hasIdentifier: boolean;
  labelText: string;
  $el: Cheerio<Element>;
}

/**
 * Tokens accepted on the account identifier of a sign-in or sign-up form. The field is
 * the `username` concept, and an email address used as the login is
 * conventionally marked `type="email" autocomplete="username"`; a site that
 * declares `email` there still names the value a password manager fills.
 */
const IDENTIFIER_TOKENS: ReadonlySet<string> = new Set(["username", "email"]);

/** The gap between what a field declares and what it owes, if any. */
function gapOf(
  field: RawField,
  expected: string,
  accepted: ReadonlySet<string>,
): TokenGap | undefined {
  const typeNeeded = accepted.size > 1 ? undefined : REQUIRED_TYPE[expected];
  const typeOk = !typeNeeded || field.type === typeNeeded;
  const declaredOk =
    field.declared !== undefined && accepted.has(field.declared);
  if (declaredOk && field.hasIdentifier && typeOk) return undefined;
  if (!field.declared) return TokenGap.NoToken;
  if (!declaredOk) return TokenGap.WrongToken;
  if (!field.hasIdentifier) return TokenGap.NoIdentifier;
  return TokenGap.WrongType;
}

/** Every data control of one form, with what it owes and what it declares. */
function readFields(
  $: CheerioAPI,
  $form: Cheerio<Element>,
  pageUrl: string,
  ids: Set<string>,
): FieldReading[] {
  const raw: RawField[] = [];
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
    const expected = inferToken(conceptText($el, labelText), type, pageUrl);

    // Required-ness and error wiring are assessed on every data control, not
    // only the ones carrying an autofill concept.
    const reallyRequired =
      $el.attr("required") !== undefined ||
      ($el.attr("aria-required") ?? "").toLowerCase() === "true";
    const described =
      resolves($el.attr("aria-errormessage"), ids) ||
      resolves($el.attr("aria-describedby"), ids);
    const errorSibling = $el
      .parent()
      .find('[class*="error"], [class*="invalid"], [role="alert"]')
      .first();

    raw.push({
      reading: {
        expected,
        locationQuery: false,
        asteriskOnly: labelText.includes("*") && !reallyRequired,
        unwiredError: errorSibling.length > 0 && !described,
      },
      type,
      declared: bareToken($el.attr("autocomplete")),
      hasIdentifier: Boolean($el.attr("name") || $el.attr("id")),
      labelText,
      $el,
    });
  });

  // On a form with a password and no separate username field (sign-in or
  // sign-up), the first email field is the account identifier: it owes
  // `username` (or `email`) and belongs to the credential audit. A second
  // email field, such as "confirm email", is not another identifier and stays
  // profile data. A signup form that also asks for a username keeps its email
  // as profile data.
  const hasPassword = raw.some((field) => field.type === "password");
  const hasUsernameField = raw.some(
    (field) => field.reading.expected === "username",
  );
  const promoteEmail = hasPassword && !hasUsernameField;
  const identifier = promoteEmail
    ? raw.find((field) => field.reading.expected === "email")
    : undefined;

  return raw.map((field) => {
    const { reading } = field;
    let expected = reading.expected;
    let accepted: ReadonlySet<string> = expected
      ? new Set([expected])
      : new Set();
    if (field === identifier) {
      expected = "username";
      accepted = IDENTIFIER_TOKENS;
      reading.expected = expected;
    }
    if (expected) {
      reading.locationQuery =
        LOCATION_TOKENS.has(expected) &&
        offersAlternatives(field.$el, field.labelText);
      const gap = gapOf(field, expected, accepted);
      if (gap !== undefined) reading.gap = gap;
    }
    return reading;
  });
}

function survey(ctx: CheckContext, scope: AutofillScope): Survey {
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

      const fields = readFields($, $form, page.url, ids);
      // Side findings belong to one audit per form, so the two scopes never
      // count the same asterisk or error element twice.
      const credentialForm = fields.some(
        (field) => field.expected && CREDENTIAL_TOKENS.has(field.expected),
      );
      const ownsForm = (scope === AutofillScope.Credential) === credentialForm;

      for (const field of fields) {
        if (ownsForm) {
          if (field.asteriskOnly) result.asteriskOnly += 1;
          if (field.unwiredError) result.unwiredErrors += 1;
        }
        const expected = field.expected;
        if (!expected || field.locationQuery) continue;
        if (
          CREDENTIAL_TOKENS.has(expected) !==
          (scope === AutofillScope.Credential)
        )
          continue;
        result.autofillable += 1;
        if (field.gap === undefined) {
          result.covered += 1;
          continue;
        }
        result.fieldFindings.push({
          pageUrl: page.url,
          expected,
          reason: field.gap,
        });
        result.firstUncoveredPage ??= page.url;
      }
    });
  }

  return result;
}

/** The shortest actionable sentence for one uncovered field. */
// The switch is exhaustive over TokenGap; tsc (noImplicitReturns) proves every path returns.
// oxlint-disable-next-line typescript/consistent-return
function describeGap(finding: FieldFinding): string {
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

/** What a subclass says, per scope: the field noun and its fix sample. */
interface AutofillCopy {
  /** "autofillable field", "sign-in field". */
  noun: string;
  expected: string;
  sample: string;
  priority: CheckPriority;
}

/**
 * The verdict both autofill audits share. Subclasses pick the scope and the
 * copy; the survey, the side findings and the thresholds are one code path.
 */
export abstract class AutofillTokenAudit extends Audit {
  protected abstract scope: AutofillScope;
  protected abstract copy: AutofillCopy;

  audit(ctx: CheckContext): AuditResult {
    const s = survey(ctx, this.scope);
    const { noun, expected } = this.copy;
    const recommendation = {
      priority: this.copy.priority,
      description: (this.constructor as typeof Audit).meta.description,
      code: this.copy.sample,
    };

    if (s.formsSeen === 0) {
      return this.notApplicable(
        "No <form> on the scanned pages, so there is no field for an agent to populate.",
        expected,
        "No form on the scanned pages",
      );
    }
    if (s.autofillable === 0 && s.asteriskOnly === 0 && s.unwiredErrors === 0) {
      const skipped =
        s.queryForms > 0
          ? `; ${s.queryForms} search or store-locator form(s) skipped`
          : "";
      return this.notApplicable(
        `No field on the scanned forms is a ${noun}.`,
        expected,
        `${s.formsSeen} form(s), no ${noun}${skipped}`,
      );
    }

    const side: string[] = [];
    if (s.asteriskOnly > 0)
      side.push(`${s.asteriskOnly} required by a visual asterisk only`);
    if (s.unwiredErrors > 0)
      side.push(`${s.unwiredErrors} error message not wired to its field`);
    const found = [
      `${s.covered} of ${s.autofillable} ${noun}(s) covered`,
      ...side,
    ].join("; ");

    const worst = s.fieldFindings[0];
    const detail = worst ? ` For example, ${describeGap(worst)}.` : "";
    const sideSentence = side.length
      ? ` Separately: ${s.asteriskOnly > 0 ? `${s.asteriskOnly} field(s) are marked mandatory only by an asterisk in the label, which is invisible to the accessibility tree` : ""}${s.asteriskOnly > 0 && s.unwiredErrors > 0 ? "; " : ""}${s.unwiredErrors > 0 ? `${s.unwiredErrors} field(s) sit next to an error element they do not reference` : ""}.`
      : "";

    if (s.covered === s.autofillable && side.length === 0) {
      return this.pass(
        `All ${s.autofillable} ${noun}(s) declare the matching autocomplete token, a stable name or id, and a consistent type.`,
        expected,
        found,
        ctx.pages[0]?.url,
      );
    }

    if (s.autofillable > 0 && s.covered === 0) {
      return this.fail(
        `None of the ${s.autofillable} ${noun}(s) declare the autocomplete token their concept requires, so an agent must guess which value each field wants.${detail}${sideSentence}`,
        expected,
        found,
        recommendation,
        s.firstUncoveredPage,
      );
    }

    return this.warn(
      `${s.covered} of ${s.autofillable} ${noun}(s) declare the token their concept requires.${detail}${sideSentence}`,
      expected,
      found,
      recommendation,
      s.firstUncoveredPage ?? ctx.pages[0]?.url,
    );
  }
}
