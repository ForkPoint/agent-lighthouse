import { randomBytes } from 'node:crypto';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { isSafeUrl } from '../../url-utils';
import { sharedProbeUrl } from '../../gatherers/discovery';

/** Statuses that prove the origin resolves a missing root .txt as missing. */
const ABSENT = new Set([404, 410]);

/** Bytes of the body read when classifying a 2xx answer. */
const SNIFF_BYTES = 512;

/** A name no site can be serving on purpose. */
function randomProbeName(): string {
  return `${randomBytes(16).toString('hex')}.txt`;
}

export class RootTextFileResolutionIntegrityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/root-text-file-resolution-integrity',
    category: 'machine-discovery',
    title: 'The origin serves and correctly 404s root-level .txt resources',
    failureTitle: 'This origin answers 200 for root .txt paths that do not exist',
    description:
      'Fetches two root-level `.txt` files with random names that cannot exist. Both must answer 404 or 410. An origin that answers 200 instead has a catch-all, which makes every probe-based discovery file — `llms.txt`, `ai.txt`, `security.txt`, the IndexNow key file — impossible to tell apart from a soft 404. Also checks that `/robots.txt` is served as `text/plain`.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/machine-discovery/root-text-file-resolution-integrity.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    guidance: {
      impact:
        'IndexNow proves ownership by fetching `https://host/{key}.txt` and byte-comparing the body to the key, and six engines discard the submission when that comparison fails. The same property decides whether any other root `.txt` file means anything: if an origin answers 200 for a path that does not exist, then a 200 for `/llms.txt` is not evidence the file is there. A catch-all rewrite ahead of static file serving turns every one of those signals into noise, with no visible symptom on the site itself.',
      fix: 'Serve root-level `.txt` paths from static files and let a missing one answer 404. Order the static-file handler ahead of any SPA or catch-all rewrite, and make sure the rewrite does not cover `*.txt`. Serve `/robots.txt` as `text/plain`, not as `text/html` or `application/octet-stream`.',
      effort: 'easy',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/root-text-file-resolution-integrity/',
      tags: ['indexnow', 'llms-txt', 'discovery', 'soft-404'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    if (ctx.pages.length === 0 && ctx.rootFiles['/robots.txt'] === undefined) {
      return this.notApplicable(
        'This scan reached no page and no robots.txt, so there is no origin to probe.',
        'An origin that answers at least one request',
        'Nothing fetched',
      );
    }

    let origin: string;
    try {
      origin = new URL(ctx.baseUrl).origin;
    } catch {
      return this.notApplicable(
        'This scan carries no origin to probe.',
        'An absolute base URL',
        `baseUrl: "${ctx.baseUrl}"`,
      );
    }

    const probeUrls = [`${origin}/${randomProbeName()}`, `${origin}/${randomProbeName()}`];
    const robotsUrl = `${origin}/robots.txt`;
    for (const url of [...probeUrls, robotsUrl]) {
      if (!(await isSafeUrl(url))) {
        return this.notApplicable(
          'This origin is not safe to probe.',
          'A public origin',
          `${url} did not pass the address check`,
        );
      }
    }

    const probes = [];
    for (const url of probeUrls) {
      const result = await sharedProbeUrl(ctx, url, {
        followRedirects: true,
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (result) probes.push({ url, result });
    }
    const robots = await sharedProbeUrl(ctx, robotsUrl, { followRedirects: true });
    if (!robots) return this.fail('Robots file probe failed', '200 OK or 404', 'No response');

    const failures: string[] = [];
    const answering = probes.filter((probe) => probe.result.status >= 200 && probe.result.status < 300);
    const absent = probes.filter((probe) => ABSENT.has(probe.result.status));

    if (answering.length > 0) {
      // Classify what the catch-all is, because the three kinds have three
      // different fixes: a rewrite rule, a content-type map, and a fallback file.
      const [first, second] = probes;
      const sniff = (body: string) => body.slice(0, SNIFF_BYTES).toLowerCase();
      const looksHtml = answering.some(
        (probe) => sniff(probe.result.body).trimStart().startsWith('<') || sniff(probe.result.body).includes('<html'),
      );
      const htmlType = answering.some((probe) => /^text\/html/i.test(probe.result.contentType));
      const identical =
        answering.length === 2 && first !== undefined && second !== undefined && first.result.body === second.result.body;

      const kind = looksHtml
        ? 'an SPA or HTML catch-all: the body is markup, not text'
        : htmlType
          ? 'a wrong content type: the body is text but the origin calls it text/html'
          : identical
            ? 'a static catch-all: two different random names returned byte-identical bodies'
            : 'a catch-all of an unclassified kind';
      failures.push(
        `${answering.length} of 2 random .txt probes answered ${answering.map((probe) => probe.result.status).join('/')} instead of 404 — ${kind}`,
      );
    } else if (absent.length < probes.length) {
      const other = probes.filter((probe) => !ABSENT.has(probe.result.status));
      failures.push(
        `A random .txt probe answered ${other.map((probe) => probe.result.status).join('/')}, which is neither 404/410 nor a catch-all — the origin's answer for a missing file cannot be read`,
      );
    }

    const robotsType = robots.contentType.split(';')[0]!.trim().toLowerCase();
    const robotsPlain = robotsType.startsWith('text/plain');
    // A missing robots.txt is a warning, not a failure of this audit: the
    // positive control simply did not run, which is a different thing from an
    // origin that mislabels the file it does serve.
    const warnings: string[] = [];
    if (robots.status !== 200) {
      warnings.push(`/robots.txt answered HTTP ${robots.status}, so the positive control did not run`);
    } else if (!robotsPlain) {
      failures.push(
        `/robots.txt is served as "${robotsType || 'no content type'}" rather than text/plain, which strict parsers reject`,
      );
    }

    // The derived flag. Every other probe-based audit — llms.txt, ai.txt,
    // security.txt — is only as trustworthy as this answer.
    const discoveryProbeReliable = absent.length === probes.length && robots.status === 200 && robotsPlain;
    const details = {
      discoveryProbeReliable,
      probeStatuses: probes.map((probe) => String(probe.result.status)),
      probeNames: probes.map((probe) => new URL(probe.url).pathname),
      robotsStatus: robots.status,
      robotsContentType: robotsType,
      failures: failures.slice(0, 10),
      warnings: warnings.slice(0, 10),
    };
    const expected =
      'Two random root .txt paths answer 404 or 410, and /robots.txt answers 200 as text/plain';
    const found = `Probes answered ${probes.map((probe) => probe.result.status).join(' and ')}; /robots.txt answered ${robots.status} as "${robotsType || 'no content type'}".`;
    const displayValue = discoveryProbeReliable ? 'Probes reliable' : 'Probes unreliable';

    if (failures.length > 0) {
      return {
        ...this.fail(
          `${failures[0]}. A 200 for any other root .txt file therefore proves nothing.`,
          expected,
          found,
          'Serve root .txt paths from static files, order the static handler ahead of any catch-all rewrite, and serve /robots.txt as text/plain.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          `The random .txt probes resolved correctly, but ${warnings[0]}.`,
          expected,
          found,
          'Serve a robots.txt as text/plain so the discovery namespace has a positive control.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        'Both random .txt probes 404ed and /robots.txt is text/plain, so a root .txt file that answers 200 is really there.',
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
