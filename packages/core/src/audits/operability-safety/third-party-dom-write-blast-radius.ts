// Graduated from proposal 2026-08-23 (Plan 5b, Wave A, Task 8).
// Evidence dossier: docs/evidence/audits/operability-safety/third-party-dom-write-blast-radius.md
//
// Scope note: this is the only audit that reads a Content-Security-Policy.
// `security-header-hygiene` used to report one too, until the contradiction
// sweep of 2026-08-24 narrowed it to security.txt on grade-D evidence. The
// question here was never the header's well-formedness: it is how many separate
// companies can write text into the DOM an agent reads.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import { weightForGrade } from '../../scorer';
import type { CheckContext, PageContext } from '../../check-context';
import {
  scanReadTheSite,
  unreadSiteReason,
  scanReadPageText,
  unreadPageTextReason,
} from '../../scan-evidence';

/** Two-label public suffixes common enough to matter, in place of a bundled PSL. */
const MULTI_SUFFIX = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au',
  'co.nz', 'co.jp', 'co.za', 'com.br', 'com.mx', 'co.in', 'com.sg', 'com.tr',
]);

/** Sources that allow a whole scheme or every host, so they constrain nothing. */
const SCHEME_WIDE = /^(\*|https?:|data:|blob:|\*\.\w+)$/i;

/** A frame smaller than this in either direction is a pixel, not a surface. */
const PIXEL_SIZE = 50;

/** How many origins to name before the list is cut. */
const MAX_NAMED = 12;

/** eTLD+1, using a short suffix list rather than a bundled PSL snapshot. */
function registrable(host: string): string {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return MULTI_SUFFIX.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

interface Frame {
  domain: string;
  width: string;
  height: string;
}

interface Survey {
  /** Registrable domains that ship executable code into the page. */
  origins: Map<string, { integrity: boolean }>;
  frames: Frame[];
  /** True when a CSP actually limits which code may run. */
  constrained: boolean;
  /** How the CSP was delivered, for the evidence line. */
  cspSource: string;
}

/** The CSP the page ships, from the header first and the meta tag second. */
function policyFor(page: PageContext): { policy: string; source: string } {
  const headers = page.fetchResult.headers ?? {};
  const header = headers['content-security-policy'] ?? headers['Content-Security-Policy'] ?? '';
  if (header) return { policy: header, source: 'response header' };
  const meta = page
    .$('meta[http-equiv]')
    .filter((_i, node) => {
      const value = (node as { attribs?: Record<string, string> }).attribs?.['http-equiv'] ?? '';
      return value.toLowerCase() === 'content-security-policy';
    })
    .first()
    .attr('content');
  return meta ? { policy: meta, source: 'meta http-equiv' } : { policy: '', source: 'none' };
}

/**
 * Does this policy actually limit which script may run?
 *
 * A nonce, a hash or `strict-dynamic` does. A host allowlist does. A policy
 * whose sources include a bare scheme, a wildcard, or `'unsafe-inline'` with no
 * nonce or hash beside it does not — it is present, and it is decorative.
 */
function constrains(policy: string): boolean {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift()?.toLowerCase();
    if (name) directives.set(name, tokens);
  }
  const sources = directives.get('script-src') ?? directives.get('default-src');
  if (!sources || sources.length === 0) return false;

  const bare = sources.map((s) => s.replace(/^'|'$/g, '').toLowerCase());
  const nonceOrHash = bare.some((s) => /^(nonce-|sha(256|384|512)-)/.test(s));
  const strictDynamic = bare.includes('strict-dynamic');
  const wide = bare.some((s) => SCHEME_WIDE.test(s));
  const unsafeInline = bare.includes('unsafe-inline') && !nonceOrHash && !strictDynamic;
  if (wide || unsafeInline) return false;

  const hostSource = bare.some((s) => s === 'self' || /\./.test(s));
  return nonceOrHash || strictDynamic || hostSource;
}

