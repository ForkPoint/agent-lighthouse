// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 3).
// Evidence dossier: docs/evidence/audits/operability-safety/stateful-control-introspectability.md
//
// Scope note (non-double-counting): `aria-attributes` validates the value of an
// ARIA attribute that is already written, and `aria-roles` validates the role
// name. Neither fires on a control that carries no ARIA at all — a
// `<div class="toggle is-on">` declares nothing for them to check. This audit
// asks whether the control's current state is readable, not whether the ARIA it
// does carry is spelled correctly.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { collectPageCss } from '../../gatherers/css-rules';
import { detailLines } from '../../detail-lines';
import { NATIVE_INTERACTIVE, STATE_CLASS_RE, hasClickSignal, isElement } from './_agent-affordances';

/** Below this share of introspectable controls the page fails. */
const RATIO_FLOOR = 0.9;

/**
 * Roles whose APG contract requires a state attribute, and which one.
 *
 * A control that takes one of these roles has declared that it holds a state;
 * the attribute is the only place an agent can read that state from.
 */
const ROLE_STATE: ReadonlyMap<string, string> = new Map([
  ['switch', 'aria-checked'],
  ['checkbox', 'aria-checked'],
  ['radio', 'aria-checked'],
  ['menuitemcheckbox', 'aria-checked'],
  ['menuitemradio', 'aria-checked'],
  ['tab', 'aria-selected'],
  ['option', 'aria-selected'],
  ['treeitem', 'aria-selected'],
]);

/** Attributes that publish a control's current state to a snapshot. */
const STATE_ATTRIBUTES = [
  'aria-pressed',
  'aria-checked',
  'aria-expanded',
  'aria-selected',
  'aria-current',
];

/** What a class-only state control should have declared instead. */
const CLASS_STATE_REMEDY = 'aria-pressed, aria-checked, aria-selected or aria-current';

/** Classes a collapsible region carries when it is the target of a trigger. */
const PANEL_CLASS = /accordion|collapse|panel|details-content/i;

/** Markers that make a table header a sort control. */
const SORT_CLASS = /sort/i;

/** Native controls whose state is in the DOM without any ARIA. */
const NATIVE_STATEFUL = new Set(['details', 'select']);
const NATIVE_STATEFUL_INPUT = new Set(['checkbox', 'radio']);

interface Finding {
  pageUrl: string;
  /** Empty when the control is introspectable. */
  missing: string;
  /** The class token that carries the state, when that is the whole story. */
  stateClass: string;
  hint: string;
}

/** How many state classes the summary line names before it counts the rest. */
const MAX_NAMED_CLASSES = 3;

/** One finding as a single line. `detailLines` applies the schema's caps. */
function describeFinding(finding: Finding): string {
  const where = finding.stateClass ? ` [class "${finding.stateClass}"]` : '';
  return `${finding.pageUrl} — ${finding.missing}${where}: ${finding.hint}`;
}

interface Survey {
  introspectable: number;
  opaque: Finding[];
  crossOrigin: number;
}

/** The first class token that reads as a state marker, or an empty string. */
function stateClassToken(attribs: Record<string, string>): string {
  for (const token of (attribs['class'] ?? '').split(/\s+/)) {
    if (token && STATE_CLASS_RE.test(token)) return token;
  }
  return '';
}

/** True when the element already publishes its state to a snapshot. */
function publishesState(attribs: Record<string, string>): boolean {
  return STATE_ATTRIBUTES.some((name) => attribs[name] !== undefined);
}

/** A short, stable label for the element, for the evidence line. */
function hintFor(tag: string, attribs: Record<string, string>): string {
  const id = attribs['id'] ? `#${attribs['id']}` : '';
  const cls = attribs['class'] ? `.${attribs['class'].split(/\s+/).filter(Boolean).join('.')}` : '';
  const role = attribs['role'] ? ` role="${attribs['role']}"` : '';
  return `<${tag}${id}${cls}${role}>`;
}

