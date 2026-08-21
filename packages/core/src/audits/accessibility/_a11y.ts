/**
 * Accessibility audits, backed by our a11y rule engine (see ./engine).
 *
 * Each audit wraps one or more a11y rules (run over jsdom in the
 * orchestrator and cached on each PageContext as `a11yResults`). We only adopt
 * rules that describe how an AI agent reads/acts on a page through the
 * accessibility tree — roles, programmatic names, ARIA relationships, document
 * structure. Human-perception rules (color contrast, focus visibility, target
 * size, reduced motion) are deliberately excluded: a non-human consumer can't
 * perceive them.
 *
 * Aggregation across the scanned pages, per audit:
 *   - any constituent rule FAILS on any page            → fail (with selectors)
 *   - else any rule is INCOMPLETE (needs review)         → warn
 *   - else any rule PASSES                               → pass
 *   - else every rule was INAPPLICABLE / unseen          → na (nothing to assess)
 */
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { A11yStatus } from './runner';

interface A11yAuditSpec {
  meta: AuditMeta;
  /** a11y rule ids whose failure should fail this audit. */
  rules: string[];
}

/** Base class: aggregates this audit's a11y rules across all scanned pages. */
abstract class A11yBackedAudit extends Audit {
  protected abstract rules: string[];

  audit(ctx: CheckContext): AuditResult {
    const meta = (this.constructor as typeof Audit).meta;
    const expected = `accessibility rules pass: ${this.rules.join(', ')}`;

    let sawFail = false;
    let sawIncomplete = false;
    let sawPass = false;
    const failings: string[] = [];
    let failPage: string | undefined;

    for (const p of ctx.pages) {
      const results = p.a11yResults;
      if (!results) continue;
      for (const ruleId of this.rules) {
        const r = results[ruleId];
        if (!r) continue;
        if (r.status === ('fail' as A11yStatus)) {
          sawFail = true;
          failPage ??= p.url;
          for (const n of r.nodes) {
            if (failings.length < 5) failings.push(n.target);
          }
        } else if (r.status === ('incomplete' as A11yStatus)) {
          sawIncomplete = true;
        } else if (r.status === ('pass' as A11yStatus)) {
          sawPass = true;
        }
      }
    }

    if (sawFail) {
      const found = `Failing element(s): ${failings.join('; ') || 'see report'}`;
      return this.fail(
        `${meta.failureTitle} — accessibility violations found.`,
        expected,
        found,
        { priority: meta.defaultPriority, description: meta.description, code: meta.guidance?.code },
        failPage,
      );
    }
    if (sawIncomplete && !sawPass) {
      return this.warn(
        `${meta.title} — accessibility checks could not fully determine; manual review advised.`,
        expected,
        'Incomplete (needs review)',
        meta.defaultPriority,
      );
    }
    if (sawPass) {
      return this.pass(`${meta.title} — accessibility checks pass.`, expected, 'No violations');
    }
    return this.notApplicable(
      `${meta.title} — no applicable elements on scanned pages.`,
      expected,
      'Not applicable',
    );
  }
}

/** All a11y rule ids the adopted audits depend on (fed to the orchestrator). */
export const A11Y_RULES: string[] = [];

function defineA11yAudit(spec: A11yAuditSpec): typeof Audit {
  /* v8 ignore next */
  for (const r of spec.rules) if (!A11Y_RULES.includes(r)) A11Y_RULES.push(r);
  return class extends A11yBackedAudit {
    static override meta = spec.meta;
    protected rules = spec.rules;
  } as unknown as typeof Audit;
}

const base = {
  category: 'accessibility' as const,
  scoreDisplayMode: 'binary' as const,
  weight: 1.0,
};

