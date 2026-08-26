// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit used to
// count any input carrying an `aria-describedby` that resolved, and PASS the
// whole site on the first one — one password-strength hint passed a 200-field
// checkout with no error wiring at all. It also warned at sites doing error
// handling the modern ARIA 1.2 way (`aria-invalid` + `aria-errormessage`) and
// told them to add `aria-describedby`, which is guidance in the wrong
// direction; and it only looked inside `<form>`, so a React fieldset with no
// form wrapper reported "no form inputs".
// Evidence dossier: docs/evidence/audits/operability-safety/form-error-messages.md
//
// Scope note (non-double-counting): `aria-attributes` already validates that an
// `aria-errormessage`/`aria-describedby` that IS present points at a real node
// (the `aria-valid-attr-value` rule), and `label` covers accessible naming.
// This audit measures *coverage* — whether the fields that carry a validation
// constraint are wired to a description at all — which neither of those asks.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';

/** Controls that are never user-entered data, so never carry a message. */
const NON_DATA_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

/**
 * The two populations this audit can actually observe in a served document.
 *
 * `invalid` is the direct measurement the evidence asks for: a field the server
 * rendered in an error state must point at the message explaining it. `required`
 * is the fallback proxy — error markup is normally injected only after a failed
 * submit, so on a plain GET the observable question is whether the fields that
 * *can* fail are pre-wired to a description element.
 */
type Population = 'invalid' | 'required';

interface Field {
  linked: boolean;
  pageUrl: string;
}

interface Survey {
  invalid: Field[];
  required: Field[];
}

/**
 * Every `id` present in the document, as a set.
 *
 * The old code built `[id="${id}"]` selectors out of page content: an id
 * containing `]`, a backslash or a newline produced a malformed selector, so
 * cheerio either threw or silently matched nothing and a valid reference was
 * recorded as a miss. Collecting the ids once and testing membership cannot be
 * broken by the value of an attribute.
 */
function collectIds(page: PageContext): Set<string> {
  const ids = new Set<string>();
  page.$('[id]').each((_, el) => {
    const id = page.$(el).attr('id');
    if (id) ids.add(id);
  });
  return ids;
}

/** True when at least one token of an IDREFS attribute resolves to a real node. */
function resolves(value: string | undefined, ids: Set<string>): boolean {
  if (!value) return false;
  return value.split(/\s+/).some((token) => token && ids.has(token));
}

function survey(ctx: CheckContext): Survey {
  const result: Survey = { invalid: [], required: [] };

  for (const page of ctx.pages) {
    const $ = page.$;
    const ids = collectIds(page);

    // Not scoped to `form input`: modern stacks render fieldsets with no
    // <form> wrapper and submit via JS, and those fields fail validation the
    // same way. The old selector returned "na — no form inputs" for them.
    $('input, select, textarea').each((_, el) => {
      const $el = $(el);
      const type = ($el.attr('type') ?? '').toLowerCase();
      if (NON_DATA_TYPES.has(type)) return;

      // ARIA 1.2 spells the error reference `aria-errormessage`; the older
      // `aria-describedby` is still a valid carrier. Either resolving counts.
      const linked =
        resolves($el.attr('aria-errormessage'), ids) ||
        resolves($el.attr('aria-describedby'), ids);
      const field: Field = { linked, pageUrl: page.url };

      if (($el.attr('aria-invalid') ?? '').toLowerCase() === 'true') {
        result.invalid.push(field);
        return;
      }
      if (
        $el.attr('required') !== undefined ||
        ($el.attr('aria-required') ?? '').toLowerCase() === 'true'
      ) {
        result.required.push(field);
      }
    });
  }

  return result;
}

const EXPECTED =
  'Every field carrying a validation constraint points at its message with aria-errormessage or aria-describedby';

const SAMPLE = `<!-- Pre-wire the reference; render the message when validation fails. -->
<label for="email">Email</label>
<input id="email" type="email" required
       aria-invalid="true"
       aria-errormessage="email-error">
<span id="email-error" role="alert">Enter a valid email address.</span>`;

export class FormErrorMessagesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/form-error-messages',
    category: 'operability-safety',
    title: 'Form fields wired to their validation messages',
    failureTitle: 'Form fields wired to their validation messages',
    description:
      'An agent filling a form reads the accessibility tree, where a message is attached to a field by aria-errormessage or aria-describedby. Fields the server rendered as aria-invalid are checked directly; where a page carries no invalid state — the normal case on a GET, since error markup is injected after a failed submit — the required fields are checked instead, because those are the ones that can fail.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/form-error-messages.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'A field with no aria-errormessage or aria-describedby reference has no message attached to it in the accessibility tree, so an agent that submits a form and gets it back rejected cannot tell which field was wrong or why. It retries the same values or abandons the form.',
      fix: 'Give each required field an aria-errormessage (ARIA 1.2) or aria-describedby pointing at the element that holds its message, and set aria-invalid="true" on the field when validation fails. Keep the referenced element in the DOM so the reference always resolves.',
      code: SAMPLE,
      effort: 'easy',
      docsUrl: 'https://www.w3.org/TR/wai-aria-1.2/#aria-errormessage',
      tags: ['a11y', 'forms', 'aria', 'accessibility'],
    },
  };

  private recommendation() {
    return {
      priority: 'medium' as const,
      description: FormErrorMessagesAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const { invalid, required } = survey(ctx);

    // The invalid-state population is the direct measurement, so it wins
    // whenever the site rendered one. Falling back to `required` only when no
    // invalid state exists keeps the two from being averaged into a ratio that
    // means neither thing.
    const population: Population = invalid.length > 0 ? 'invalid' : 'required';
    const fields = invalid.length > 0 ? invalid : required;

    if (fields.length === 0) {
      return this.notApplicable(
        'No field on the scanned pages declares a validation constraint, so there is no message to link.',
        EXPECTED,
        'No required or invalid-state field on the scanned pages',
      );
    }

    const label = population === 'invalid' ? 'invalid-state field(s)' : 'required field(s)';
    const linked = fields.filter((f) => f.linked).length;
    const found = `${linked} of ${fields.length} ${label} reference a message element`;
    const firstUnlinked = fields.find((f) => !f.linked)?.pageUrl;
    const firstPage = fields[0]!.pageUrl;

    if (linked === fields.length) {
      return this.pass(
        `All ${fields.length} ${label} point at a message element that exists in the document.`,
        EXPECTED,
        found,
        firstPage,
      );
    }

    if (linked === 0) {
      return this.fail(
        `None of the ${fields.length} ${label} carry a resolvable aria-errormessage or aria-describedby, so an agent has no way to read why a submission was rejected.`,
        EXPECTED,
        found,
        this.recommendation(),
        firstUnlinked,
      );
    }

    return this.warn(
      `${linked} of ${fields.length} ${label} point at a message element; the rest carry no resolvable reference.`,
      EXPECTED,
      found,
      this.recommendation(),
      firstUnlinked,
    );
  }
}
