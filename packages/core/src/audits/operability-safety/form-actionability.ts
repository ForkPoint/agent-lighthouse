import type { CheerioAPI } from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

/** Input types that carry no user data and are skipped. */
const SKIP_TYPES = ['hidden', 'submit', 'button', 'reset', 'image'];

/**
 * Identity-field detectors: maps a field signal (type, name, id, label text)
 * to the standard autocomplete token an agent expects to find.
 */
const IDENTITY_FIELDS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /email/i, token: 'email' },
  { pattern: /(^|[^a-z])(tel|phone|mobile)([^a-z]|$)/i, token: 'tel' },
  { pattern: /first.?name|given.?name|fname/i, token: 'given-name' },
  { pattern: /last.?name|family.?name|surname|lname/i, token: 'family-name' },
  { pattern: /(^|[^a-z])(full.?)?name([^a-z]|$)/i, token: 'name' },
  { pattern: /street|address/i, token: 'street-address' },
  { pattern: /city|town/i, token: 'address-level2' },
  { pattern: /zip|postal|postcode/i, token: 'postal-code' },
  { pattern: /country/i, token: 'country-name' },
];

/** Standard HTML autocomplete detail tokens agents can act on. */
const STANDARD_AUTOCOMPLETE_TOKENS = new Set([
  'name',
  'honorific-prefix',
  'given-name',
  'additional-name',
  'family-name',
  'honorific-suffix',
  'nickname',
  'username',
  'new-password',
  'current-password',
  'one-time-code',
  'organization-title',
  'organization',
  'street-address',
  'address-line1',
  'address-line2',
  'address-line3',
  'address-level4',
  'address-level3',
  'address-level2',
  'address-level1',
  'country',
  'country-name',
  'postal-code',
  'cc-name',
  'cc-given-name',
  'cc-additional-name',
  'cc-family-name',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'transaction-currency',
  'transaction-amount',
  'language',
  'bday',
  'bday-day',
  'bday-month',
  'bday-year',
  'sex',
  'url',
  'photo',
  'tel',
  'tel-country-code',
  'tel-national',
  'tel-area-code',
  'tel-local',
  'tel-local-prefix',
  'tel-local-suffix',
  'tel-extension',
  'email',
  'impp',
]);

/** Autocomplete group/section qualifiers that precede the real token. */
const AUTOCOMPLETE_QUALIFIERS = new Set(['shipping', 'billing', 'home', 'work', 'mobile', 'fax', 'pager']);

interface FieldIssue {
  pageUrl: string;
  formIndex: number;
  field: string;
  failedChecks: string[];
}

function expectedAutocompleteToken(
  tag: string,
  type: string,
  name: string,
  id: string,
  labelText: string,
): string | undefined {
  // Input type itself is the strongest signal for email/tel.
  if (tag === 'input' && type === 'email') return 'email';
  if (tag === 'input' && type === 'tel') return 'tel';

  const signal = `${name} ${id} ${labelText}`;
  for (const { pattern, token } of IDENTITY_FIELDS) {
    if (pattern.test(signal)) return token;
  }
  return undefined;
}

function isStandardAutocomplete(value: string): boolean {
  const tokens = value
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0 && !t.startsWith('section-') && !AUTOCOMPLETE_QUALIFIERS.has(t));
  return tokens.length > 0 && STANDARD_AUTOCOMPLETE_TOKENS.has(tokens[tokens.length - 1]);
}

/**
 * Escape only what a quoted attribute value needs. The previous regex also
 * escaped `:` and `]`, which are legal inside quotes — so framework ids
 * (JSF/PrimeFaces `form:email`, ASP.NET WebForms) produced a selector that
 * matched nothing and their correctly labelled fields were reported unlabelled.
 */
