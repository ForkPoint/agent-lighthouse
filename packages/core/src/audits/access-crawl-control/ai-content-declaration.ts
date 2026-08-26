// Redemption rewrite landed 2026-08-22 (Plan 4, Task 16). The audit used to
// demand `<meta name="ai-content-declaration">` — a name with no
// specification behind it — and told users at `medium` priority that GPTBot
// and ClaudeBot read it to find their content policy. Both vendors document
// robots.txt and nothing else, so that was misinformation: a site owner could
// add the tag and believe they had expressed an opt-out they had not
// expressed, while the mechanism that does work went unaddressed. It also
// failed 100% of real sites, examined only `ctx.pages[0]`, and rejected
// protocol-relative and root-relative values as "not a valid URL" for a tag
// with no spec defining what a valid value is.
// Evidence dossier: docs/evidence/audits/access-crawl-control/ai-content-declaration.md
//
// It now reports the declaration names that actually exist, in the order the
// evidence ranks them, and never fails: the IETF AIPREF `Content-Usage`
// attachment (Standards Track, authored by Google and Mozilla, updating RFC
// 9309) first, then the noai/noimageai convention with its "no documented
// consumer" caveat stated in the message rather than implied.
//
// Scope note (non-double-counting): `tdm-reservation` and `tdm-policy` are
// read by `access-crawl-control/tdm-rep`, which owns the TDM-Rep protocol
// end to end. This audit ignores them.
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext, PageContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/**
 * The AIPREF attachment header. draft-ietf-aipref-attach defines exactly two
 * attachment mechanisms — this response header and a `Content-Usage` rule in
 * robots.txt — and explicitly leaves embedded (head-level) preferences out of
 * scope, which is why it ranks above everything else here.
 */
const CONTENT_USAGE_HEADER = 'content-usage';
const ROBOTS_CONTENT_USAGE_RE = /^\s*content-usage\s*:\s*(.+)$/im;

/** The DeviantArt-origin convention, by far the most adopted of the head-level names. */
const OPT_OUT_NAMES = ['noai', 'noimageai'] as const;

/** The name this audit used to demand. Kept only so it can be reported as invented. */
const INVENTED_NAME = 'ai-content-declaration';

interface Declaration {
  /** `Content-Usage` value plus where it came from. */
  aipref?: { value: string; source: 'HTTP response header' | 'robots.txt' };
  /** noai / noimageai names observed, deduplicated. */
  optOuts: string[];
  /** The invented `ai-content-declaration` name is present. */
  invented: boolean;
  pageUrl?: string;
}

/** noai/noimageai as a standalone `<meta name>` or as a `robots` content token. */
function readOptOuts(page: PageContext): string[] {
  const found: string[] = [];
  // Queried off the DOM rather than the parsed `meta` map: the convention is
  // routinely written valueless (`<meta name="noai">`), and the map only keeps
  // tags that carry a `content` attribute.
  for (const name of OPT_OUT_NAMES) {
    if (page.$(`meta[name="${name}" i]`).length > 0) found.push(name);
  }

  const robots = (page.meta['robots'] ?? '').toLowerCase();
  // Split into tokens: a substring match would read `noai` out of `noarchive`.
  const tokens = new Set(robots.split(/[\s,]+/).filter(Boolean));
  for (const name of OPT_OUT_NAMES) {
    if (tokens.has(name) && !found.includes(name)) found.push(name);
  }

  return found;
}

function survey(ctx: CheckContext): Declaration {
  const result: Declaration = { optOuts: [], invented: false };

  for (const page of ctx.pages) {
    if (!result.aipref) {
      const header = page.fetchResult?.headers?.[CONTENT_USAGE_HEADER];
      if (header?.trim()) {
        result.aipref = { value: header.trim(), source: 'HTTP response header' };
      }
    }

    for (const name of readOptOuts(page)) {
      if (!result.optOuts.includes(name)) result.optOuts.push(name);
      if (!result.pageUrl) result.pageUrl = page.url;
    }

    // A bare `<meta name="ai-content-declaration">` carries no content
    // attribute, so it never reaches page.meta. The tag is still there.
    if (page.$(`meta[name="${INVENTED_NAME}"]`).length > 0) {
      result.invented = true;
      if (!result.pageUrl) result.pageUrl = page.url;
    }
  }

  if (!result.aipref) {
    const robots = ctx.rootFiles['/robots.txt'];
    if (robots && robots.status === 200 && robots.body) {
      const match = ROBOTS_CONTENT_USAGE_RE.exec(robots.body);
      if (match) result.aipref = { value: match[1]!.trim(), source: 'robots.txt' };
    }
  }

  return result;
}

