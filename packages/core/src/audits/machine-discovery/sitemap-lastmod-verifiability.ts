// Graduated from proposal 2026-08-22 (Plan 5, Task 21).
// Evidence dossier: docs/evidence/audits/machine-discovery/sitemap-lastmod-verifiability.md
//
// Distinct from machine-discovery/sitemap-lastmod, which asks whether lastmod
// is present. This asks whether it is true: Google uses lastmod only "if it's
// consistently and verifiably ... accurate", so a value no page-level evidence
// supports is a value the crawler discards.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";
import { fetchSampledPage } from "../../gatherers/sampled-pages";
import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  topLevelJsonLd,
} from "../../parser";
import {
  siteSitemapTree,
  sampleEntries,
  isW3CDateTime,
  type SitemapEntry,
} from "../../gatherers/sitemap";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "../../types";

const DAY_MS = 86_400_000;
/** How many URLs to cross-validate. Each one that was not already scanned costs a request. */
const SAMPLE_SIZE = 6;
/** Clock skew allowed before a lastmod counts as future-dated. */
const FUTURE_SKEW_MS = 60 * 60 * 1000;
/**
 * One run on this share of the sample has the shape of a build stamp. The
 * shape alone is not a defect; it stops a deploy-time header vouching for it.
 */
const MODAL_SHARE = 0.9;
/**
 * Values this close together are one stamp. A generator that writes the
 * clock per URL spreads one run over seconds: one retail site stamped 2451
 * product URLs between 09:57:16 and 09:57:33, and exact-string matching saw
 * 2451 different dates.
 */
const STAMP_WINDOW_MS = 60 * 60 * 1000;
/** ...but only when that value is this recent, which is what makes it a deploy date. */
const MODAL_RECENCY_DAYS = 3;
/** How far a lastmod may sit from every page signal before it is unsupported. */
const DIVERGENCE_DAYS = 7;
/** The share of unsupported URLs that makes the freshness channel inert. */
const DIVERGENT_SHARE = 0.2;
/** Above this share of unverifiable URLs the audit reports the missing signal. */
const NO_SIGNAL_SHARE = 0.5;

/** Meta names that carry a page-level modification time. */
const META_KEYS = ["article:modified_time", "last-modified", "og:updated_time"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTime(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Types whose dates belong to someone else's contribution, not to the page.
 *
 * A product page carries its customers' reviews as `review: [{ "@type":
 * "Review", datePublished }]`. Those dates say when a shopper wrote, not
 * when the page changed, and on one retail site they turned five pages with
 * no modification time at all into "divergent" lastmods.
 */
const CONTRIBUTED_TYPES = new Set([
  "Review",
  "CriticReview",
  "UserReview",
  "EmployerReview",
  "Comment",
  "Answer",
  "Question",
]);

function typeNames(node: Record<string, unknown>): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/^.*[/:#]/, ""));
}

/**
 * The JSON-LD nodes whose dates describe the page: every top-level node and
 * `@graph` member, and what they nest, minus nested contributions. A top-level
 * Review is the page itself and keeps its dates.
 */
function pageDateNodes(jsonLd: object[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown, nested: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, nested);
      return;
    }
    if (!isObject(node)) return;
    if (nested && typeNames(node).some((t) => CONTRIBUTED_TYPES.has(t))) return;
    out.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "@context") continue;
      if (value && typeof value === "object") visit(value, true);
    }
  };
  for (const top of topLevelJsonLd(jsonLd)) visit(top, false);
  return out;
}

/**
 * The modification times a page publishes, split by what they can prove.
 *
 * `content` dates are written about the content: JSON-LD dates and the
 * article meta tags. `header` is the HTTP `Last-Modified`, which a static
 * server sets to the file's write time, so every deploy moves it while the
 * content, and a correct lastmod, stay put. It may corroborate a lastmod, but
 * it cannot contradict one.
 */
interface PageSignals {
  content: number[];
  header: number[];
}

function pageSignals(
  headers: Record<string, string>,
  jsonLd: object[],
  meta: Record<string, string>,
): PageSignals {
  const out: PageSignals = { content: [], header: [] };
  const add = (into: number[], value: unknown) => {
    const time = parseTime(value);
    if (time !== undefined) into.push(time);
  };

  add(out.header, headers["last-modified"]);
  for (const node of pageDateNodes(jsonLd)) {
    add(out.content, node["dateModified"]);
    add(out.content, node["datePublished"]);
  }
  for (const key of META_KEYS) add(out.content, meta[key]);
  return out;
}

function signalsFromPage(page: PageContext): PageSignals {
  return pageSignals(page.fetchResult.headers, page.jsonLd, page.meta);
}

function signalsFromFetch(result: FetchResult): PageSignals {
  const $ = parseHtml(result.body);
  return pageSignals(result.headers, extractJsonLd($), extractMetaTags($));
}

/** Compare-safe key: the same document must not look like two URLs. */
function urlKey(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${url.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return undefined;
  }
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

const EXPECTED =
  "every sitemap <lastmod> parses as a W3C Datetime, sits in the past, and agrees within 7 days with a modification time the page itself publishes";

const SAMPLE = `<url>
  <loc>https://example.com/blog/agent-readiness</loc>
  <!-- the date the CONTENT changed, not the date the site was deployed -->
  <lastmod>2026-08-14T09:12:00+00:00</lastmod>