function survey(ctx: CheckContext): Survey {
  const result: Survey = {
    origins: new Map(),
    frames: [],
    constrained: true,
    cspSource: 'none',
  };
  let anyPage = false;

  for (const page of ctx.pages) {
    const $ = page.$;
    const pageDomain = registrable(new URL(page.url).hostname);
    const { policy, source } = policyFor(page);
    if (!anyPage || result.cspSource === 'none') result.cspSource = source;
    anyPage = true;
    // One weak page is enough: an agent reads whichever page it landed on.
    if (!constrains(policy)) result.constrained = false;

    $('script[src], link[rel="stylesheet"][href]').each((_i, node) => {
      const $n = $(node as never);
      const href = $n.attr('src') ?? $n.attr('href') ?? '';
      let domain: string;
      try {
        domain = registrable(new URL(href, page.url).hostname);
      } catch {
        return;
      }
      if (!domain || domain === pageDomain) return;
      const integrity = ($n.attr('integrity') ?? '') !== '';
      const existing = result.origins.get(domain);
      // One resource without integrity is enough to leave the origin unpinned.
      result.origins.set(domain, { integrity: (existing?.integrity ?? true) && integrity });
    });

    $('iframe[src]').each((_i, node) => {
      const $n = $(node as never);
      let domain: string;
      try {
        domain = registrable(new URL($n.attr('src') ?? '', page.url).hostname);
      } catch {
        return;
      }
      if (!domain || domain === pageDomain) return;
      if ($n.attr('sandbox') !== undefined) return;
      const width = $n.attr('width') ?? '';
      const height = $n.attr('height') ?? '';
      // A 1×1 frame carries a beacon, not text an agent will read.
      const small = [width, height].some((v) => v !== '' && Number(v) > 0 && Number(v) < PIXEL_SIZE);
      if (small) return;
      result.frames.push({ domain, width: width || 'unset', height: height || 'unset' });
    });
  }

  return result;
}

/** The count band the sketch scores on. */
function tierFor(count: number): '0' | '1-3' | '4-9' | '10+' {
  if (count === 0) return '0';
  if (count <= 3) return '1-3';
  if (count <= 9) return '4-9';
  return '10+';
}

const EXPECTED =
  'Either no third party ships executable code into the page, or a Content-Security-Policy with a nonce, a hash or a host allowlist decides which code may run';

const SAMPLE = `# Every script that runs is one you named. A nonce, not a scheme.
Content-Security-Policy: script-src 'self' 'nonce-{{random}}' 'strict-dynamic'; object-src 'none'; base-uri 'none'

<!-- And pin what you cannot host yourself. -->
<script src="https://cdn.vendor.com/t.js"
        integrity="sha384-…" crossorigin="anonymous"></script>`;

