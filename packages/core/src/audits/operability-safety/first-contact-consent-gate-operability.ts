// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 13).
// Evidence dossier: docs/evidence/audits/operability-safety/first-contact-consent-gate-operability.md
//
// Informative by grade: the evidence is a plausible convention rather than a
// documented consumer behaviour, so this audit reports an action cost and never
// moves the score. Grade C in the `scored` tier is unregistrable — see
// `sunset.test.ts`, which ties a non-scored tier to weight 0.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { accessibleName, isElement } from './_agent-affordances';

/** Consent platforms, by the marker they leave in the served HTML. */
const PLATFORMS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'OneTrust', pattern: /onetrust|cookielaw\.org|otSDKStub/i },
  { name: 'Cookiebot', pattern: /cookiebot/i },
  { name: 'Didomi', pattern: /didomi/i },
  { name: 'Quantcast Choice', pattern: /quantcast|choice\.consensu/i },
  { name: 'Osano', pattern: /osano/i },
  { name: 'Usercentrics', pattern: /usercentrics/i },
  { name: 'Sourcepoint', pattern: /sourcepoint|sp-prod|_sp_/i },
  { name: 'Iubenda', pattern: /iubenda/i },
  { name: 'CookieYes', pattern: /cookieyes/i },
  { name: 'IAB TCF', pattern: /__tcfapi/i },
];

/** Ids and classes a consent layer's root carries. */
const DIALOG_ROOT = /onetrust|cookie-?banner|cookie-?consent|cookie-?notice|cc-banner|consent|didomi|usercentrics|gdpr/i;

/** Labels a one-click refusal carries. */
const REJECT_LABEL = /reject|decline|refuse|deny|only\s+(?:necessary|essential)|(?:necessary|essential)\s+only|continue\s+without/i;

/** Labels a multi-step refusal journey starts with. */
const PREFERENCES_LABEL = /manage|preferences|settings|customi[sz]e|options|choices|more\s+info/i;

/** Text below this length is an interstitial, not the page a reader came for. */
const MAIN_TEXT_FLOOR = 200;

interface Gate {
  pageUrl: string;
  platform: string;
  contentBehindGate: boolean;
  crossOriginDialog: boolean;
  mainHidden: boolean;
  /** Clicks to refuse: 1 for a direct control, 2 behind a preferences journey. */
  actionCost: number;
  /** Controls that carry no accessible name, so no snapshot can address them. */
  unnamedControls: number;
}

/** The consent platform whose marker appears in the served HTML, if any. */
function detectPlatform(page: PageContext): string {
  const html = page.fetchResult.body ?? '';
  for (const { name, pattern } of PLATFORMS) {
    if (pattern.test(html)) return name;
  }
  return '';
}

/** True when the page a reader came for is present behind the layer. */
function contentPresent(page: PageContext): boolean {
  const $ = page.$;
  const main = $('main, [role="main"], article').first();
  const text = main.text().replace(/\s+/g, ' ').trim();
  if (text.length >= MAIN_TEXT_FLOOR) return true;
  // A JSON-LD main entity proves the page exists even when its body is short.
  return page.jsonLd.length > 0 && text.length > 0;
}

function surveyPage(page: PageContext): Gate | null {
  const platform = detectPlatform(page);
  if (!platform) return null;
  const $ = page.$;

  const gate: Gate = {
    pageUrl: page.url,
    platform,
    contentBehindGate: contentPresent(page),
    crossOriginDialog: false,
    mainHidden: false,
    actionCost: 0,
    unnamedControls: 0,
  };

  const origin = new URL(page.url).origin;
  $('iframe[src]').each((_i, node) => {
    const $n = $(node as never);
    const marker = `${$n.attr('id') ?? ''} ${$n.attr('class') ?? ''} ${$n.attr('title') ?? ''} ${$n.attr('src') ?? ''}`;
    if (!DIALOG_ROOT.test(marker)) return;
    try {
      if (new URL($n.attr('src') ?? '', page.url).origin !== origin) gate.crossOriginDialog = true;
    } catch {
      // An unparseable src cannot be shown to be cross-origin, so it is not
      // reported as one.
    }
  });

  gate.mainHidden =
    $('main[aria-hidden="true"], [role="main"][aria-hidden="true"], main[inert], [role="main"][inert]')
      .length > 0;

  // The refusal path, read from the controls the layer renders in the top
  // document. A control inside a cross-origin iframe is not readable at all,
  // which is the point of the crossOriginDialog arm.
  let direct = false;
  let viaPreferences = false;
  $('button, a[href], [role="button"], input[type="button"], input[type="submit"]').each(
    (_i, node) => {
      if (!isElement(node)) return;
      const attribs = node.attribs ?? {};
      const name = accessibleName(node, $ as never);
      const marker = `${name} ${attribs['id'] ?? ''} ${attribs['class'] ?? ''} ${attribs['value'] ?? ''}`;
      const inDialog =
        DIALOG_ROOT.test(marker) ||
        $(node as never).closest('[id], [class]').filter((_j, ancestor) => {
          const a = (ancestor as { attribs?: Record<string, string> }).attribs ?? {};
          return DIALOG_ROOT.test(`${a['id'] ?? ''} ${a['class'] ?? ''}`);
        }).length > 0;
      if (!inDialog) return;
      if (!name) gate.unnamedControls += 1;
      if (REJECT_LABEL.test(marker)) direct = true;
      else if (PREFERENCES_LABEL.test(marker)) viaPreferences = true;
    },
  );

  gate.actionCost = direct ? 1 : viaPreferences ? 2 : 0;
  return gate;
}

