// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 5).
// Evidence dossier: docs/evidence/audits/operability-safety/drag-and-slider-dependency.md
//
// Scope note (non-double-counting): `native-control-substitution` asks whether a
// widget replaced a native element an agent could have driven in one call. This
// audit asks the opposite question — whether a control an agent cannot drive at
// all, native or not, has a discrete alternative beside it. A native
// `<input type="range">` passes the other audit and fails this one.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { accessibleName, isElement } from './_agent-affordances';

/**
 * Paths where a gesture-only control costs a task rather than a nicety.
 *
 * Kept to the words that name a transaction. A wider list — `seat`, `book` —
 * matches ordinary editorial URLs like `/blog/seat-tips` and turns a criticality
 * test into a substring test.
 */
const CRITICAL_PATH = /cart|checkout|builder|configure|order/i;

/** Class names a reorderable list item carries. */
const DRAG_CLASS = /sortable|draggable|drag-handle|reorder/i;

/** Class names a drag-only upload target carries. */
const DROP_ZONE_CLASS = /drop.?zone|file.?drop|upload.?area/i;

/** Class names a carousel carries. */
const CAROUSEL_CLASS = /carousel|swiper|slick|slideshow|flickity/i;

/** Attributes that carry a swipe gesture and nothing else. */
const SWIPE_ATTRS = ['ontouchstart', 'ontouchmove', 'onpointerdown', 'data-swipe'];

/** Labels a discrete carousel control carries. */
const CAROUSEL_CONTROL = /next|prev|previous|forward|back|slide/i;

/** Labels a discrete reorder control carries. */
const REORDER_CONTROL = /up|down|move|position|order|top|bottom/i;

/** The three values APG requires a slider to publish. */
const SLIDER_VALUES = ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'];

type Arm = 'slider' | 'sliderAria' | 'dragList' | 'dropZone' | 'carousel';

interface Finding {
  pageUrl: string;
  arm: Arm;
  /** The discrete control that is missing — the remediation, in one phrase. */
  missing: string;
  hint: string;
}

/** A short, stable label for the element, for the evidence line. */
function hintFor(tag: string, attribs: Record<string, string>): string {
  const id = attribs['id'] ? `#${attribs['id']}` : '';
  const cls = attribs['class'] ? `.${attribs['class'].split(/\s+/).filter(Boolean).join('.')}` : '';
  const role = attribs['role'] ? ` role="${attribs['role']}"` : '';
  return `<${tag}${id}${cls}${role}>`;
}

/**
 * The field group a control shares with its alternative.
 *
 * The enclosing `<fieldset>` or `<form>` when there is one, and the parent
 * element otherwise: a numeric input bound to the same parameter is placed
 * beside the slider, not across the page.
 */
function fieldGroup($: PageContext['$'], node: unknown) {
  const $node = $(node as never);
  const labelled = $node.closest('fieldset, form, [role="group"]');
  return labelled.length > 0 ? labelled : $node.parent();
}

/** True when a control in this group accepts a typed or chosen value. */
function hasDiscreteValue($: PageContext['$'], node: unknown): boolean {
  const group = fieldGroup($, node);
  if (group.find('select').length > 0) return true;
  return (
    group.find('input[type="number"], input[type="text"], input[type="tel"], input[inputmode]')
      .length > 0
  );
}

/** True when some element in the subtree is a button labelled for reordering. */
function hasReorderControl($: PageContext['$'], scope: unknown): boolean {
  const $scope = $(scope as never);
  if ($scope.find('select').length > 0) return true;
  let found = false;
  $scope.find('button, [role="button"], a[href]').each((_i, node) => {
    if (!isElement(node)) return;
    const label = `${accessibleName(node, $ as never)} ${node.attribs?.['aria-label'] ?? ''} ${node.attribs?.['class'] ?? ''}`;
    if (REORDER_CONTROL.test(label)) found = true;
  });
  return found;
}

