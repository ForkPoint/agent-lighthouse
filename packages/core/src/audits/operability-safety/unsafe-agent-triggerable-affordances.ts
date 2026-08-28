// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 9).
// Evidence dossier: docs/evidence/audits/operability-safety/unsafe-agent-triggerable-affordances.md
//
// SAFETY: markup analysis only. This audit must never fetch a flagged URL —
// following `?action=delete&id=7` would perform the destructive action it
// exists to report. Its test pins that `ctx.fetch` is never called.
//
// Scope note (non-double-counting): `sensitive-paths` asks whether private
// areas are disallowed in robots.txt. This audit asks whether a GET link
// changes state, which is true whether or not the path is disallowed — and the
// disallow is only a partial mitigation, since a user-initiated fetch is
// documented as not necessarily bound by robots.txt.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import { scanReadTheSite, unreadSiteReason } from '../../scan-evidence';

/** URL shapes that change state on the server when they are merely fetched. */
const STATE_VERBS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  {
    pattern:
      /([?&])(action|do|cmd|op|task)=(delete|remove|destroy|cancel|purge|reset|clear|unsubscribe|optout|revoke)\b/i,
    label: 'destructive action parameter',
  },
  { pattern: /add[-_]?to[-_]?cart/i, label: 'cart mutation' },
  {
    pattern: /\/(logout|signout|sign-out|unsubscribe|delete-account|checkout|confirm-order)(\/|$|\?)/i,
    label: 'state-changing path',
  },
  { pattern: /([?&])(confirm|approve|accept|apply)=(1|true|yes)\b/i, label: 'confirmation parameter' },
];

/** Attributes that put a human decision between the click and the action. */
const CONFIRM_ATTRS = ['data-confirm', 'data-turbo-confirm', 'data-method', 'data-remote'];

interface Finding {
  pageUrl: string;
  href: string;
  label: string;
  /** A GET form is replayable, but it is at least a form. */
  kind: 'link' | 'get-form';
  disallowed: boolean;
}

/** Paths robots.txt tells well-behaved crawlers to leave alone. */
function disallowedPaths(ctx: CheckContext): string[] {
  const robots = ctx.rootFiles['/robots.txt'];
  if (robots?.status !== 200 || !robots.body) return [];
  const out: string[] = [];
  for (const line of robots.body.split(/\r?\n/)) {
    const match = /^\s*disallow\s*:\s*(\S+)/i.exec(line);
    if (match) out.push(match[1]!);
  }
  return out;
}

/** True when a human decision, or a POST, sits between the agent and the action. */
function guarded(page: PageContext, node: unknown): boolean {
  const $ = page.$;
  const $n = $(node as never);
  for (const name of CONFIRM_ATTRS) {
    if ($n.attr(name) !== undefined) return true;
  }
  if (/confirm\s*\(/i.test($n.attr('onclick') ?? '')) return true;
  // rel=nofollow is the documented minimum mitigation for exactly this case.
  if (/\bnofollow\b/i.test($n.attr('rel') ?? '')) return true;
  const form = $n.closest('form');
  if (form.length > 0 && (form.attr('method') ?? 'get').toLowerCase() === 'post') return true;
  return false;
}

function survey(ctx: CheckContext): Finding[] {
  const disallowed = disallowedPaths(ctx);
  const findings: Finding[] = [];

  for (const page of ctx.pages) {
    const $ = page.$;
    const consider = (href: string, node: unknown, kind: Finding['kind']) => {
      if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) return;
      const verb = STATE_VERBS.find(({ pattern }) => pattern.test(href));
      if (!verb) return;
      if (kind === 'link' && guarded(page, node)) return;
      let pathname = href;
      try {
        pathname = new URL(href, page.url).pathname;
      } catch {
        // A relative href that does not resolve is still matched on its text.
      }
      findings.push({
        pageUrl: page.url,
        href,
        label: verb.label,
        kind,
        disallowed: disallowed.some((rule) => rule !== '/' && pathname.startsWith(rule)),
      });
    };

    $('a[href]').each((_i, node) => consider($(node as never).attr('href') ?? '', node, 'link'));
    $('form').each((_i, node) => {
      const $n = $(node as never);
      if (($n.attr('method') ?? 'get').toLowerCase() !== 'get') return;
      consider($n.attr('action') ?? '', node, 'get-form');
    });
  }

  return findings;
}

const EXPECTED =
  'No link changes state when it is merely fetched: destructive and mutating operations sit behind a POST, a confirmation affordance, or `rel="nofollow"`';

