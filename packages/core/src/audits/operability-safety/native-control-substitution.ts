// Graduated from proposal 2026-08-22 (Plan 5, Task 8).
// Evidence dossier: docs/evidence/audits/operability-safety/native-control-substitution.md
//
// Scope note (non-double-counting): `aria-roles` and `aria-attributes` validate
// the ARIA a widget already declares. Neither can fire on a widget that
// declares no role at all — a `<div class="dropdown">` is invisible to axe —
// and neither has any notion of the native element the widget replaced. This
// audit measures that substitution, and only then asks whether the replacement
// carries a usable APG contract.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { idSelector } from './_agent-affordances';

/**
 * Controls a mainstream agent toolkit drives in one call — `selectOption`,
 * `fill`, `setInputFiles` — with no popup, no scrolling and no hit-testing.
 */
const NATIVE_SELECTOR =
  'select, input[type="date"], input[type="month"], input[type="week"], input[type="time"], input[type="datetime-local"], input[type="file"], input[type="color"], input[type="range"]';

/** Class names sites give a div that stands in for a choice control. */
const SUBSTITUTE_CLASS = /select|dropdown|picker|calendar|datepicker|chooser|combobox/i;

/** Class names sites give a div that stands in for a file input. */
const DROP_ZONE_CLASS = /drop.?zone|file.?drop|upload.?area/i;

/** Paths where a control an agent cannot drive costs a conversion. */
const CONVERSION_PATH = /checkout|cart|signup|sign-up|register|book|order|search/i;

/** Roles a combobox may legally point `aria-controls` at (WAI-ARIA APG). */
const POPUP_ROLES = new Set(['listbox', 'grid', 'tree', 'dialog', 'menu']);

interface Substitution {
  pageUrl: string;
  /** What the control replaced, for the message. */
  kind: 'choice' | 'file';
  /** 2 on a conversion path, 1 elsewhere. */
  weight: number;
  /** Empty when the APG contract is complete. */
  defect?: string;
}

interface Survey {
  controlsSeen: number;
  native: number;
  substitutions: Substitution[];
}

function collectIds(page: PageContext): Set<string> {
  const ids = new Set<string>();
  page.$('[id]').each((_, el) => {
    const id = page.$(el).attr('id');
    if (id) ids.add(id);
  });
  return ids;
}

const SAMPLE = `<!-- One agent call: selectOption('NL'). -->
<label for="country">Country</label>
<select id="country" name="country"><option value="NL">Netherlands</option></select>

<!-- If a custom widget is unavoidable, ship the whole APG contract. -->
<div role="combobox" aria-expanded="false"
     aria-controls="country-list" aria-activedescendant="country-nl">Country</div>
<ul id="country-list" role="listbox">
  <li id="country-nl" role="option">Netherlands</li>
</ul>`;

export class NativeControlSubstitutionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/native-control-substitution',
    category: 'operability-safety',
    title: 'Native Control Substitution Index',
    failureTitle: 'Native Control Substitution Index',
    description:
      'Counts choice, date, and file-input controls implemented as custom div widgets instead of the native HTML elements, weighted by whether they sit on a conversion-critical path (search, filter, checkout, signup). Reports each substituted control with the number of agent actions it costs versus its native equivalent.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/native-control-substitution.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Falsifiable claim: native <select>, <input type="date">, and <input type="file"> are single-call primitives in every mainstream agent toolkit (selectOption, fill, setInputFiles) and are keyboard-operable, so they succeed in one action with no actionability risk. A custom equivalent requires open → wait for popup → scroll the option list into view → locate the option → click, where each step is independently subject to Playwright\'s visible/stable/receives-events gates, and Anthropic documents dropdowns specifically as \'tricky for Claude to manipulate using mouse movements\'. Test: instrument the same form with native vs custom controls and count tool calls and retries to reach an identical value.',
      fix: 'Use the native element wherever the choice fits it: <select> for a list, <input type="date"> for a date, <input type="file"> for an upload — an agent drives each in one call. Where a custom widget is unavoidable, give it the complete APG combobox contract: role="combobox", aria-expanded, aria-controls pointing at an element that exists and carries role="listbox", options carrying role="option", and an aria-activedescendant that resolves.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/native-control-substitution/',
      tags: ['forms', 'aria', 'agent-operability', 'controls', 'accessibility'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: NativeControlSubstitutionAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const s = survey(ctx);

    if (s.controlsSeen === 0 && s.substitutions.length === 0) {
      return this.notApplicable(
        'No choice, date or file control on the scanned pages, native or substituted.',
        EXPECTED,
        'No selection control on the scanned pages',
      );
    }

    const index = s.substitutions.reduce((sum, sub) => sum + sub.weight, 0);
    const found = `${s.substitutions.length} substituted control(s), weighted index ${index}; ${s.native} native`;
    const broken = s.substitutions.filter((sub) => sub.defect);
    const first = s.substitutions[0];

    if (s.substitutions.length === 0) {
      return this.pass(
        `All ${s.native} selection control(s) use the native element, so an agent drives each in one call.`,
        EXPECTED,
        found,
        ctx.pages[0]?.url,
      );
    }

    if (broken.length > 0) {
      return {
        ...this.fail(
          `${broken.length} of ${s.substitutions.length} custom control(s) replace a native element without a usable contract: ${broken[0]!.defect}. An agent has no single-call primitive for the control and no reliable way to open and read its options.`,
          EXPECTED,
          found,
          this.recommendation(),
          broken[0]!.pageUrl,
        ),
        displayValue: found,
      };
    }

    return {
      ...this.warn(
        `${s.substitutions.length} control(s) replace a native element with a custom widget. Each carries the full APG contract, so an agent can drive it — but it still costs open, scroll, locate and click where the native element costs one call.`,
        EXPECTED,
        found,
        this.recommendation(),
        first!.pageUrl,
      ),
      displayValue: found,
    };
  }
}