// ── 7.4 Landmarks are uniquely identifiable ─────────────────────
// Replaces the former hand-rolled MultipleNavAudit. The `landmark-unique` rule
// covers all landmark types (not just <nav>) by role + accessible-name.
export const A11yLandmarkUniqueAudit = defineA11yAudit({
  rules: ['landmark-unique'],
  meta: {
    ...base,
    id: '7.4',
    title: 'Landmarks are uniquely identifiable',
    failureTitle: 'Duplicate landmarks without distinguishing labels',
    description:
      'AI browser agents traverse the accessibility tree and use a landmark’s role plus accessible name to target the right region. Two landmarks of the same role (e.g. two <nav>s) without unique labels are indistinguishable, causing agents to act on the wrong region.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without unique role/label combinations, agents cannot tell primary navigation from footer or breadcrumb navigation, leading to navigation failures.',
      fix: 'Give each landmark of the same role a unique aria-label or aria-labelledby (e.g. "Primary navigation", "Footer navigation").',
      code: '<nav aria-label="Primary navigation">...</nav>\n<nav aria-label="Footer navigation">...</nav>',
      effort: 'trivial',
      tags: ['aria', 'landmarks', 'navigation', 'agent'],
    },
  },
});

// ── 7.5 Form inputs have associated labels ──────────────────────
// Replaces the former hand-rolled FormLabelsAudit.
export const A11yFormLabelsAudit = defineA11yAudit({
  rules: ['label', 'select-name'],
  meta: {
    ...base,
    id: '7.5',
    title: 'Form inputs have associated labels',
    failureTitle: 'Form inputs lack associated labels',
    description:
      'AI agents filling forms identify fields by their accessible name (label, aria-label, or aria-labelledby). Unlabeled inputs are invisible to form-filling agents, so automated workflows like "sign me up" or "submit a contact request" fail.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Unlabeled inputs have no programmatic name, so form-filling agents cannot map fields to data and abandon or misfill the form.',
      fix: 'Associate every input/select/textarea with a <label for="id">, or add aria-label/aria-labelledby. Hidden and button-type inputs are exempt.',
      code: '<label for="email">Email</label>\n<input id="email" type="email" name="email">',
      effort: 'easy',
      tags: ['forms', 'aria', 'agent'],
    },
  },
});

// ── 7.7 Buttons and links have accessible names ─────────────────
// Replaces the former hand-rolled AccessibleNamesAudit AND IconLabelsAudit
// (icon-only controls are just buttons/links with no visible text, already
// covered by these rules).
export const A11yAccessibleNamesAudit = defineA11yAudit({
  rules: ['button-name', 'link-name'],
  meta: {
    ...base,
    id: '7.7',
    title: 'Buttons and links have accessible names',
    failureTitle: 'Buttons or links without accessible names',
    description:
      'AI browser agents identify clickable elements by their accessible name in the accessibility tree. Buttons and links (including icon-only controls) without text, aria-label, or aria-labelledby are invisible to agents, so they cannot navigate the site or trigger actions.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'An unnamed button or link is an unidentifiable action target, causing failed or wrong interactions in agentic workflows.',
      fix: 'Give every <button> and <a> text content, aria-label, or aria-labelledby. For icon-only controls, use aria-label to describe the action.',
      code: '<a href="/pricing" aria-label="Go to pricing page">...</a>\n<button aria-label="Close menu">X</button>',
      effort: 'easy',
      tags: ['aria', 'interactive', 'agent'],
    },
  },
});

// ── 7.9 Dialogs have accessible names ───────────────────────────
// Replaces the former hand-rolled ModalDialogAudit.
export const A11yDialogNameAudit = defineA11yAudit({
  rules: ['aria-dialog-name'],
  meta: {
    ...base,
    id: '7.9',
    title: 'Dialogs have accessible names',
    failureTitle: 'Dialogs without accessible names',
    description:
      'AI browser agents detect modals via role="dialog"/"alertdialog" and need an accessible name to understand the dialog’s purpose. Unlabeled dialogs trap agents in unknown UI states, blocking confirmations, forms, or cookie-consent flows.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'An unlabeled dialog gives an agent no context for the interruption, so it cannot decide how to proceed.',
      fix: 'Add aria-labelledby (pointing to the dialog title) or aria-label to every role="dialog"/"alertdialog" element. Prefer the native <dialog> element.',
      code: '<div role="dialog" aria-labelledby="dlg-title">\n  <h2 id="dlg-title">Confirm action</h2>\n</div>',
      effort: 'easy',
      tags: ['aria', 'dialog', 'agent'],
    },
  },
});