async function survey(ctx: CheckContext): Promise<Survey> {
  const result: Survey = { introspectable: 0, opaque: [], crossOrigin: 0 };

  for (const page of ctx.pages) {
    const $ = page.$;
    const css = await collectPageCss(ctx, page);
    result.crossOrigin += css.skippedCrossOrigin.length;

    /** One verdict per element, so a control in two buckets is counted once. */
    const verdicts = new Map<unknown, Finding | null>();
    const record = (node: unknown, finding: Finding | null) => {
      // An opaque verdict wins: a control that publishes one state and hides
      // another is still a control an agent cannot fully read.
      if (verdicts.has(node) && verdicts.get(node) !== null) return;
      verdicts.set(node, finding);
    };

    $('body *').each((_i, node) => {
      if (!isElement(node)) return;
      const tag = node.tagName?.toLowerCase() ?? '';
      const attribs = node.attribs ?? {};
      const role = (attribs['role'] ?? '').trim().toLowerCase();
      const hint = hintFor(tag, attribs);
      const base = { pageUrl: page.url, hint };

      // (a) A role that declares the control holds a state.
      const required = ROLE_STATE.get(role);
      if (required) {
        record(
          node,
          attribs[required] === undefined
            ? { ...base, missing: required, stateClass: stateClassToken(attribs) }
            : null,
        );
        return;
      }

      // Native state: the DOM carries `open`, `checked` and `selected` itself,
      // and every snapshot serializer reads them.
      if (NATIVE_STATEFUL.has(tag)) {
        record(node, null);
        return;
      }
      if (tag === 'input' && NATIVE_STATEFUL_INPUT.has((attribs['type'] ?? '').toLowerCase())) {
        record(node, null);
        return;
      }
      // A summary's state lives on its parent details, already counted.
      if (tag === 'summary') return;

      const clickable =
        NATIVE_INTERACTIVE.has(tag) || role === 'button' || hasClickSignal(node, $, css.rules);

      // (c) A disclosure trigger: it opens something, so it has an open state.
      if (clickable) {
        const controls = attribs['aria-controls'] !== undefined;
        const next = $(node).next();
        const panel = next.length > 0 && PANEL_CLASS.test(next.attr('class') ?? '');
        if (controls || panel) {
          record(
            node,
            attribs['aria-expanded'] === undefined
              ? { ...base, missing: 'aria-expanded', stateClass: stateClassToken(attribs) }
              : null,
          );
          return;
        }
      }

      // (b) State that lives in a class name and nowhere else.
      const stateClass = stateClassToken(attribs);
      if (stateClass && clickable) {
        record(
          node,
          publishesState(attribs)
            ? null
            : { ...base, missing: CLASS_STATE_REMEDY, stateClass },
        );
        return;
      }

      // (d) A sortable column header carries the current sort direction.
      if (tag === 'th') {
        const sortable =
          SORT_CLASS.test(attribs['class'] ?? '') ||
          Object.keys(attribs).some((key) => key.startsWith('data-sort')) ||
          $(node).find('button, a[href]').length > 0;
        if (sortable) {
          record(
            node,
            attribs['aria-sort'] === undefined
              ? { ...base, missing: 'aria-sort', stateClass: stateClassToken(attribs) }
              : null,
          );
        }
      }
    });

    for (const finding of verdicts.values()) {
      if (finding === null) result.introspectable += 1;
      else result.opaque.push(finding);
    }
  }

  return result;
}

const EXPECTED =
  'Every control that holds a state publishes it through an ARIA state attribute or a native element, so an agent can read the state before acting and verify it afterwards';

const SAMPLE = `<!-- The state is in the attribute, so the snapshot changes when it flips. -->
<button class="toggle is-on" role="switch" aria-checked="true">Share my data</button>
<button class="tab is-active" aria-selected="true" role="tab">Overview</button>
<button aria-controls="faq-1" aria-expanded="false">What is your return policy?</button>

<!-- Not: the class flips, the accessibility snapshot does not. -->
<div class="toggle is-on" onclick="flip()">Share my data</div>
<button class="tab is-active">Overview</button>`;

