// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 2).
// Evidence dossier: docs/evidence/audits/operability-safety/ghost-clickable-element-ratio.md
//
// Scope note (non-double-counting): `native-control-substitution` asks whether a
// widget that replaced a native element carries a usable APG contract, and
// `aria-roles` validates the ARIA a widget already declares. Both start from a
// declared control. This audit counts the click targets that declare nothing at
// all, so neither of the others can see them.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { collectPageCss } from '../../gatherers/css-rules';
import { detailLines } from '../../detail-lines';
import { NATIVE_INTERACTIVE, accessibleName, hasClickSignal, isElement } from './_agent-affordances';

/** Below this share of addressable click targets the page fails. */
const RATIO_FLOOR = 0.9;

/**
 * Tags an agent toolkit can address from a snapshot on their own.
 *
 * Narrower than NATIVE_INTERACTIVE, which also names tags that carry an
 * interactive role without being a click target themselves (`label`, `option`,
 * `details`). Those must not count towards the ratio in either direction.
 */
const ADDRESSABLE_TAGS: ReadonlySet<string> = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
]);

/**
 * Tags whose accessible name this audit is entitled to judge.
 *
 * A form control's name usually comes from a `<label for>` association, which
 * accname resolution over the served markup alone does not follow. Reporting a
 * nameless `<input>` would therefore be a guess, so only the tags that name
 * themselves from their own content are held to the empty-name rule.
 */
const NAMED_BY_CONTENT: ReadonlySet<string> = new Set(['a', 'button', 'summary']);

/** Roles that explicitly remove an element from the accessibility tree. */
const NO_ROLE = new Set(['presentation', 'none']);

/** Tags that never reach a snapshot, whatever they carry. */
const NON_RENDERED = new Set(['script', 'style', 'noscript', 'template', 'head']);

interface Ghost {
  pageUrl: string;
  tag: string;
  /** Why it is unaddressable, in the words the report prints. */
  reason: string;
  /** The element's own markers, so a human can find it again. */
  hint: string;
}

interface Survey {
  semantic: number;
  ghosts: Ghost[];
  crossOrigin: number;
}

/** The role attribute, once `presentation`/`none` are treated as no role. */
function declaredRole(attribs: Record<string, string>): string {
  const role = (attribs['role'] ?? '').trim().toLowerCase();
  return NO_ROLE.has(role) ? '' : role;
}

/** True when the element is already out of the accessibility tree. */
function ariaHidden(attribs: Record<string, string>): boolean {
  if (attribs['hidden'] !== undefined) return true;
  return (attribs['aria-hidden'] ?? '').toLowerCase() === 'true';
}

/** A short, stable label for the element, for the evidence line. */
function hintFor(tag: string, attribs: Record<string, string>): string {
  const id = attribs['id'] ? `#${attribs['id']}` : '';
  const cls = attribs['class'] ? `.${attribs['class'].split(/\s+/).filter(Boolean).join('.')}` : '';
  return `<${tag}${id}${cls}>`;
}

/** One ghost as a single report line. */
function describeGhost(ghost: Ghost): string {
  return `${ghost.pageUrl} — ${ghost.hint}: ${ghost.reason}`;
}

async function survey(ctx: CheckContext): Promise<Survey> {
  const result: Survey = { semantic: 0, ghosts: [], crossOrigin: 0 };

  for (const page of ctx.pages) {
    const $ = page.$;
    const css = await collectPageCss(ctx, page);
    result.crossOrigin += css.skippedCrossOrigin.length;

    // Elements already counted on the click-signal arm, so a ghost wrapper
    // holding a ghost inner div is reported once rather than twice.
    const flagged = new Set<unknown>();

    $('body *').each((_i, node) => {
      if (!isElement(node)) return;
      const tag = node.tagName?.toLowerCase() ?? '';
      if (NON_RENDERED.has(tag)) return;
      const attribs = node.attribs ?? {};
      if (ariaHidden(attribs)) return;
      // A hidden input carries no click target and no name of its own.
      if (tag === 'input' && (attribs['type'] ?? '').toLowerCase() === 'hidden') return;

      const role = declaredRole(attribs);
      const addressableTag = ADDRESSABLE_TAGS.has(tag);
      const name = addressableTag || role ? accessibleName(node, $) : '';
      const reasons: string[] = [];

      if (!NATIVE_INTERACTIVE.has(tag) && !role) {
        // The ghost case the accessibility linters cannot reach: an element
        // that behaves like a control and declares nothing at all.
        const ancestorFlagged = $(node)
          .parents()
          .toArray()
          .some((parent) => flagged.has(parent));
        if (!ancestorFlagged && hasClickSignal(node, $, css.rules)) {
          reasons.push('no role');
          flagged.add(node);
        }
      }

      // An anchor without href exposes no link role, so no snapshot entry is
      // ever emitted for it however it is styled.
      if (tag === 'a' && attribs['href'] === undefined) reasons.push('no href');

      if ((NAMED_BY_CONTENT.has(tag) || role) && !name) reasons.push('no accessible name');

      if (reasons.length > 0) {
        result.ghosts.push({
          pageUrl: page.url,
          tag,
          reason: reasons.join(', '),
          hint: hintFor(tag, attribs),
        });
        return;
      }

      if (addressableTag || role) result.semantic += 1;
    });
  }

  return result;
}