// ── 7.10 Page exposed to the accessibility tree ─────────────────
export const A11yAriaHiddenBodyAudit = defineA11yAudit({
  rules: ['aria-hidden-body'],
  meta: {
    ...base,
    id: '7.10',
    title: 'Page exposed to the accessibility tree',
    failureTitle: 'Page hidden from the accessibility tree',
    description:
      'aria-hidden="true" on the document body removes the entire page from the accessibility tree. AI browser agents that navigate via the accessibility tree would see nothing at all.',
    defaultPriority: 'critical',
    guidance: {
      impact:
        'If the root is aria-hidden, agents relying on the accessibility tree perceive an empty page and cannot read or act on any content.',
      fix: 'Never put aria-hidden="true" on <body> or the root element. Hide only specific decorative subtrees.',
      code: '<!-- BAD --> <body aria-hidden="true">\n<!-- GOOD --> <body> ... </body>',
      effort: 'trivial',
      tags: ['aria', 'accessibility-tree', 'agent'],
    },
  },
});

// ── 7.11 Valid ARIA roles ───────────────────────────────────────
export const A11yAriaRolesAudit = defineA11yAudit({
  rules: ['aria-roles', 'aria-deprecated-role', 'aria-allowed-role'],
  meta: {
    ...base,
    id: '7.11',
    title: 'Valid ARIA roles',
    failureTitle: 'Invalid or misused ARIA roles',
    description:
      'AI agents map elements to behaviors by their ARIA role. Invalid, deprecated, or disallowed roles make an element’s purpose ambiguous, so agents may mis-classify or skip it.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'A wrong role tells an agent the element is something it is not (e.g. a div role="button" that isn’t operable), causing failed or incorrect actions.',
      fix: 'Use valid, non-deprecated ARIA roles allowed on the element. Prefer native HTML elements over role overrides.',
      code: '<button>Add to cart</button> <!-- preferred over <div role="button"> -->',
      effort: 'easy',
      tags: ['aria', 'roles', 'agent'],
    },
  },
});

// ── 7.12 Valid ARIA attributes ──────────────────────────────────
export const A11yAriaAttributesAudit = defineA11yAudit({
  rules: ['aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-attr', 'aria-prohibited-attr'],
  meta: {
    ...base,
    id: '7.12',
    title: 'Valid ARIA attributes',
    failureTitle: 'Invalid ARIA attributes or values',
    description:
      'ARIA states and properties carry the machine-readable state agents act on (expanded, checked, disabled, labels). Invalid attributes or values corrupt that state.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Misspelled attributes or bad values (e.g. aria-expanded="yes") leave agents with wrong or missing state, leading to incorrect interactions.',
      fix: 'Use only valid aria-* attributes with valid values, allowed on the element’s role.',
      code: '<button aria-expanded="false" aria-controls="menu">Menu</button>',
      effort: 'easy',
      tags: ['aria', 'attributes', 'agent'],
    },
  },
});

// ── 7.13 Complete ARIA relationships ────────────────────────────
export const A11yAriaRelationshipsAudit = defineA11yAudit({
  rules: ['aria-required-attr', 'aria-required-children', 'aria-required-parent'],
  meta: {
    ...base,
    id: '7.13',
    title: 'Complete ARIA relationships',
    failureTitle: 'Incomplete ARIA role relationships',
    description:
      'Composite widgets (menus, listboxes, tabs, grids) require specific child/parent roles and attributes. Missing pieces break the structure agents traverse.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'An incomplete widget (e.g. a role="listbox" without role="option" children) is unparseable as a coherent control, so agents cannot operate it reliably.',
      fix: 'Provide all required attributes and the required child/parent roles for each ARIA widget.',
      code: '<ul role="listbox"><li role="option">A</li><li role="option">B</li></ul>',
      effort: 'moderate',
      tags: ['aria', 'relationships', 'agent'],
    },
  },
});