export class StatefulControlIntrospectabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/stateful-control-introspectability',
    category: 'operability-safety',
    title: 'Stateful controls: current state readable by an agent',
    failureTitle: 'Stateful controls: current state readable by an agent',
    description:
      'Checks that every control whose purpose is to hold a state — toggles, switches, checkboxes, radio groups, tabs, accordions, disclosure triggers, sort direction, filter chips — exposes that state through a machine-readable attribute rather than a CSS class alone. Reports the count of state-bearing controls whose current value an agent cannot read, each with the class that carries the state instead.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/stateful-control-introspectability.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "An agent works as observe, act, verify. If a toggle's only \"on\" signal is `class=\"is-active\"` and a colour change, the accessibility snapshot is byte-identical before and after the click, so the agent cannot verify the post-condition: it either clicks again and flips the state back, or reports success with no evidence. The accessibility linters cannot catch this, because `aria-required-attr` fires only once the element already declares `role=\"switch\"` or `role=\"checkbox\"` — the common class-only toggle declares no role and passes silently. Benchmarks put the cost high: WebSuite measures switch, accordion and dropdown primitives among the worst-performing interactions for web agents, and Operator's confirmation design assumes the agent can observe a state transition before acting on it.",
      fix: 'Publish the state where a snapshot can read it. Give a toggle `role="switch"` with `aria-checked`, a tab `role="tab"` with `aria-selected`, a filter chip `aria-pressed`, a disclosure trigger `aria-expanded` alongside its `aria-controls`, and a sortable column header `aria-sort="ascending"`, `"descending"` or `"none"`. Keep the class for styling and update the attribute in the same handler that updates the class. Where the markup allows it, use `<details>`/`<summary>` or a native checkbox and let the DOM carry the state for free.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/stateful-control-introspectability/',
      tags: ['agent-operability', 'accessibility-tree', 'state'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: StatefulControlIntrospectabilityAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const s = await survey(ctx);
    const total = s.introspectable + s.opaque.length;
    const partial =
      s.crossOrigin > 0 ? `; ${s.crossOrigin} cross-origin stylesheet not fetched` : '';

    if (total === 0) {
      return {
        ...this.notApplicable(
          'The scanned pages carry no control that holds a state, so there is nothing to read back.',
          EXPECTED,
          `0 state-bearing control(s) found${partial}`,
        ),
        details: { opaqueCount: 0, introspectableCount: 0 },
      };
    }

    const ratio = s.introspectable / total;
    // Named, but bounded: the class list comes from the page, and a storefront
    // whose components each carry their own state class produced a summary
    // line past the schema's 1000-character cap, which errored the whole audit
    // out. Three names identify the pattern; the rest is a count.
    const classes = [...new Set(s.opaque.map((f) => f.stateClass).filter(Boolean))];
    const shown = classes.slice(0, MAX_NAMED_CLASSES).map((c) => `"${c}"`);
    const rest = classes.length - shown.length;
    const classClause =
      classes.length > 0
        ? ` (state in class ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''} only)`
        : '';
    const found =
      s.opaque.length === 0
        ? `ratio ${ratio.toFixed(2)} — 0 opaque of ${total} state-bearing control(s)${partial}`
        : `ratio ${ratio.toFixed(2)} — ${s.opaque.length} opaque of ${total} state-bearing control(s)${classClause}${partial}`;
    const details = {
      opaqueCount: s.opaque.length,
      introspectableCount: s.introspectable,
      ratio: Number(ratio.toFixed(4)),
      // One line per finding, not the Finding objects: `details` admits scalars
      // and string arrays only, and an array of objects failed validation, so
      // every scan of a page with a state-bearing control errored out.
      opaque: detailLines(s.opaque, describeFinding, 20),
    };

    if (s.opaque.length === 0) {
      return {
        ...this.pass(
          `All ${total} state-bearing control(s) publish their current state, so an agent can read it before acting and verify it afterwards.`,
          EXPECTED,
          found,
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    const missing = [...new Set(s.opaque.map((f) => f.missing))];
    const first = s.opaque[0]!;
    const body = `${s.opaque.length} of ${total} state-bearing control(s) hold their state where no snapshot can read it, so an agent cannot verify that its click did anything. Missing: ${missing.join('; ')}. First: ${first.hint}.`;

    if (ratio < RATIO_FLOOR) {
      return {
        ...this.fail(body, EXPECTED, found, this.recommendation(), first.pageUrl),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.warn(body, EXPECTED, found, this.recommendation(), first.pageUrl),
      displayValue: found,
      details,
    };
  }
}
