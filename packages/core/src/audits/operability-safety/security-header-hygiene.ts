import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';

/**
 * One homepage response, four security-hygiene signals, no effect on the score.
 *
 * Consolidates the four security-header audits v1 shipped as separate scored
 * checks (hsts-header 8.2, csp-header 8.3, content-type-options 8.4,
 * security-txt 8.7). Each failed sites at priority `high`/`medium` on claims
 * the evidence review could not support: no AI crawler, retrieval pipeline or
 * answer engine documents reading any of these headers, and the
 * security-headers signal grades D with `Recommended tier: delete`
 * (`Consumers: none-known`). Four independent penalties for one unproven
 * mechanism is four times the wrong price.
 *
 * The consolidation keeps the measurement and drops the price. The four
 * signals are reported as a per-signal table, the audit is `informative`
 * (weight 0, excluded from every score), and it never returns `fail` — the
 * approved v2 map row for 8.2 rules the consolidated signal "weight 0, never
 * fails a site". The grade is B: the strongest evidence among the sources is
 * the HTTPS/transport-security signal behind HSTS, which agent protocols do
 * mandate; the header presence itself remains hygiene, not an AI signal.
 *
 * Each source audit's detection is preserved and hardened with the fixes its
 * code review required — max-age parsing instead of presence-only HSTS, meta
 * and report-only CSP delivery, an exact `nosniff` token compare, and a parsed
 * security.txt (Contact + unexpired Expires, legacy location, soft-404 guard).
 * See `docs/evidence/audits/operability-safety/security-header-hygiene.md`.
 */

/** How healthy one signal is. `weak` = present but not doing its job. */
type SignalState = 'ok' | 'weak' | 'missing';

interface SignalRow {
  /** Header or file name, used as the table label. */
  label: string;
  state: SignalState;
  /** What was actually measured, quoted into the table. */
  detail: string;
}

/** The max-age the HSTS guidance asks for: one year, in seconds. */
const MIN_HSTS_MAX_AGE = 31536000;

/** Directives that make a CSP permissive enough not to count as a locked-down policy. */
const PERMISSIVE_CSP_PATTERNS = [/'unsafe-inline'/i, /'unsafe-eval'/i, /default-src\s+\*/i];

const EXPECTED =
  'Strict-Transport-Security with max-age >= 1 year, an enforced Content-Security-Policy, ' +
  'X-Content-Type-Options: nosniff, and a valid /.well-known/security.txt';

/**
 * HSTS (v1 8.2). Presence is not enough: `max-age=0` explicitly disables HSTS
 * and a short max-age gives no meaningful protection window, so both are weak.
 */
function hstsRow(headers: Record<string, string>): SignalRow {
  const label = 'Strict-Transport-Security';
  const value = headers['strict-transport-security'];
  if (!value) return { label, state: 'missing', detail: 'header not present on the homepage response' };

  const match = /max-age\s*=\s*"?(\d+)"?/i.exec(value);
  if (!match) return { label, state: 'weak', detail: `no max-age directive — "${value}"` };

  const maxAge = Number(match[1]);
  if (maxAge === 0) {
    return { label, state: 'weak', detail: `max-age=0 disables HSTS — "${value}"` };
  }
  if (maxAge < MIN_HSTS_MAX_AGE) {
    return {
      label,
      state: 'weak',
      detail: `max-age=${maxAge} is below the recommended ${MIN_HSTS_MAX_AGE} (1 year) — "${value}"`,
    };
  }
  return { label, state: 'ok', detail: `max-age=${maxAge} — "${value}"` };
}

/** Read a `<meta http-equiv="Content-Security-Policy">` policy, if the page ships one. */
function metaCsp(page: PageContext | undefined): string | undefined {
  if (!page) return undefined;
  const $ = page.$;
  let policy: string | undefined;
  $('meta[http-equiv]').each((_i, el) => {
    if (policy) return;
    const equiv = ($(el).attr('http-equiv') ?? '').trim().toLowerCase();
    if (equiv !== 'content-security-policy') return;
    const content = ($(el).attr('content') ?? '').trim();
    if (content) policy = content;
  });
  return policy;
}