// ── 7.14 Unique IDs for references ──────────────────────────────
export const A11yDuplicateIdAudit = defineA11yAudit({
  rules: ['duplicate-id-aria'],
  meta: {
    ...base,
    id: '7.14',
    title: 'Unique IDs for ARIA references',
    failureTitle: 'Duplicate IDs break ARIA references',
    description:
      'aria-labelledby / aria-describedby / for resolve by id. Duplicate ids make resolution ambiguous, so an agent may read the wrong label or description.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Duplicate ids referenced by ARIA cause agents to associate the wrong text with a control, mislabeling actions.',
      fix: 'Ensure every id referenced by ARIA/label is unique within the page.',
      code: '<label id="lbl-email">Email</label><input aria-labelledby="lbl-email">',
      effort: 'easy',
      tags: ['aria', 'ids', 'agent'],
    },
  },
});

// ── 7.15 Form fields declare autocomplete ───────────────────────
export const A11yAutocompleteAudit = defineA11yAudit({
  rules: ['autocomplete-valid'],
  meta: {
    ...base,
    id: '7.15',
    title: 'Form fields use valid autocomplete tokens',
    failureTitle: 'Invalid autocomplete tokens on form fields',
    description:
      'Form-filling agents map fields to known data (name, email, address, payment) via autocomplete tokens. Invalid tokens break that mapping.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Without valid autocomplete, an agent must guess each field’s meaning, so automated checkout/sign-up flows fail or misfill.',
      fix: 'Use valid HTML autocomplete tokens on inputs (e.g. email, given-name, postal-code, cc-number).',
      code: '<input name="email" autocomplete="email">',
      effort: 'easy',
      tags: ['forms', 'autocomplete', 'agent'],
    },
  },
});

// ── 7.16 No nested interactive controls ─────────────────────────
export const A11yNestedInteractiveAudit = defineA11yAudit({
  rules: ['nested-interactive'],
  meta: {
    ...base,
    id: '7.16',
    title: 'No nested interactive controls',
    failureTitle: 'Nested interactive controls',
    description:
      'Interactive elements nested inside other interactive elements (e.g. a button inside a link) create ambiguous targets in the accessibility tree.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Nested controls give agents two overlapping action targets, so the wrong action may fire or the control becomes unoperable.',
      fix: 'Do not nest focusable/interactive elements; keep one control per actionable region.',
      code: '<!-- BAD --> <a href="/x"><button>Go</button></a>',
      effort: 'moderate',
      tags: ['interactive', 'agent'],
    },
  },
});

// ── 7.17 Data tables have header associations ───────────────────
export const A11yTableHeadersAudit = defineA11yAudit({
  rules: ['td-has-header', 'th-has-data-cells', 'td-headers-attr', 'scope-attr-valid'],
  meta: {
    ...base,
    id: '7.17',
    title: 'Data tables have header associations',
    failureTitle: 'Data table cells lack header associations',
    description:
      'Agents extracting tabular data rely on header↔cell associations (th scope / headers attr) to know what each value means. Missing associations make tables ambiguous.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without header associations, an agent reading a price/spec table cannot reliably pair each value with its column/row meaning.',
      fix: 'Use <th scope="col"|"row"> headers (or headers/id) so every data cell maps to its header.',
      code: '<table><tr><th scope="col">Size</th><th scope="col">Price</th></tr><tr><td>M</td><td>$29</td></tr></table>',
      effort: 'moderate',
      tags: ['tables', 'extraction', 'agent'],
    },
  },
});

// ── 7.18 Page has a title ───────────────────────────────────────
export const A11yDocumentTitleAudit = defineA11yAudit({
  rules: ['document-title'],
  meta: {
    ...base,
    id: '7.18',
    title: 'Page has a non-empty <title>',
    failureTitle: 'Missing or empty <title>',
    description:
      'The document title is the page’s identity in the accessibility tree and in agent context windows. A missing/empty title leaves the page unnamed.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Agents use <title> to identify and reference a page; without it, the page is hard to cite or disambiguate.',
      fix: 'Provide a descriptive, unique <title> for every page.',
      code: '<title>Men’s Wool Runners — Allbirds</title>',
      effort: 'trivial',
      tags: ['title', 'identity', 'agent'],
    },
  },
});