const EXPECTED =
  'An AI-usage preference attached where the standards work puts it: a Content-Usage response header or robots.txt rule';

const SAMPLE = `# robots.txt — draft-ietf-aipref-attach defines the rule form
User-agent: *
Content-Usage: ai-train=n

# …or the equivalent response header on every document
Content-Usage: ai-train=n`;

export class AiContentDeclarationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'access-crawl-control/ai-content-declaration',
    category: 'access-crawl-control',
    title: 'AI usage-preference declaration',
    failureTitle: 'AI usage-preference declaration',
    description:
      'Where a site declares how AI systems may use its content. The IETF AIPREF work attaches that preference to a Content-Usage response header or a robots.txt rule, and explicitly leaves the HTML head out of scope; the head-level noai/noimageai convention has real adoption but no AI vendor documents honoring it. This audit reports what a site declares and where, and never treats declaring nothing as a defect.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('D', 'experimental'),
    evidenceGrade: 'D',
    tier: 'experimental',
    dossier: 'docs/evidence/audits/access-crawl-control/ai-content-declaration.md',
    // Gate exemption: being refused is what this category reports.
    requires: ['origin-reachable', 'rendered-body', 'sample-adequate'],
    // Was `medium` on an invented directive; the whole class of signals is
    // pre-consumer, so nothing here should outrank an actionable item.
    defaultPriority: 'low',
    guidance: {
      impact:
        'None of these declarations is documented as honored by any AI vendor today, so none of them protects content on its own. The reason to attach one is that the AIPREF form is where the standards work is heading, and a preference expressed there is the one an implementing crawler will look for. Access control that has to hold today belongs in robots.txt user-agent rules and in server-side enforcement.',
      fix: 'Express the preference where AIPREF attaches it: a Content-Usage rule in robots.txt, or a Content-Usage response header. Keep any noai/noimageai tags you already ship — they cost nothing — but do not rely on them, and do not treat either as a substitute for robots.txt directives or for access control.',
      code: SAMPLE,
      effort: 'trivial',
      docsUrl: 'https://ietf-wg-aipref.github.io/drafts/draft-ietf-aipref-attach.html',
      tags: ['ai-policy', 'aipref', 'content-usage', 'crawler-permissions', 'experimental'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const found = survey(ctx);

    if (found.aipref) {
      return this.pass(
        `An AI-usage preference is attached the way the AIPREF drafts specify: Content-Usage "${found.aipref.value}" via ${found.aipref.source}.`,
        EXPECTED,
        `Content-Usage: ${found.aipref.value} (${found.aipref.source})`,
        found.pageUrl,
      );
    }

    const notes: string[] = [];
    if (found.optOuts.length > 0) {
      notes.push(
        `This site ships <meta name="${found.optOuts.join('">, <meta name="')}">. No AI vendor documents honoring these names — Google's supported-meta-tags list omits them, and OpenAI's and Anthropic's crawler docs describe robots.txt only — so they express intent without enforcing anything.`,
      );
    }
    if (found.invented) {
      notes.push(
        `<meta name="${INVENTED_NAME}"> has no specification behind it and no consumer; nothing reads it, whatever value it carries.`,
      );
    }

    if (notes.length > 0) {
      return this.warn(
        `${notes.join(' ')} The mechanisms that are actually read are robots.txt user-agent rules today and the AIPREF Content-Usage attachment as it lands.`,
        EXPECTED,
        found.optOuts.length > 0
          ? `Head-level declarations only: ${found.optOuts.join(', ')}${found.invented ? `, ${INVENTED_NAME}` : ''}`
          : `Head-level declarations only: ${INVENTED_NAME}`,
        'low',
        found.pageUrl,
      );
    }

    return this.notApplicable(
      'This site attaches no AI-usage preference. No mechanism in this family has a documented consumer yet, so declaring nothing is a choice rather than a defect — the directives crawlers do read are covered by the robots.txt audits.',
      EXPECTED,
      'No Content-Usage attachment and no head-level declaration',
    );
  }
}