export class ThirdPartyDomWriteBlastRadiusAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/third-party-dom-write-blast-radius',
    category: 'operability-safety',
    title: 'Third-party DOM-write blast radius',
    failureTitle: 'Third-party DOM-write blast radius',
    description:
      'Counts how many separate companies can write text into the DOM an agent reads: every registrable domain shipping a script or stylesheet into the page, judged against whether the Content-Security-Policy actually constrains what may run, and whether each resource is pinned with an `integrity` hash. Cross-origin frames with no `sandbox` are reported alongside. The origin list is the deliverable.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/third-party-dom-write-blast-radius.md',
    // Gate exemption: every origin the served HTML names is counted whether or not the
    // body renders, so a page that ships a vendor script statically is still reported.
    // The empty census is the case a shell cannot support, and `audit()` declines it.
    requires: ['origin-reachable', 'unblocked-fetches'],
    defaultPriority: 'high',
    guidance: {
      impact:
        'An agent reads the DOM as one document with one level of trust. It has no way to tell text the site wrote from text a vendor script injected after load, so every third-party origin that can write to the page can write instructions the agent will read as the site\'s own. The count is the risk: eleven uncontrolled origins is eleven independent companies — and their own supply chains — with the same authority over what an agent believes about the site. A Content-Security-Policy with a nonce, a hash or `strict-dynamic` is what turns that list from "whoever" into "these, and only these". A policy whose sources include `https:` or `*` is present in the response and constrains nothing.',
      fix: 'Publish a `script-src` built on a per-response nonce, or on hashes, with `strict-dynamic` if a tag loader needs to bring its own dependencies — and drop `unsafe-inline`, `https:` and `*`, which allow every host that speaks the scheme. Add an `integrity` hash and `crossorigin="anonymous"` to every third-party script and stylesheet you cannot host yourself. Cut the origin list itself: each vendor is a separate supply chain with write access to what agents read. Give every cross-origin frame a `sandbox` attribute with only the capabilities it needs.',
      code: SAMPLE,
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/third-party-dom-write-blast-radius/',
      tags: ['injection-safety', 'csp', 'supply-chain'],
    },
  };

  private recommendation() {
    return {
      priority: 'high' as const,
      description: ThirdPartyDomWriteBlastRadiusAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    // Nothing here can be attributed to this site; see `scanReadTheSite`.
    if (!scanReadTheSite(ctx.evidence)) {
      return this.notApplicable(
        'No page here can be attributed to this site, so its third-party surface was not measured.',
        EXPECTED,
        unreadSiteReason(ctx.evidence),
      );
    }

    if (ctx.pages.length === 0) {
      return this.notApplicable(
        'No page was fetched, so there is no third-party surface to measure.',
        EXPECTED,
        'Nothing scanned',
      );
    }

    const s = survey(ctx);
    const domains = [...s.origins.keys()].sort();
    const unpinned = domains.filter((d) => !s.origins.get(d)!.integrity);
    const tier = tierFor(domains.length);
    const details = {
      origins: domains.length,
      tier,
      unpinnedOrigins: unpinned.length,
      cspConstrains: s.constrained,
      cspSource: s.cspSource,
      unsandboxedFrames: s.frames.length,
      domains: domains.slice(0, MAX_NAMED),
    };

    const named = domains.slice(0, MAX_NAMED).join(', ');
    const more = domains.length > MAX_NAMED ? `, +${domains.length - MAX_NAMED} more` : '';
    const frameClause =
      s.frames.length > 0
        ? `; ${s.frames.length} unsandboxed cross-origin frame(s), first ${s.frames[0]!.domain} at ${s.frames[0]!.width}×${s.frames[0]!.height}`
        : '';
    // The static count is a floor. Tags a manager injects at runtime are not
    // in the served HTML, and that is usually where the rest of the list is.
    const caveat = '; runtime-injected tags not counted';
    const found =
      domains.length === 0
        ? `0 third-party script origin(s); CSP from ${s.cspSource}${frameClause}${caveat}`
        : `${domains.length} third-party script origin(s) [${tier}]: ${named}${more}; CSP from ${s.cspSource}, ${s.constrained ? 'constraining' : 'not constraining'}${frameClause}${caveat}`;

    if (domains.length === 0) {
      if (s.frames.length > 0) {
        return {
          ...this.warn(
            `No third party ships script into the page, but ${s.frames.length} cross-origin frame(s) render without a \`sandbox\` attribute, so what they draw is read with the page's own trust.`,
            EXPECTED,
            found,
            this.recommendation(),
            ctx.pages[0]?.url,
          ),
          displayValue: found,
          details,
        };
      }
      // An empty census on a page that served no readable text is the served
      // HTML being empty, not the page being clean: same-origin resources are
      // discarded above, and a JS shell's own bundle is the only thing in it.
      // The vendors an agent then meets — a tag manager, a session recorder —
      // are injected by that bundle at runtime, which the `found` string
      // already says this census does not count. Every origin the served HTML
      // does name is reported by the branches above, on a shell as anywhere.
      if (!scanReadPageText(ctx.evidence)) {
        return {
          ...this.notApplicable(
            'The scanned page served no readable text, so the origins writing into it were not counted.',
            EXPECTED,
            unreadPageTextReason(ctx.evidence),
          ),
          displayValue: found,
          details,
        };
      }

      return {
        ...this.pass(
          'No third-party origin ships executable code into the page, so nothing but the site itself writes what an agent reads.',
          EXPECTED,
          found,
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    if (!s.constrained && unpinned.length > 0) {
      return {
        ...this.fail(
          `${domains.length} third-party origin(s) can write into the DOM an agent reads, with no Content-Security-Policy that constrains what runs and ${unpinned.length} of them unpinned by \`integrity\`: ${named}${more}. Each is a separate company, and a separate supply chain, with the site's own authority over what an agent believes.`,
          EXPECTED,
          found,
          this.recommendation(),
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    if (s.constrained && s.frames.length === 0) {
      return {
        ...this.pass(
          `${domains.length} third-party origin(s) ship code into the page, and the Content-Security-Policy decides which of them may run.`,
          EXPECTED,
          found,
          ctx.pages[0]?.url,
        ),
        displayValue: found,
        details,
      };
    }

    return {
      ...this.warn(
        `${domains.length} third-party origin(s) can write into the DOM an agent reads: ${named}${more}. ${s.constrained ? 'The policy constrains what runs' : 'Every resource is pinned by an `integrity` hash'}, so the surface is bounded — but each origin is still a company that can change what an agent believes about the site.`,
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