function survey(ctx: CheckContext): Finding[] {
  const findings: Finding[] = [];

  for (const page of ctx.pages) {
    const $ = page.$;
    const critical = CRITICAL_PATH.test(page.url);
    const add = (arm: Arm, missing: string, node: unknown) => {
      const el = node as { tagName?: string; attribs?: Record<string, string> };
      findings.push({
        pageUrl: page.url,
        arm,
        missing,
        hint: hintFor(el.tagName?.toLowerCase() ?? '', el.attribs ?? {}),
      });
    };

    // (a) A continuous value with no way to type it.
    $('input[type="range"], [role="slider"]').each((_i, node) => {
      if (!isElement(node)) return;
      const attribs = node.attribs ?? {};
      const isAria = (attribs['role'] ?? '').toLowerCase() === 'slider';

      // The APG arm is separate: a slider whose value cannot even be read is a
      // different defect from one whose value cannot be set discretely.
      if (isAria) {
        const missingValues = SLIDER_VALUES.filter((name) => attribs[name] === undefined);
        const unnamed = accessibleName(node, $ as never) === '';
        if (missingValues.length > 0 || unnamed) {
          const parts = [...missingValues];
          if (unnamed) parts.push('an accessible name');
          add('sliderAria', parts.join(', '), node);
          return;
        }
      }

      if (!hasDiscreteValue($, node)) {
        add('slider', 'a numeric input or select bound to the same value', node);
      }
    });

    // (b) A reorder gesture on a path where the order is the task.
    if (critical) {
      $('[draggable="true"], [class]').each((_i, node) => {
        if (!isElement(node)) return;
        const attribs = node.attribs ?? {};
        const draggable = (attribs['draggable'] ?? '').toLowerCase() === 'true';
        const named = DRAG_CLASS.test(attribs['class'] ?? '');
        if (!draggable && !named) return;
        // The list is the finding, not each of its items: one set of move
        // buttons per item is one fix.
        const list = $(node as never).closest('ul, ol, [role="list"], [role="listbox"]');
        const scope = list.length > 0 ? list : $(node as never);
        const key = scope.get(0);
        if (findings.some((f) => f.arm === 'dragList' && f.hint === hintFor(
          (key as { tagName?: string })?.tagName?.toLowerCase() ?? '',
          (key as { attribs?: Record<string, string> })?.attribs ?? {},
        ))) return;
        if (hasReorderControl($, scope)) return;
        add('dragList', 'move-up/move-down buttons or a position select', key);
      });
    }

    // (c) An upload that only accepts a dropped file. An agent sets files on an
    // input; it does not synthesise a DataTransfer.
    $('[class]').each((_i, node) => {
      if (!isElement(node)) return;
      const cls = node.attribs?.['class'] ?? '';
      if (!DROP_ZONE_CLASS.test(cls)) return;
      const $node = $(node as never);
      if ($node.find('input[type="file"]').length > 0) return;
      if ($node.siblings().find('input[type="file"]').length > 0) return;
      if ($node.siblings('input[type="file"]').length > 0) return;
      add('dropZone', 'an <input type="file"> the agent can set files on', node);
    });

    // (d) A carousel that only answers a swipe.
    $('[class]').each((_i, node) => {
      if (!isElement(node)) return;
      const attribs = node.attribs ?? {};
      if (!CAROUSEL_CLASS.test(attribs['class'] ?? '')) return;
      const swipeOnly = SWIPE_ATTRS.some((name) => attribs[name] !== undefined);
      if (!swipeOnly) return;
      const $node = $(node as never);
      let hasControl = false;
      $node.find('button, [role="button"], a[href]').each((_j, control) => {
        if (!isElement(control)) return;
        const label = `${accessibleName(control, $ as never)} ${control.attribs?.['aria-label'] ?? ''} ${control.attribs?.['class'] ?? ''}`;
        if (CAROUSEL_CONTROL.test(label)) hasControl = true;
      });
      if (hasControl) return;
      add('carousel', 'rendered next and previous buttons', node);
    });
  }

  return findings;
}

const EXPECTED =
  'Every continuous pointer gesture on the site has a discrete alternative beside it: a typed value for a slider, move buttons for a reorderable list, a file input for a drop zone, and next/previous buttons for a carousel';

const SAMPLE = `<!-- The gesture stays; the discrete path is what an agent uses. -->
<fieldset>
  <label for="max-price">Max price</label>
  <input id="max-price" type="range" min="0" max="500" step="10">
  <input type="number" min="0" max="500" step="10" aria-label="Max price, exact value">
</fieldset>

<div class="file-drop">
  Drop your CV here, or
  <label>choose a file<input type="file" name="cv"></label>
</div>`;