/** Trim a policy to a table-sized excerpt. */
function excerpt(policy: string): string {
  return policy.length > 120 ? `${policy.slice(0, 120)}...` : policy;
}

/**
 * CSP (v1 8.3). Accepts the two valid delivery methods (response header and
 * `<meta http-equiv>`), treats report-only as a partial rollout, and refuses
 * to call a wide-open policy equivalent to a locked-down one.
 */
function cspRow(headers: Record<string, string>, page: PageContext | undefined): SignalRow {
  const label = 'Content-Security-Policy';
  const header = headers['content-security-policy'];
  const meta = metaCsp(page);
  // `??` kept an empty header, so a server that sets the field to "" shadowed
  // a perfectly good meta policy and the site was reported as unprotected.
  const enforced = header || meta;
  const source = header ? 'response header' : 'meta http-equiv tag';

  if (enforced) {
    const permissive = PERMISSIVE_CSP_PATTERNS.some((re) => re.test(enforced));
    return {
      label,
      state: permissive ? 'weak' : 'ok',
      detail: permissive
        ? `permissive policy (${source}) — "${excerpt(enforced)}"`
        : `enforced via ${source} — "${excerpt(enforced)}"`,
    };
  }

  const reportOnly = headers['content-security-policy-report-only'];
  if (reportOnly) {
    return {
      label,
      state: 'weak',
      detail: `report-only, nothing is enforced — "${excerpt(reportOnly)}"`,
    };
  }

  return { label, state: 'missing', detail: 'no policy in a header or a meta http-equiv tag' };
}

/**
 * X-Content-Type-Options (v1 8.4). Exact token compare: the v1 substring match
 * passed on values like `no-nosniff-here`. nosniff hardens clients against MIME
 * confusion; it does not fix a wrong Content-Type — that is the
 * machine-discovery/ai-file-delivery audit's job.
 */
function nosniffRow(headers: Record<string, string>): SignalRow {
  const label = 'X-Content-Type-Options';
  const value = headers['x-content-type-options'];
  if (!value) return { label, state: 'missing', detail: 'header not present on the homepage response' };
  if (value.trim().toLowerCase() === 'nosniff') return { label, state: 'ok', detail: 'nosniff' };
  return { label, state: 'weak', detail: `present but not "nosniff" — "${value}"` };
}

/** Read the first value of an RFC 9116 field, ignoring case and comment lines. */
function securityTxtField(body: string, field: string): string | undefined {
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    if (line.slice(0, sep).trim().toLowerCase() !== field) continue;
    const value = line.slice(sep + 1).trim();
    if (value) return value;
  }
  return undefined;
}

/** A 200 that is really the SPA HTML fallback, not a text file. */
function looksLikeHtml(body: string): boolean {
  const head = body.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.includes('<html');
}

/**
 * security.txt (v1 8.7). The v1 check was status-only, so an SPA soft-404 and
 * an expired file both passed. RFC 9116 requires Contact and Expires, and an
 * expired file must be treated as invalid.
 */
function securityTxtRow(ctx: CheckContext, now: Date): SignalRow {
  const label = 'security.txt';
  const wellKnown = ctx.rootFiles['/.well-known/security.txt'];
  // RFC 9116 keeps the top-level path as a legacy fallback; the scanner only
  // fetches the well-known location today, so this resolves whenever a caller
  // supplies it.
  const legacy = ctx.rootFiles['/security.txt'];
  const file = wellKnown?.status === 200 ? wellKnown : legacy?.status === 200 ? legacy : undefined;
  const path = file && file === legacy ? '/security.txt (legacy location)' : '/.well-known/security.txt';

  if (!file) {
    const status = wellKnown?.status ?? legacy?.status;
    return {
      label,
      state: 'missing',
      detail: status ? `/.well-known/security.txt returned ${status}` : 'not fetched or not present',
    };
  }

  if (looksLikeHtml(file.body)) {
    return { label, state: 'weak', detail: `${path} returned 200 but the body is HTML (soft-404)` };
  }

  const contact = securityTxtField(file.body, 'contact');
  if (!contact) return { label, state: 'weak', detail: `${path} has no Contact field (RFC 9116 requires it)` };

  const expires = securityTxtField(file.body, 'expires');
  if (!expires) return { label, state: 'weak', detail: `${path} has no Expires field (RFC 9116 requires it)` };

  const expiresAt = new Date(expires);
  if (Number.isNaN(expiresAt.getTime())) {
    return { label, state: 'weak', detail: `${path} has an unparseable Expires value — "${expires}"` };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { label, state: 'weak', detail: `${path} expired on ${expires}` };
  }

  return { label, state: 'ok', detail: `${path} with Contact and Expires ${expires}` };
}