// ── 7.19 Frames are titled ──────────────────────────────────────
export const A11yFrameTitleAudit = defineA11yAudit({
  rules: ['frame-title', 'frame-title-unique'],
  meta: {
    ...base,
    id: '7.19',
    title: 'Frames are titled',
    failureTitle: 'Untitled or duplicate-titled frames',
    description:
      'Agents need a title to understand what each iframe contains. Untitled or duplicate-titled frames are opaque embedded contexts.',
    defaultPriority: 'low',
    guidance: {
      impact:
        'Without a title an agent cannot tell what an iframe holds (checkout widget? map? video?), so it may skip or misuse it.',
      fix: 'Give every <iframe> a unique, descriptive title attribute.',
      code: '<iframe title="Checkout payment form" src="..."></iframe>',
      effort: 'easy',
      tags: ['frames', 'agent'],
    },
  },
});

// ── 7.20 No auto-refresh / time-based redirect ──────────────────
export const A11yMetaRefreshAudit = defineA11yAudit({
  rules: ['meta-refresh'],
  meta: {
    ...base,
    id: '7.20',
    title: 'No time-based auto-refresh/redirect',
    failureTitle: 'Time-based meta refresh present',
    description:
      'A <meta http-equiv="refresh"> that reloads/redirects after a delay disrupts an agent mid-read and can trap it in unexpected navigation.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Auto-refresh changes the page out from under an agent that is reading or acting, corrupting its state and any in-progress task.',
      fix: 'Remove time-based meta refresh; use proper server redirects (3xx) for instant redirects.',
      code: '<!-- BAD --> <meta http-equiv="refresh" content="5;url=/next">',
      effort: 'easy',
      tags: ['navigation', 'agent'],
    },
  },
});

// ── 7.21 Logical focus order ────────────────────────────────────
export const A11yTabindexAudit = defineA11yAudit({
  rules: ['tabindex'],
  meta: {
    ...base,
    id: '7.21',
    title: 'No positive tabindex (logical focus order)',
    failureTitle: 'Positive tabindex disrupts focus order',
    description:
      'Positive tabindex values force a non-DOM focus order. Agents that traverse the page by focus order then encounter a confusing, non-linear sequence.',
    defaultPriority: 'low',
    guidance: {
      impact:
        'A scrambled focus order makes sequential agent navigation jump around unpredictably, raising the chance of missed or wrong interactions.',
      fix: 'Avoid tabindex > 0; rely on DOM order and use tabindex="0"/"-1" only.',
      code: '<!-- BAD --> <input tabindex="5">  <!-- GOOD --> <input>',
      effort: 'moderate',
      tags: ['focus-order', 'agent'],
    },
  },
});

// 7.22 (deprecated <marquee>/<blink> elements) was sunset — grade D, no
// consumer reads it. See docs/evidence/sunset/NOT-A-FACTOR.md#accessibilitymarquee.

// ── 7.23 No presentation-role conflicts ─────────────────────────
export const A11yPresentationConflictAudit = defineA11yAudit({
  rules: ['presentation-role-conflict'],
  meta: {
    ...base,
    id: '7.23',
    title: 'No presentation-role conflicts',
    failureTitle: 'Presentation role conflicts with focusable/labeled element',
    description:
      'An element marked role="presentation"/"none" while still focusable or carrying ARIA sends contradictory signals about whether it exists in the accessibility tree.',
    defaultPriority: 'low',
    guidance: {
      impact:
        'A presentational element that is still focusable/labeled confuses agents about whether to treat it as content or ignore it.',
      fix: 'Don’t put role="presentation"/"none" on focusable or ARIA-labeled elements.',
      code: '<!-- BAD --> <a href="/x" role="presentation">Link</a>',
      effort: 'easy',
      tags: ['aria', 'agent'],
    },
  },
});