const EXPECTED =
  'The consent layer leaves the page intact behind it, renders its accept and reject controls as named elements in the top document, and lets a refusal through in one click';

const SAMPLE = `<!-- The layer an agent can get past: named controls, top document, one click to refuse. -->
<div id="cookie-banner" role="dialog" aria-label="Cookie preferences">
  <button id="accept-all">Accept all cookies</button>
  <button id="reject-all">Reject all cookies</button>
</div>
<main><article><!-- the page is here the whole time --></article></main>`;

export class FirstContactConsentGateOperabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/first-contact-consent-gate-operability',
    category: 'operability-safety',
    title: 'First-contact consent gate: cost to get past it',
    failureTitle: 'First-contact consent gate: cost to get past it',
    description:
      'Reports the cold-session consent layer an agent meets before any task work: whether the primary content exists in the served HTML behind it, whether the accept and reject controls carry accessible names and live in the top document rather than a cross-origin iframe, whether main content is hidden from the accessibility tree while the layer is open, and how many clicks a refusal costs. Diagnostic only — it never moves the score.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier:
      'docs/evidence/audits/operability-safety/first-contact-consent-gate-operability.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'low',
    guidance: {
      impact:
        "An agent arriving with no cookies spends its first actions on the consent layer, before any step of the actual task. Three properties decide whether it can. A layer rendered inside a cross-origin iframe is invisible to a DOM-text extractor that reads only the top document, so the agent's text and its screenshot disagree and it acts on content it cannot actually see. Accept and reject controls built as unroled, unnamed divs are unaddressable in a snapshot for the same reason a ghost-clickable div is. And main content set `inert` or `aria-hidden=\"true\"` while the layer is open empties every snapshot until the layer is gone — axe's own guidance is that `aria-hidden` removes the element and all its children from the accessibility API. The evidence here is convention rather than documented consumer behaviour, which is why this audit reports rather than scores.",
      fix: 'Render the consent layer in the top document, not in a cross-origin iframe. Give the accept and reject controls real `<button>` elements with visible text, and offer a one-click refusal beside the one-click acceptance rather than sending a refusal through a preferences journey. Leave the page itself in the DOM behind the layer, and do not set `inert` or `aria-hidden="true"` on main content — use a focus trap inside the dialog instead.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/first-contact-consent-gate-operability/',
      tags: ['agent-operability', 'consent', 'first-contact'],
    },
  };

  private recommendation() {
    return {
      priority: 'low' as const,
      description: FirstContactConsentGateOperabilityAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const gates = ctx.pages.map(surveyPage).filter((gate): gate is Gate => gate !== null);

    if (gates.length === 0) {
      return {
        ...this.notApplicable(
          'No consent platform was detected in the served HTML, so an agent meets no gate on first contact.',
          EXPECTED,
          'No consent manager detected',
        ),
        details: { actionCost: 0 },
      };
    }

    const gate = gates[0]!;
    const details = {
      platform: gate.platform,
      actionCost: gate.actionCost,
      contentBehindGate: gate.contentBehindGate,
      crossOriginDialog: gate.crossOriginDialog,
      mainHidden: gate.mainHidden,
      unnamedControls: gate.unnamedControls,
    };

    const cost =
      gate.actionCost === 0
        ? 'no refusal control found in the top document'
        : `${gate.actionCost} click(s) to refuse`;
    const found = `${gate.platform}; ${cost}; content ${gate.contentBehindGate ? 'present' : 'absent'} behind the gate`;

    const defects: string[] = [];
    if (!gate.contentBehindGate) {
      defects.push(
        'the page behind the layer holds no main landmark text and no main entity, so an agent that dismisses the gate still has nothing to read',
      );
    }
    if (gate.crossOriginDialog) {
      defects.push(
        'the layer is rendered in a cross-origin iframe, so its controls are unreachable to an extractor that reads the top document',
      );
    }
    if (gate.mainHidden) {
      defects.push(
        'main content is marked aria-hidden or inert while the layer is open, so every snapshot is empty until it is dismissed',
      );
    }
    if (gate.unnamedControls > 0) {
      defects.push(`${gate.unnamedControls} control(s) in the layer carry no accessible name`);
    }
    if (gate.actionCost > 1) {
      defects.push('refusing takes more than one click, because the only direct control accepts');
    }

    if (defects.length === 0) {
      return {
        ...this.pass(
          `${gate.platform} gates the first request. The page is present behind it, its controls are named and in the top document, and a refusal costs ${gate.actionCost} click(s).`,
          EXPECTED,
          found,
          gate.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.warn(
        `${gate.platform} gates the first request and ${defects.join('; ')}.`,
        EXPECTED,
        found,
        this.recommendation(),
        gate.pageUrl,
      ),
      displayValue: found,
      details,
    };
  }
}