</url>

<!-- and on the page itself, so the value is verifiable: -->
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Article",
  "dateModified": "2026-08-14T09:12:00+00:00" }
</script>`;

export class SitemapLastmodVerifiabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "machine-discovery/sitemap-lastmod-verifiability",
    category: "machine-discovery",
    title: "Sitemap lastmod values are verifiable against the pages",
    failureTitle: "Sitemap lastmod values contradict the pages they describe",
    description:
      "Cross-validates sampled sitemap <lastmod> values against three independent page-level modification signals — the Last-Modified response header, JSON-LD dateModified/datePublished, and article:modified_time — and scores agreement rather than presence. Catches the two dominant failure modes when the page dates disagree: the build stamp (every URL updated on every deploy) and the frozen value (the CMS never updates it). A deploy-time Last-Modified header never vouches for a recent run of identical stamps.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/machine-discovery/sitemap-lastmod-verifiability.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        'Google states it uses <lastmod> "if it\'s consistently and verifiably (for example by comparing to the last modification of the page) accurate". lastmod is therefore a conditional signal an engine silently discards on divergence — and it is the only freshness hint a pull-based AI crawler gets from a sitemap. If sampled values disagree with every available page-level signal for a material share of URLs, the freshness channel is inert and re-crawl scheduling degrades to organic rediscovery. A recent cluster of lastmod values is consistent with a build stamp only when page dates also disagree. Clustered edits alone do not show a defect. A lastmod in the future relative to the scan is invalid.',
      fix: "Stamp lastmod from the content record, not from the build. Emit the timestamp of the last substantive edit to that document, and leave it alone when a deploy only rebuilds the page. Publish the same instant on the page — JSON-LD dateModified is the most widely read of the three signals — so the value is checkable; a lastmod nothing on the page supports is a lastmod the crawler drops. Never emit a future date, and use W3C Datetime (YYYY-MM-DD or a full RFC 3339 timestamp) for every value.",
      code: SAMPLE,
      effort: FixEffort.Moderate,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/machine-discovery/sitemap-lastmod-verifiability/",
      tags: ["sitemap", "lastmod", "freshness", "crawl-scheduling"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const tree = await siteSitemapTree(ctx);

    const withLastmod = tree.entries.filter(
      (entry): entry is SitemapEntry & { lastmod: string } =>
        Boolean(entry.lastmod),
    );

    if (withLastmod.length === 0) {
      return this.notApplicable(
        tree.entries.length === 0
          ? "No sitemap responded, so there are no lastmod values to verify."
          : "The sitemap lists no <lastmod> values. Whether lastmod should be present is machine-discovery/sitemap-lastmod’s question; this audit only checks the values that exist.",
        EXPECTED,
        `${tree.entries.length} sitemap entries, 0 with lastmod`,
      );
    }

    const valid = withLastmod.filter((entry) => isW3CDateTime(entry.lastmod));
    const malformed = withLastmod.length - valid.length;
    const now = Date.now();
    const future = valid.filter(
      (entry) => Date.parse(entry.lastmod) > now + FUTURE_SKEW_MS,
    );

    const sample = sampleEntries(valid, SAMPLE_SIZE) as Array<
      SitemapEntry & { lastmod: string }
    >;
    const byKey = new Map<string, PageContext>();
    for (const page of ctx.pages) {
      const key = urlKey(page.url);
      if (key && !byKey.has(key)) byKey.set(key, page);
    }

    // The modal test counts the whole sample, compared or not. It takes the
    // largest group of values inside one STAMP_WINDOW_MS window. The shape
    // alone proves nothing: a batch of real edits produces it too. What it
    // changes is how much a deploy-time header can be trusted.
    const ordered = sample
      .map((entry) => ({
        lastmod: entry.lastmod,
        time: Date.parse(entry.lastmod),
      }))
      .sort((a, b) => a.time - b.time);
    let modalCount = 0;
    let modalFirst = "";
    let modalLast = "";
    for (let start = 0, end = 0; end < ordered.length; end++) {
      while (ordered[end]!.time - ordered[start]!.time > STAMP_WINDOW_MS)
        start += 1;
      if (end - start + 1 > modalCount) {
        modalCount = end - start + 1;
        modalFirst = ordered[start]!.lastmod;
        modalLast = ordered[end]!.lastmod;
      }
    }
    const modalRecent =
      (now - Date.parse(modalLast)) / DAY_MS <= MODAL_RECENCY_DAYS;
    const stampShape =
      sample.length > 1 &&
      modalCount / sample.length > MODAL_SHARE &&
      modalRecent;

    let corroborated = 0;
    let divergent = 0;
    let noSignal = 0;
    const worst: string[] = [];

    for (const entry of sample) {
      const stamp = Date.parse(entry.lastmod);
      const key = urlKey(entry.loc);
      const scanned = key ? byKey.get(key) : undefined;

      let signals: PageSignals = { content: [], header: [] };
      if (scanned) {
        signals = signalsFromPage(scanned);
      } else {
        const result = await fetchSampledPage(ctx, entry.loc);
        if (result) signals = signalsFromFetch(result);
      }

      // A recent run of lastmod values and a Last-Modified header can both be
      // the deploy time. Their agreement then shows when the build ran, not
      // when the content changed, so only the content dates are compared.
      const all = stampShape
        ? signals.content
        : [...signals.content, ...signals.header];
      if (all.length === 0) {
        noSignal += 1;
        continue;
      }

      const deltaDays =
        Math.min(...all.map((time) => Math.abs(stamp - time))) / DAY_MS;
      if (deltaDays <= DIVERGENCE_DAYS) {
        corroborated += 1;
        continue;
      }
      // A deploy-time header alone cannot show the lastmod is wrong.
      if (signals.content.length === 0) {
        noSignal += 1;
        continue;
      }
      divergent += 1;
      if (worst.length < 3) {
        worst.push(
          `${entry.loc} (lastmod ${entry.lastmod}, ${Math.round(deltaDays)} days from the nearest page signal)`,
        );
      }
    }

    const compared = sample.length - noSignal;
    const contentDiverges =
      compared > 0 && divergent / compared > DIVERGENT_SHARE;
    // Nearby edits can be real, including a batch publication. The shape
    // only names the cause when the content dates disagree.
    const buildStamp = stampShape && contentDiverges;

    const problems: string[] = [];

    if (future.length > 0) {
      problems.push(
        `${future.length} lastmod value(s) are dated in the future (${future[0]!.lastmod} on ${future[0]!.loc}), which is never valid`,
      );
    }
    if (buildStamp) {
      problems.push(
        `${modalCount} of ${sample.length} sampled URLs (${pct(modalCount, sample.length)}%) share ${modalFirst === modalLast ? `the single lastmod ${modalFirst}` : `one lastmod run, ${modalFirst} to ${modalLast}`}, within ${MODAL_RECENCY_DAYS} days of this scan; disagreement with the page dates makes this consistent with a build stamp`,
      );
    }
    if (contentDiverges) {
      problems.push(
        `${divergent} of ${compared} comparable URLs (${pct(divergent, compared)}%) carry a lastmod more than ${DIVERGENCE_DAYS} days from every signal the page publishes: ${worst.join("; ")}`,
      );
    }

    const notes: string[] = [];
    if (malformed > 0) {
      notes.push(
        `${malformed} lastmod value(s) are malformed — not W3C Datetime — and are ignored by parsers`,
      );
    }
    if (sample.length > 0 && noSignal / sample.length > NO_SIGNAL_SHARE) {
      notes.push(
        `${noSignal} of ${sample.length} sampled URLs (${pct(noSignal, sample.length)}%) publish no modification time at all, so their lastmod cannot be verified — add dateModified to the page's JSON-LD`,
      );
    }

    const found = `${sample.length} sampled URL(s) of ${withLastmod.length} with lastmod; ${corroborated} corroborated, ${divergent} divergent, ${noSignal} unverifiable; ${malformed} malformed; ${future.length} future-dated`;

    if (problems.length > 0) {
      return this.fail(
        [...problems, ...notes].join(". ") + ".",
        EXPECTED,
        found,
        CheckPriority.Medium,
      );
    }

    if (notes.length > 0) {
      return this.warn(
        `${notes.join(". ")}.`,
        EXPECTED,
        found,
        CheckPriority.Low,
      );
    }

    return this.pass(
      `${corroborated} of ${sample.length} sampled lastmod value(s) agree within ${DIVERGENCE_DAYS} days with a modification time the page publishes.`,
      EXPECTED,
      found,
    );
  }
}