const SAMPLE = `<!-- A GET is a read. Anything that changes state takes a POST. -->
<form method="post" action="/items/7/delete">
  <button type="submit">Delete item</button>
</form>

<!-- Where the markup cannot change, at minimum keep agents off it. -->
<a href="/items/7?action=delete" rel="nofollow" data-turbo-confirm="Delete item 7?">Delete</a>`;

export class UnsafeAgentTriggerableAffordancesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/unsafe-agent-triggerable-affordances',
    category: 'operability-safety',
    title: 'State-changing links an agent can trigger by fetching them',
    failureTitle: 'State-changing links an agent can trigger by fetching them',
    description:
      'Finds links and GET forms whose URL changes state on the server — delete, cancel, revoke, unsubscribe, logout, add-to-cart, confirm — with no POST, no confirmation affordance and no `rel="nofollow"` in the way. Markup analysis only: a flagged URL is reported, never fetched.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier:
      'docs/evidence/audits/operability-safety/unsafe-agent-triggerable-affordances.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'critical',
    guidance: {
      impact:
        'An agent exploring a site follows links, and a link that changes state changes it on the first fetch — no click, no intent, no confirmation. The same property makes the site a target for indirect prompt injection: text on a page can name the URL, and an agent that reads it as an instruction performs the action with the user\'s own session. Disallowing the path in robots.txt is only a partial mitigation, because a user-initiated fetch is documented as not necessarily bound by robots.txt. The underlying rule is older than agents: a GET is a safe method, meaning it must not have side effects, and everything here is a violation of that rule that agents simply make expensive.',
      fix: 'Move every state change to a POST. Where the markup cannot change immediately, put a confirmation affordance on the link — `data-turbo-confirm`, `data-confirm`, or an `onclick` that calls `confirm()` — and add `rel="nofollow"` so crawlers and agents leave it alone. Do not rely on robots.txt: it constrains well-behaved crawling, not a user-initiated fetch. A GET form whose action mutates is the same defect in a different shape, and it is replayable straight from the query string.',
      code: SAMPLE,
      effort: 'easy',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/unsafe-agent-triggerable-affordances/',
      tags: ['injection-safety', 'http-semantics', 'prompt-injection'],
    },
  };

  private recommendation() {
    return {
      priority: 'critical' as const,
      description: UnsafeAgentTriggerableAffordancesAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its links were not inspected.',
        EXPECTED,
        unreadSiteReason(ctx.evidence),
      );
    }

    if (ctx.pages.length === 0) {
      return this.notApplicable(
        'No page was fetched, so there is no link to inspect.',
        EXPECTED,
        'Nothing scanned',
      );
    }

    const findings = survey(ctx);
    const links = findings.filter((f) => f.kind === 'link');
    const forms = findings.filter((f) => f.kind === 'get-form');
    const disallowed = findings.filter((f) => f.disallowed);
    const details = {
      unguardedLinks: links.length,
      getForms: forms.length,
      disallowedPaths: disallowed.length,
      urls: findings.slice(0, 10).map((f) => f.href),
    };

    if (findings.length === 0) {
      return {
        ...this.pass(
          'No link or GET form on the scanned pages changes state when it is fetched.',
          EXPECTED,
          'No state-changing GET affordance found',
          ctx.pages[0]?.url,
        ),
        details,
      };
    }

    const named = findings.slice(0, 5).map((f) => `${f.href} (${f.label})`).join('; ');
    const more = findings.length > 5 ? `, +${findings.length - 5} more` : '';
    const found = `${links.length} unguarded link(s), ${forms.length} GET form(s): ${named}${more}`;
    // A disallow rule constrains a well-behaved crawler and nothing else. Saying
    // so in the message stops it being read as a fix.
    const robotsClause =
      disallowed.length > 0
        ? ` ${disallowed.length} of them are disallowed in robots.txt, which is a partial mitigation only: a user-initiated fetch is documented as not necessarily bound by robots.txt.`
        : '';

    if (links.length > 0) {
      const worst = links[0]!;
      return {
        ...this.fail(
          `${links.length} link(s) change state on the server when they are merely fetched, with no POST, no confirmation and no \`rel="nofollow"\`. First: ${worst.href} (${worst.label}). An agent following links performs the action, and any text that names the URL can make it do so on a user's session.${robotsClause}`,
          EXPECTED,
          found,
          this.recommendation(),
          worst.pageUrl,
        ),
        displayValue: found,
        details,
      };
    }

    const worst = forms[0]!;
    return {
      ...this.warn(
        `${forms.length} form(s) submit a state change with GET, so the whole operation is replayable from the query string. First: ${worst.href} (${worst.label}).${robotsClause}`,
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