const EXPECTED =
  'Choice, date and file controls use the native element, or a custom replacement carries the complete APG combobox contract';

/**
 * Is this custom widget's ARIA contract complete enough for an agent to open
 * it, read its options and know which one is active?
 *
 * Returns the shortest decisive defect, or undefined when the contract holds.
 */
function contractDefect(
  page: PageContext,
  $el: ReturnType<PageContext['$']>,
  ids: Set<string>,
): string | undefined {
  const $ = page.$;
  const role = ($el.attr('role') ?? '').toLowerCase();
  if (role !== 'combobox' && role !== 'listbox' && role !== 'menu') {
    return 'the widget declares no combobox, listbox or menu role, so it is not in the accessibility tree as a control at all';
  }
  if ($el.attr('aria-expanded') === undefined) {
    return 'the widget declares no aria-expanded, so an agent cannot tell whether its list is open';
  }

  const controls = ($el.attr('aria-controls') ?? $el.attr('aria-owns') ?? '').trim();
  if (!controls) {
    return 'the widget declares no aria-controls, so an agent cannot find the element holding its options';
  }
  const target = controls.split(/\s+/).find((id) => ids.has(id));
  if (!target) {
    return `aria-controls points at "${controls}", and no element with that id exists`;
  }
  const $popup = $(idSelector(target));
  const popupRole = ($popup.attr('role') ?? '').toLowerCase();
  if (!POPUP_ROLES.has(popupRole)) {
    return `aria-controls points at "${target}", whose role is "${popupRole || 'none'}" rather than a popup role`;
  }
  if ($popup.find('[role="option"], [role="treeitem"], [role="row"]').length === 0) {
    return `the popup "${target}" holds no element with role="option", so an agent has nothing to select`;
  }

  const active = ($el.attr('aria-activedescendant') ?? '').trim();
  if (active && !ids.has(active)) {
    return `aria-activedescendant points at "${active}", and no element with that id exists`;
  }
  return undefined;
}

function survey(ctx: CheckContext): Survey {
  const result: Survey = { controlsSeen: 0, native: 0, substitutions: [] };

  for (const page of ctx.pages) {
    const $ = page.$;
    const ids = collectIds(page);
    const pathWeight = (formAction: string) =>
      CONVERSION_PATH.test(page.url) || CONVERSION_PATH.test(formAction) ? 2 : 1;

    const natives = $(NATIVE_SELECTOR);
    result.native += natives.length;
    result.controlsSeen += natives.length;

    // Every id an aria-controls/aria-owns points at. A popup is the *target* of
    // a substituted control, not a second substituted control of its own.
    const popupIds = new Set<string>();
    $('[aria-controls], [aria-owns]').each((_, el) => {
      for (const attr of ['aria-controls', 'aria-owns']) {
        const value = $(el).attr(attr);
        if (value) for (const id of value.split(/\s+/)) if (id) popupIds.add(id);
      }
    });

    const seen = new Set<unknown>();
    const consider = (el: unknown, kind: Substitution['kind']) => {
      if (seen.has(el)) return;
      seen.add(el);
      const $el = $(el as never);
      const id = $el.attr('id');
      if (id && popupIds.has(id)) return;

      // The region is the field's own grouping context. A native control inside
      // it means the div is decoration around a real element, not a stand-in.
      const $form = $el.closest('form');
      const $region = $form.length > 0 ? $form : $el.parent();
      if ($region.find(NATIVE_SELECTOR).length > 0) return;

      result.controlsSeen += 1;
      const weight = pathWeight($form.attr('action') ?? '');
      const defect =
        kind === 'file'
          ? 'the drop zone has no <input type="file"> anywhere inside it, so an agent has no target for setInputFiles'
          : contractDefect(page, $el, ids);
      result.substitutions.push({
        pageUrl: page.url,
        kind,
        weight,
        ...(defect ? { defect } : {}),
      });
    };

    // (a) Declared widget roles standing in for a native choice control.
    $('[role="combobox"], [role="listbox"], [role="menu"]').each((_, el) => {
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? '';
      // A native <select> may carry role="listbox" redundantly; it is still native.
      if (tag === 'select' || tag === 'input') return;
      consider(el, 'choice');
    });

    // (b) A clickable styled div carrying its value in a hidden or readonly input.
    $('div, span, button, a').each((_, el) => {
      const $el = $(el);
      const className = $el.attr('class') ?? '';
      if (!SUBSTITUTE_CLASS.test(className)) return;
      if (DROP_ZONE_CLASS.test(className)) return;
      const $form = $el.closest('form');
      const $region = $form.length > 0 ? $form : $el.parent();
      const carrier = $region.find('input[type="hidden"], input[readonly]');
      if (carrier.length === 0) return;
      consider(el, 'choice');
    });

    // (c) A drop zone standing in for a file input.
    $('[class]').each((_, el) => {
      const $el = $(el);
      if (!DROP_ZONE_CLASS.test($el.attr('class') ?? '')) return;
      if ($el.find('input[type="file"]').length > 0) return;
      if ($el.parent().find('input[type="file"]').length > 0) return;
      consider(el, 'file');
    });
  }

  return result;
}