const EXPECTED =
  'Every click target on the page declares a native or ARIA role and carries an accessible name, so an agent can address all of them from a snapshot';

const SAMPLE = `<!-- A tile an agent can click: real element, real name. -->
<a class="product-tile" href="/p/42">Ceramic mug, 12oz</a>
<button class="icon-btn" aria-label="Add to cart"><svg aria-hidden="true">…</svg></button>

<!-- Not: no role, no name, no snapshot entry, no way to click it. -->
<div class="product-tile" onclick="goTo(42)"><span>Ceramic mug, 12oz</span></div>
<a class="product-tile">Ceramic mug, 12oz</a>
<button class="icon-btn"><svg>…</svg></button>`;

export class GhostClickableElementRatioAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/ghost-clickable-element-ratio',
    category: 'operability-safety',
    title: 'Ghost-clickable elements: click targets an agent cannot address',
    failureTitle: 'Ghost-clickable elements: click targets an agent cannot address',
    description:
      'Measures the share of on-page click targets that a DOM/accessibility-tree agent cannot address at all: elements that look and behave clickable to a human or a vision model but expose no native or ARIA role and no accessible name, so they never appear in a Playwright-MCP style snapshot. Reported as semantic / (semantic + ghost) over the served markup and its same-origin stylesheets, with the reason each ghost is unaddressable.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/ghost-clickable-element-ratio.md',
    defaultPriority: 'high',
    guidance: {
      impact:
        "An element whose click behaviour comes only from a JS listener on a non-interactive tag, or from cursor:pointer styling, and which carries no role and no accessible name, is omitted from the serialized accessibility snapshot that agent toolkits send to the model. Playwright MCP's default mode is the accessibility tree, not pixel input: every action tool takes an exact element reference from the snapshot, and coordinate clicking exists only behind the optional vision capability. An element absent from the snapshot is therefore unaddressable by the default toolchain — the agent cannot emit a valid click and must fail or guess a URL. The accessibility linters cannot warn about it either: axe's button-name and link-name rules only fire on elements that already declare button or link semantics, so a bare unroled div is invisible to them by construction.",
      fix: 'Make each click target a real control. Use `<a href>` for navigation and `<button>` for actions instead of a div with a click handler; where the markup cannot change, add `role="button"`, `tabindex="0"` and a keyboard handler. Give every icon-only control an accessible name through `aria-label`, `aria-labelledby` or an `<svg><title>`. Never ship an `<a>` without an `href` — it has no link role and no snapshot entry, whatever it is styled to look like.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/ghost-clickable-element-ratio/',
      tags: ['agent-operability', 'accessibility-tree', 'actionability'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: GhostClickableElementRatioAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const s = await survey(ctx);
    const total = s.semantic + s.ghosts.length;
    const partial =
      s.crossOrigin > 0 ? `; ${s.crossOrigin} cross-origin stylesheet not fetched` : '';

    if (total === 0) {
      return {
        ...this.notApplicable(
          'The scanned pages carry no click target of either kind, so there is no ratio to measure.',
          EXPECTED,
          `0 click target(s) found${partial}`,
        ),
        details: { ghostCount: 0, semanticCount: 0 },
      };
    }

    const ratio = s.semantic / total;
    const reasons = [...new Set(s.ghosts.map((g) => g.reason))];
    const found =
      s.ghosts.length === 0
        ? `ratio ${ratio.toFixed(2)} — 0 ghost of ${total} click target(s)${partial}`
        : `ratio ${ratio.toFixed(2)} — ${s.ghosts.length} ghost of ${total} click target(s) (${reasons.join('; ')})${partial}`;
    const details = {
      ghostCount: s.ghosts.length,
      semanticCount: s.semantic,
      ratio: Number(ratio.toFixed(4)),
      // One line per ghost, not the Ghost objects: `details` admits scalars
      // and string arrays only, so an array of objects failed validation and
      // the audit reported nothing on every page that had ghosts to report.
      ghosts: detailLines(s.ghosts, describeGhost, 20),
    };

    if (s.ghosts.length === 0) {
      return {
        ...this.pass(
          `All ${total} click target(s) declare a role and carry an accessible name, so an agent can address each one from a snapshot.`,
          EXPECTED,
          found,
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    const worst = s.ghosts[0]!;
    const evidence = `First: ${worst.hint} (${worst.reason}).`;

    if (ratio < RATIO_FLOOR) {
      return {
        ...this.fail(
          `${s.ghosts.length} of ${total} click target(s) never reach an agent's snapshot, so the agent cannot click them at all. ${evidence}`,
          EXPECTED,
          found,
          this.recommendation(),
          worst.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.warn(
        `${s.ghosts.length} of ${total} click target(s) never reach an agent's snapshot. The page stays above the ${RATIO_FLOOR.toFixed(2)} floor, but each ghost is a control no agent can click. ${evidence}`,
        EXPECTED,
        found,
        this.recommendation(),
        worst.pageUrl,
      ),
      displayValue: found,
      details,
    };
  }
}