export class DragAndSliderDependencyAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/drag-and-slider-dependency',
    category: 'operability-safety',
    title: 'Gesture-only controls with no discrete alternative',
    failureTitle: 'Gesture-only controls with no discrete alternative',
    description:
      'Flags interactions on task-critical paths whose only operation path is a continuous pointer gesture — range sliders, drag-to-reorder lists, drag-only upload zones, swipe carousels — with no click, keyboard, or typed-value alternative. Each finding names the discrete control that is missing.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/drag-and-slider-dependency.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'A continuous pointer gesture asks an agent to synthesise a pointerdown, a run of intermediate pointermove events and a pointerup at a computed pixel offset, with no feedback between steps and no way to check the interim value. Every other agent action is discrete and verifiable. WebSuite measures slider interaction at 0% success for both agents it tested — the worst primitive in its taxonomy — and Anthropic separately documents scrollbars and dropdowns as unreliable under mouse control, recommending keyboard paths instead. Pair the slider with a numeric input bound to the same value and "set max price to 300" stops being a gesture and becomes a fill.',
      fix: 'Keep the gesture and add the discrete path beside it. Give every range slider a numeric input or a select bound to the same value, and give every `role="slider"` the full `aria-valuenow`/`aria-valuemin`/`aria-valuemax` set plus an accessible name. Put move-up and move-down buttons, or a position select, on each item of a reorderable list that sits on a checkout or configuration path. Always render an `<input type="file">` inside a drop zone — an agent sets files on an input and cannot synthesise a drop. Give a carousel real next and previous buttons rather than swipe handlers alone.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/drag-and-slider-dependency/',
      tags: ['agent-operability', 'actionability', 'forms'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: DragAndSliderDependencyAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const findings = survey(ctx);
    const count = (arm: Arm) => findings.filter((f) => f.arm === arm).length;
    const details = {
      sliders: count('slider'),
      sliderAria: count('sliderAria'),
      dragLists: count('dragList'),
      dropZones: count('dropZone'),
      carousels: count('carousel'),
    };

    const constructs = ctx.pages.some(
      (page) =>
        page.$('input[type="range"], [role="slider"], [draggable="true"]').length > 0 ||
        page.$('[class]').filter((_i, node) => {
          const cls = (node as { attribs?: Record<string, string> }).attribs?.['class'] ?? '';
          return DRAG_CLASS.test(cls) || DROP_ZONE_CLASS.test(cls) || CAROUSEL_CLASS.test(cls);
        }).length > 0,
    );

    if (!constructs) {
      return {
        ...this.notApplicable(
          'The scanned pages carry no slider, reorderable list, drop zone or carousel, so there is no gesture to find an alternative for.',
          EXPECTED,
          'No gesture-driven control on the scanned pages',
        ),
        details,
      };
    }

    if (findings.length === 0) {
      return {
        ...this.pass(
          'Every gesture-driven control on the scanned pages has a discrete alternative an agent can use.',
          EXPECTED,
          'All gesture-driven controls carry a discrete alternative',
          ctx.pages[0]?.url,
        ),
        details,
      };
    }

    const parts: Array<[number, string]> = [
      [details.sliders, 'slider(s) with no typed value'],
      [details.sliderAria, 'slider(s) whose value cannot be read'],
      [details.dragLists, 'reorderable list(s) with no move buttons'],
      [details.dropZones, 'drop zone(s) with no file input'],
      [details.carousels, 'carousel(s) with no next/previous button'],
    ];
    const found = parts
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`)
      .join('; ');
    const missing = [...new Set(findings.map((f) => f.missing))];
    const first = findings[0]!;

    return {
      ...this.fail(
        `${findings.length} control(s) can only be operated with a continuous pointer gesture, which an agent has to synthesise blind. Missing: ${missing.join('; ')}. First: ${first.hint}.`,
        EXPECTED,
        found,
        this.recommendation(),
        first.pageUrl,
      ),
      displayValue: found,
      details,
    };
  }
}