function escapeAttrValue(id: string): string {
  return id.replace(/(["\\])/g, '\\$1');
}

/**
 * HTML lets a `<label for>` live anywhere in the document, and layout-driven
 * markup routinely puts it in a sibling grid cell. Both source audits checked
 * this and disagreed on the scope; the document-wide lookup is the one that
 * matches the spec.
 */
function labelFor($: CheerioAPI, id: string | undefined) {
  if (!id) return undefined;
  const label = $(`label[for="${escapeAttrValue(id)}"]`);
  return label.length > 0 ? label.first() : undefined;
}

export class FormActionabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/form-actionability',
    category: 'operability-safety',
    title: 'Form backend actionability',
    failureTitle: 'Form backend actionability',
    description:
      'Autonomous agents fill forms by reading the DOM directly — they cannot see placeholders rendered visually or guess what a custom div-based widget expects. Fields without a native element, a name attribute, an explicit label (label[for], wrapping label, aria-label, or aria-labelledby), or a standard autocomplete attribute for identity data (email, phone, name, address) force agents to guess, producing failed or incorrect submissions. Keep every fillable field a native input/select/textarea with a name, an explicit label and standard autocomplete tokens.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/form-actionability.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'AI agents do not render your page visually. Unlabeled fields, div-based fake inputs, and missing autocomplete attributes mean agents cannot tell which field is the email address or the name, so submissions fail silently or land in the wrong fields — lost leads, broken signups, and abandoned checkouts.',
      fix: 'Use native input/select/textarea elements (never divs with role="textbox" or contenteditable), give every field a name attribute, associate it with a <label for="id">, wrapping <label>, aria-label, or aria-labelledby, and add standard autocomplete tokens (email, tel, name, street-address, postal-code, country-name) to identity fields. A declarative WebMCP form (<form toolname=…>) takes each control name as a property of its generated tool input schema, so a nameless control is not callable.',
      code: `<form action="/api/contact" method="POST">
  <label for="full-name">Full name</label>
  <input id="full-name" name="name" type="text" autocomplete="name" required />

  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email" required />

  <label for="phone">Phone</label>
  <input id="phone" name="phone" type="tel" autocomplete="tel" />

  <button type="submit">Send</button>
</form>`,
      effort: 'easy',
      docsUrl: 'https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill',
      tags: ['forms', 'labels', 'autocomplete', 'agent-fillable', 'webmcp'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalFields = 0;
    let actionableFields = 0;
    const issues: FieldIssue[] = [];

    for (const page of ctx.pages) {
      const $ = page.$;

      $('form').each((formIndex, formEl) => {
        // A `<form toolname=…>` is a declarative WebMCP tool. It is still just
        // a form, and it is evaluated by the same rules as every other form.
        const isWebmcpForm = ($(formEl).attr('toolname') ?? '').trim().length > 0;

        // Flag div-based fake inputs — agents can't type into these.
        $(formEl)
          .find('[role="textbox"], [contenteditable="true"]')
          .filter((_, el) => !['input', 'select', 'textarea'].includes(el.tagName?.toLowerCase() ?? ''))
          .each((_, el) => {
            const name = $(el).attr('name') ?? $(el).attr('id') ?? el.tagName;
            totalFields++;
            issues.push({
              pageUrl: page.url,
              formIndex,
              field: `${el.tagName.toLowerCase()}[name="${name}"]`,
              failedChecks: ['not a native form element (div pretending to be an input)'],
            });
          });

        $(formEl)
          .find('input, select, textarea')
          .each((_, inputEl) => {
            const $input = $(inputEl);
            const tag = inputEl.tagName.toLowerCase();
            const type = ($input.attr('type') ?? (tag === 'input' ? 'text' : tag)).toLowerCase();
            if (SKIP_TYPES.includes(type)) return;

            totalFields++;
            const failedChecks: string[] = [];

            const name = $input.attr('name') ?? '';
            const id = $input.attr('id');

            // Absorbed from 5.22: WebMCP's declarative API takes each control's
            // `name` as the property name in the tool's generated input schema,
            // so a nameless control is no callable parameter at all — and a
            // nameless control is not submitted by a plain form either.
            if (name.trim() === '') {
              failedChecks.push(
                isWebmcpForm
                  ? 'no name attribute (WebMCP tool schema has no property for this field)'
                  : 'no name attribute (the field is not submitted and has no schema property)',
              );
            }

            // Check: explicit label association.
            const forLabel = labelFor($, id);
            const hasForLabel = forLabel !== undefined;
            const hasWrappingLabel = $input.closest('label').length > 0;
            const hasAriaLabel = ($input.attr('aria-label') ?? '').trim().length > 0;
            const hasAriaLabelledby = ($input.attr('aria-labelledby') ?? '').trim().length > 0;
            if (!hasForLabel && !hasWrappingLabel && !hasAriaLabel && !hasAriaLabelledby) {
              failedChecks.push('no explicit label (missing label[for], wrapping label, aria-label, or aria-labelledby)');
            }

            // Check: identity fields need a standard autocomplete token.
            const labelText = forLabel ? forLabel.text().trim() : $input.closest('label').text().trim();
            const expectedToken = expectedAutocompleteToken(tag, type, name, id ?? '', labelText);
            const autocomplete = $input.attr('autocomplete');
            if (expectedToken && (!autocomplete || !isStandardAutocomplete(autocomplete))) {
              failedChecks.push(
                autocomplete
                  ? `non-standard autocomplete="${autocomplete}" (expected token like "${expectedToken}")`
                  : `missing autocomplete (identity field, expected token like "${expectedToken}")`,
              );
            }

            if (failedChecks.length === 0) {
              actionableFields++;
            } else {
              issues.push({
                pageUrl: page.url,
                formIndex,
                field: `${tag}[name="${name || '(unnamed)'}" type="${type}"]`,
                failedChecks,
              });
            }
          });
      });
    }

    if (totalFields === 0) {
      return this.notApplicable(
        'No forms with fillable fields found on scanned pages — nothing to check.',
        'Forms contain native, named, labeled fields with standard autocomplete attributes',
        '0 fillable fields',
      );
    }

    const ratio = actionableFields / totalFields;
    const issueSummary = issues
      .slice(0, 10)
      .map((i) => `form #${i.formIndex} ${i.field}: ${i.failedChecks.join('; ')}`)
      .join(' | ');
    const truncated = issues.length > 10 ? ` (and ${issues.length - 10} more)` : '';
    const foundBase = `${actionableFields}/${totalFields} fields actionable (${Math.round(ratio * 100)}%)`;
    const found = issues.length > 0 ? `${foundBase}. Non-actionable: ${issueSummary}${truncated}` : foundBase;
    const firstIssueUrl = issues[0]?.pageUrl;

    if (ratio >= 0.9) {
      return this.pass(
        `${actionableFields}/${totalFields} form fields are fully actionable for agents (native element, labeled, standard autocomplete).`,
        'At least 90% of form fields are native, named, labeled, and use standard autocomplete',
        found,
        firstIssueUrl,
      );
    }

    if (ratio >= 0.5) {
      return this.warn(
        `${actionableFields}/${totalFields} form fields are fully actionable — agents will struggle with the rest.`,
        'At least 90% of form fields are native, named, labeled, and use standard autocomplete',
        found,
        'high',
        firstIssueUrl,
      );
    }

    return this.fail(
      `Only ${actionableFields}/${totalFields} form fields are actionable — agents cannot reliably fill these forms.`,
      'At least 90% of form fields are native, named, labeled, and use standard autocomplete',
      found,
      'high',
      firstIssueUrl,
    );
  }
}
