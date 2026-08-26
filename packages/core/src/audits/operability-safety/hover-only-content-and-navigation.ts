// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 4).
// Evidence dossier: docs/evidence/audits/operability-safety/hover-only-content-and-navigation.md
//
// Scope note (non-double-counting): `content-extraction/css-hidden-ghost-content`
// measures text that a stylesheet hides from a human but leaves in the byte
// stream, and fails on its size. This audit is the mirror case: markup that is
// hidden from the machine until a pointer arrives, and it fails on the
// destinations lost, not on the bytes.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { collectPageCss, type CssRule } from '../../gatherers/css-rules';

/** Declarations that bring a hidden element back into view. */
const REVEALING = [
  /display\s*:\s*(?!none)[a-z-]+/i,
  /visibility\s*:\s*visible/i,
  /opacity\s*:\s*(?:0?\.[1-9]\d*|[1-9]\d*)/i,
  /max-height\s*:\s*(?!0\b)[^;]+/i,
];

/** Declarations that keep an element out of view at rest. */
const HIDING = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)/i,
  /max-height\s*:\s*0\b/i,
];

/** Selector fragments that reveal an element without a pointer. */
const KEYBOARD_STATE = /:focus-within|:focus-visible|:focus|\[aria-expanded=["']?true["']?\]|\[data-open\b|\[open\b/i;

/** Class names a hover card carries. */
const HOVER_CARD_CLASS = /tooltip|popover|hovercard/i;

/** Tags whose `title` attribute is a label the platform already exposes. */
const TITLE_EXEMPT = new Set([
  'input',
  'select',
  'textarea',
  'button',
  'option',
  'optgroup',
  'iframe',
  'frame',
  'link',
  'abbr',
]);

/** Inline handlers that make a JS-toggled menu plausible. */
const HANDLER_ATTRS = ['onclick', 'onkeydown', 'onmousedown', 'onfocus'];

/** How many destination URLs to name before the list is cut. */
const MAX_URLS = 5;

interface Menu {
  pageUrl: string;
  selector: string;
  destinations: string[];
}

interface Survey {
  menus: Menu[];
  titleOnly: number;
  titleSample: string;
  hoverCards: number;
  hoverCardSample: string;
  /** True when at least one `:hover` reveal rule was seen anywhere. */
  sawHoverRule: boolean;
  crossOrigin: string[];
}

/** The selector with every pointer- and state-pseudo removed. */
function stripState(selector: string): string {
  return selector
    .replace(/:hover/gi, '')
    .replace(/:focus-within|:focus-visible|:focus/gi, '')
    .replace(/\[aria-expanded=["']?true["']?\]/gi, '')
    .replace(/\[data-open[^\]]*\]/gi, '')
    .replace(/\[open[^\]]*\]/gi, '')
    .trim();
}

function reveals(rule: CssRule): boolean {
  return REVEALING.some((pattern) => pattern.test(rule.declarations));
}

function hides(rule: CssRule): boolean {
  return HIDING.some((pattern) => pattern.test(rule.declarations));
}

/** Elements a rule matches, treating an uncompilable selector as matching none. */
function match($: CheckContext['pages'][number]['$'], selector: string): unknown[] {
  if (!selector) return [];
  try {
    return $(selector).toArray();
  } catch {
    return [];
  }
}

async function survey(ctx: CheckContext): Promise<Survey> {
  const result: Survey = {
    menus: [],
    titleOnly: 0,
    titleSample: '',
    hoverCards: 0,
    hoverCardSample: '',
    sawHoverRule: false,
    crossOrigin: [],
  };

  for (const page of ctx.pages) {
    const $ = page.$;
    const css = await collectPageCss(ctx, page);
    result.crossOrigin.push(...css.skippedCrossOrigin);

    // Elements a keyboard or an ARIA state can reveal without a pointer.
    const keyboardReachable = new Set<unknown>();
    for (const rule of css.rules) {
      if (!KEYBOARD_STATE.test(rule.selector) || !reveals(rule)) continue;
      for (const el of match($, stripState(rule.selector))) keyboardReachable.add(el);
    }

    // Elements a stylesheet keeps out of view while nothing is hovered.
    const hiddenAtRest = new Set<unknown>();
    for (const rule of css.rules) {
      if (/:hover|:focus/i.test(rule.selector) || !hides(rule)) continue;
      for (const el of match($, rule.selector)) hiddenAtRest.add(el);
    }

    for (const rule of css.rules) {
      if (!/:hover/i.test(rule.selector) || !reveals(rule)) continue;
      result.sawHoverRule = true;
      for (const el of match($, stripState(rule.selector))) {
        if (!hiddenAtRest.has(el)) continue;
        if (keyboardReachable.has(el)) continue;
        if (result.menus.some((m) => m.selector === rule.selector)) continue;

        const $el = $(el as never);
        const id = $el.attr('id') ?? '';
        // A trigger that declares the menu's state, or that carries a handler,
        // means a path other than the pointer plausibly exists. The audit does
        // not run scripts, so it reports what it can see and stops there.
        const nearby = [...$el.prevAll().toArray(), ...$el.parent().toArray(), ...$el.parent().prevAll().toArray()];
        const declared = nearby.some((node) => {
          const $n = $(node as never);
          if ($n.attr('aria-expanded') !== undefined) return true;
          if ($n.attr('aria-haspopup') !== undefined) return true;
          if (HANDLER_ATTRS.some((name) => $n.attr(name) !== undefined)) return true;
          return false;
        });
        const controlled = id !== '' && $(`[aria-controls~="${id}"]`).length > 0;
        if (declared || controlled) continue;

        const destinations = $el
          .find('a[href]')
          .toArray()
          .map((node) => $(node as never).attr('href') ?? '')
          .filter(Boolean);
        if (destinations.length === 0) continue;

        result.menus.push({ pageUrl: page.url, selector: rule.selector, destinations });
      }
    }

    // Information that lives only in a tooltip the platform draws on hover.
    $('[title]').each((_i, node) => {
      const $n = $(node as never);
      const tag = (node as { tagName?: string }).tagName?.toLowerCase() ?? '';
      if (TITLE_EXEMPT.has(tag)) return;
      const title = ($n.attr('title') ?? '').trim();
      if (!title) return;
      // A title that repeats the element's own text adds nothing and loses
      // nothing, so it is not a finding.
      if ($n.text().replace(/\s+/g, ' ').trim().includes(title)) return;
      result.titleOnly += 1;
      if (!result.titleSample) result.titleSample = title;
    });

    // A hover card no focusable element points at is unreachable by name.
    $('[class]').each((_i, node) => {
      const $n = $(node as never);
      const cls = $n.attr('class') ?? '';
      if (!HOVER_CARD_CLASS.test(cls)) return;
      const id = $n.attr('id') ?? '';
      if (id && $(`[aria-describedby~="${id}"], [aria-labelledby~="${id}"]`).length > 0) return;
      result.hoverCards += 1;
      if (!result.hoverCardSample) result.hoverCardSample = `.${cls.split(/\s+/)[0]}`;
    });
  }

  return result;
}

const EXPECTED =
  'Every navigation destination and every piece of information is reachable without a pointer hover: a focus or ARIA-state path reveals each submenu, and no content lives only in a `title` attribute or a hover card';

const SAMPLE = `/* Give the keyboard — and every agent — the same path the pointer has. */
.nav li:hover .submenu,
.nav li:focus-within .submenu,
.nav li [aria-expanded="true"] + .submenu { display: block }`;

export class HoverOnlyContentAndNavigationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/hover-only-content-and-navigation',
    category: 'operability-safety',
    title: 'Hover-only navigation and content',
    failureTitle: 'Hover-only navigation and content',
    description:
      'Detects navigation subtrees and information that exist in the DOM only while a pointer hovers — `:hover`-revealed submenus with no focus or `aria-expanded` equivalent, and content carried solely in `title` attributes or hover cards. Reports each destination URL an agent never discovers.',
    scoreDisplayMode: 'binary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/hover-only-content-and-navigation.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'high',
    guidance: {
      impact:
        "A submenu revealed only by an ancestor `:hover` rule is `display:none` or `visibility:hidden` in the resting DOM, and Playwright's actionability contract defines such an element as not visible — so every Playwright-derived agent refuses to click it, and the snapshot serializer omits it entirely. The agent never learns those destinations exist: it does not fail loudly, it simply reports that the site has no page for what the user asked. WebSuite measures the information half of the same defect at 0% success for tooltip-based retrieval across both agents it tested. The fix is cheap and it is the same fix keyboard users need, which is why it is worth doing once.",
      fix: 'Add a keyboard and ARIA path beside the pointer path. Put `:focus-within` (or a `[aria-expanded="true"]` selector driven by a real toggle) on the same rule that `:hover` triggers, so the submenu is revealed by focus as well as by a pointer. Give the trigger `aria-expanded` and `aria-controls` pointing at the submenu. Move anything a `title` attribute carries into visible text or an `aria-describedby` target, and give every hover card an id that a focusable element references.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/hover-only-content-and-navigation/',
      tags: ['agent-operability', 'navigation', 'discoverability'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: HoverOnlyContentAndNavigationAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const s = await survey(ctx);
    const partial =
      s.crossOrigin.length > 0
        ? `; ${s.crossOrigin.length} cross-origin stylesheet not fetched, so the CSS read is partial`
        : '';
    const details = {
      hoverMenus: s.menus.length,
      titleOnly: s.titleOnly,
      hoverCards: s.hoverCards,
      lostDestinations: s.menus.reduce((n, m) => n + m.destinations.length, 0),
    };

    if (s.menus.length === 0 && s.titleOnly === 0 && s.hoverCards === 0) {
      if (!s.sawHoverRule && s.crossOrigin.length === 0) {
        return {
          ...this.notApplicable(
            'No stylesheet rule reveals anything on hover, and no content is carried by a `title` attribute or a hover card.',
            EXPECTED,
            'No hover-revealed markup on the scanned pages',
          ),
          details,
        };
      }
      return {
        ...this.pass(
          'Every hover-revealed submenu also has a focus or ARIA-state path, and no content lives only in a `title` attribute or a hover card.',
          EXPECTED,
          `0 hover-only submenu(s), 0 title-only string(s), 0 unreferenced hover card(s)${partial}`,
          ctx.pages[0]?.url,
        ),
        details,
      };
    }

    const urls = s.menus.flatMap((m) => m.destinations);
    const shown = urls.slice(0, MAX_URLS);
    const more = urls.length > shown.length ? `, +${urls.length - shown.length} more` : '';
    const parts: string[] = [];
    if (s.menus.length > 0) {
      parts.push(
        `${s.menus.length} hover-only submenu(s) hiding ${urls.length} destination(s): ${shown.join(', ')}${more}`,
      );
    }
    if (s.titleOnly > 0) parts.push(`${s.titleOnly} title-only string(s)`);
    if (s.hoverCards > 0) parts.push(`${s.hoverCards} unreferenced hover card(s)`);
    const found = `${parts.join('; ')}${partial}`;

    if (s.menus.length > 0) {
      const first = s.menus[0]!;
      return {
        ...this.fail(
          `${s.menus.length} submenu(s) are revealed only by \`:hover\`, with no focus path and no \`aria-expanded\` trigger, so ${urls.length} destination(s) never appear in an agent's view of the site. First: \`${first.selector}\`.`,
          EXPECTED,
          found,
          this.recommendation(),
          first.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    const sample = s.titleSample || s.hoverCardSample;
    return {
      ...this.warn(
        `Navigation is reachable, but ${s.titleOnly + s.hoverCards} piece(s) of information are drawn only on hover, so an agent never reads them. First: "${sample}".`,
        EXPECTED,
        found,
        this.recommendation(),
        ctx.pages[0]?.url,
      ),
      displayValue: found,
      details,
    };
  }
}
