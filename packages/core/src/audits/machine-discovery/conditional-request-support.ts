import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import { parseRobotsFile } from '../../gatherers/robots';
import { siteSitemapTree } from '../../gatherers/sitemap';
import { sharedFeeds } from '../../gatherers/feeds';
import { sharedRevalidation, type RevalidationResult } from '../../gatherers/conditional';

/** Child sitemaps probed. The sketch's cap, kept because each costs four requests. */
const MAX_CHILD_SITEMAPS = 3;

/** Feeds probed, for the same reason. */
const MAX_FEEDS = 2;

/** The sitemap protocol's hard limits. Past either, the file must be split. */
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;
const MAX_SITEMAP_URLS = 50_000;

interface Surface {
  url: string;
  kind: 'robots.txt' | 'sitemap' | 'feed';
  result: RevalidationResult;
}

export class ConditionalRequestSupportAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'machine-discovery/conditional-request-support',
    category: 'machine-discovery',
    title: 'Discovery surfaces answer conditional requests',
    failureTitle: 'Every poll of this site’s discovery files downloads the whole file again',
    description:
      'Fetches robots.txt, the sitemaps and the feeds twice identically, then once with `If-None-Match` and once with `If-Modified-Since`, and reports what came back. A surface with no validator cannot be revalidated at all; one whose `ETag` changes while its body does not is worse, because every poll looks like a change.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/machine-discovery/conditional-request-support.md',
    guidance: {
      impact:
        'A crawler that wants to know what changed re-reads your sitemap and your feed on a schedule. If those responses carry no `ETag` and no `Last-Modified`, it cannot ask "has this changed?" — it can only download the file again, every time, forever. The cost is yours as much as theirs: bandwidth you serve for no new information, and a crawl budget spent re-reading a list instead of fetching the pages on it. A validator that changes on every build is the same cost wearing a correct-looking header.',
      fix: 'Emit a strong `ETag` derived from the file’s content, not from the build, and a `Last-Modified` that moves only when the content does. Answer `If-None-Match` and `If-Modified-Since` with 304 and an empty body. Keep `no-store` and `private` off public discovery surfaces — they tell a crawler not to keep the copy it just paid for.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/conditional-request-support/',
      tags: ['http', 'caching', 'sitemap', 'feeds', 'robots'],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const urls: Array<{ url: string; kind: Surface['kind'] }> = [];

    const robots = ctx.rootFiles['/robots.txt'];
    if (robots?.status === 200) urls.push({ url: `${ctx.baseUrl}/robots.txt`, kind: 'robots.txt' });

    const declared = robots?.status === 200 ? parseRobotsFile(robots.body).sitemaps : [];
    const tree = await siteSitemapTree(ctx);
    const sitemapUrls = [...declared, `${ctx.baseUrl}/sitemap.xml`, ...tree.childSitemaps].slice(
      0,
      MAX_CHILD_SITEMAPS + 1,
    );
    for (const url of sitemapUrls) {
      if (!urls.some((entry) => entry.url === url)) urls.push({ url, kind: 'sitemap' });
    }

    for (const feed of await sharedFeeds(ctx, { max: MAX_FEEDS })) {
      urls.push({ url: feed.url, kind: 'feed' });
    }

    const surfaces: Surface[] = [];
    for (const entry of urls) {
      const result = await sharedRevalidation(ctx, entry.url);
      if (result) surfaces.push({ url: entry.url, kind: entry.kind, result });
    }

    if (surfaces.length === 0) {
      return this.notApplicable(
        'No discovery surface answered: there is no robots.txt, sitemap or feed to revalidate.',
        'A robots.txt, sitemap or feed that answers conditional requests',
        `${urls.length} candidate surface(s), none reachable`,
      );
    }

    const failures: string[] = [];
    const warnings: string[] = [];
    let bytesPerPoll = 0;

    for (const surface of surfaces) {
      const { result } = surface;
      bytesPerPoll += result.bytes;
      const where = `${surface.kind} ${surface.url}`;

      if (result.etag === '' && result.lastModified === '') {
        failures.push(
          `${where}: neither ETag nor Last-Modified, so every poll re-downloads ${result.bytes} bytes`,
        );
      }
      if (result.bodyStable && !result.etagStable) {
        failures.push(
          `${where}: the body did not change between two identical requests but the ETag did, so every poll reads as a change`,
        );
      }
      if (result.honoursIfNoneMatch === false) {
        failures.push(`${where}: answered If-None-Match with 200 rather than 304`);
      }
      if (result.honoursIfModifiedSince === false) {
        failures.push(`${where}: answered If-Modified-Since with 200 rather than 304`);
      }
      if (/no-store|private/i.test(result.cacheControl)) {
        warnings.push(`${where}: Cache-Control: ${result.cacheControl} on a public discovery surface`);
      }
      if (surface.kind === 'sitemap') {
        if (result.bytes > MAX_SITEMAP_BYTES) {
          warnings.push(`${where}: ${result.bytes} bytes, over the sitemap protocol's 50MB limit`);
        }
        if (!tree.truncated && tree.entries.length > MAX_SITEMAP_URLS) {
          warnings.push(`${where}: ${tree.entries.length} URLs, over the sitemap protocol's 50,000 limit`);
        }
      }
    }

    const revalidatable = surfaces.filter(
      (s) => s.result.honoursIfNoneMatch === true || s.result.honoursIfModifiedSince === true,
    );

    const displayValue = `${revalidatable.length}/${surfaces.length} surfaces revalidate`;
    const expected =
      'Every discovery surface carries a stable validator and answers If-None-Match or If-Modified-Since with 304';
    const found =
      `${surfaces.length} surface(s) probed; ${revalidatable.length} answer a conditional request with 304; ` +
      `${bytesPerPoll} bytes per full poll. The 304 semantics are documented for Googlebot and generalized here by analogy — the assertion itself is HTTP conformance.`;
    const details = {
      surfaces: surfaces.map((s) => s.url),
      revalidatingSurfaces: revalidatable.length,
      bytesPerPoll,
      perSurface: surfaces.map(
        (s) =>
          `${s.url}: validators ${[s.result.etag !== '' ? 'ETag' : '', s.result.lastModified !== '' ? 'Last-Modified' : ''].filter(Boolean).join('+') || 'none'}, ` +
          `if-none-match ${String(s.result.honoursIfNoneMatch ?? 'not asked')}, ` +
          `if-modified-since ${String(s.result.honoursIfModifiedSince ?? 'not asked')}, ` +
          `validator ${s.result.etagStable ? 'stable' : 'unstable'}, ${s.result.bytes} bytes per poll`,
      ),
      failures: failures.slice(0, 30),
      warnings: warnings.slice(0, 30),
    };

    if (failures.length > 0) {
      return {
        ...this.fail(
          `${failures.length} discovery surface problem(s): a crawler cannot ask this site what changed.`,
          expected,
          found,
          'Emit a content-derived ETag and a Last-Modified that moves with the content, and answer conditional requests with 304.',
        ),
        displayValue,
        details,
      };
    }

    if (warnings.length > 0) {
      return {
        ...this.warn(
          `Every surface revalidates, but ${warnings.length} problem(s) remain around them.`,
          expected,
          found,
          'Drop no-store and private from public discovery surfaces, and split any sitemap past the protocol’s size limits.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${surfaces.length} discovery surface(s) carry a stable validator and answer conditional requests with 304.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