/** Render the per-signal table shown in the report. */
function renderTable(rows: SignalRow[]): string {
  return rows.map((r) => `${r.label}: ${r.state} — ${r.detail}`).join('\n');
}

export class SecurityHeaderHygieneAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/security-header-hygiene',
    category: 'operability-safety',
    title: 'Security header hygiene',
    failureTitle: 'Security header hygiene',
    description:
      'Reports four transport- and disclosure-hygiene signals in one place: Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options: nosniff, and /.well-known/security.txt. No AI crawler, retrieval pipeline or answer engine is documented to read any of them, so this audit is informative only — it carries weight 0 and never affects your score.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('B', 'informative'),
    evidenceGrade: 'B',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/security-header-hygiene.md',
    defaultPriority: 'low',
    guidance: {
      impact:
        'General web-security hygiene, reported for completeness. These are browser-enforced defence-in-depth mechanisms whose consumers are browsers and human users; server-side AI crawlers implement none of them, and Google states there are no additional technical requirements for AI features beyond ordinary Search eligibility. A strict CSP frame-ancestors policy can even prevent a page being embedded in an agent surface, so more headers is not automatically more agent-readiness.',
      fix: 'Treat this as a hygiene checklist, not an AI-readiness gate: set Strict-Transport-Security with a max-age of at least one year, enforce a Content-Security-Policy (header or meta http-equiv; report-only is a rollout stage, not an enforced policy), send X-Content-Type-Options: nosniff, and publish an RFC 9116 security.txt with a Contact field and an Expires date in the future. Nothing here moves your score in either direction.',
      code: [
        'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
        "Content-Security-Policy: default-src 'self'",
        'X-Content-Type-Options: nosniff',
        '',
        '# /.well-known/security.txt',
        'Contact: mailto:security@example.com',
        'Expires: 2027-12-31T23:59:59.000Z',
      ].join('\n'),
      effort: 'trivial',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers',
      tags: ['security', 'headers', 'hygiene'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    // No page response means the headers were never observed. v1 reported that
    // as a confident "header is missing" failure; "could not measure" is the
    // honest answer.
    if (!page) {
      return this.notApplicable(
        'No page response was captured, so the response headers could not be measured.',
        EXPECTED,
        'No homepage response',
      );
    }

    const headers = page.fetchResult.headers ?? {};
    const rows: SignalRow[] = [
      hstsRow(headers),
      cspRow(headers, page),
      nosniffRow(headers),
      securityTxtRow(ctx, new Date()),
    ];
    const table = renderTable(rows);
    const healthy = rows.filter((r) => r.state === 'ok');

    if (healthy.length === rows.length) {
      return this.pass(
        'All four security-hygiene signals are in place.',
        EXPECTED,
        table,
        page.url,
      );
    }

    // Deliberately never `fail`: this audit reports hygiene, it does not judge
    // the site. The absent signals are named so the table is self-explanatory.
    const absent = rows.filter((r) => r.state !== 'ok').map((r) => r.label);
    return this.warn(
      `${healthy.length} of ${rows.length} security-hygiene signals are in place — ${absent.join(', ')} ${absent.length === 1 ? 'needs' : 'need'} attention. This is advisory only and does not affect your score.`,
      EXPECTED,
      table,
      { priority: 'low' },
      page.url,
    );
  }
}
