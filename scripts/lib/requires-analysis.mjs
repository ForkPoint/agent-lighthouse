/**
 * What evidence each audit needs, derived from what its source reads.
 *
 * The requirement is a static property of the file: an audit that touches
 * `ctx.pages`, directly or through a page-fed gatherer, cannot say anything
 * true about a scan that fetched no readable page. Deriving it here — rather
 * than inferring it at runtime — keeps the declaration in the audit's own meta
 * where a reader finds it, and lets a build-time check refuse the drift.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Every evidence key, in the order they are declared in `scan-evidence.ts`. */
export const EVIDENCE_KEYS = [
  'origin-reachable',
  'unblocked-fetches',
  'rendered-body',
  'sample-adequate',
];

/** What an audit needs when it reads pages, and when it does not. */
const PAGE_FED_REQUIRES = EVIDENCE_KEYS;
const ORIGIN_ONLY_REQUIRES = ['origin-reachable'];

/**
 * Which gatherers are fed by the sampled pages.
 *
 * The gatherer layer exists so audits do not touch `ctx.pages` directly, so a
 * pages-only grep would classify the best-behaved audits as safe and leave
 * them running blind on a shell scan. A gatherer missing from this map fails
 * the check — that is what keeps the map honest when one is added.
 */
export const GATHERER_EVIDENCE = {
  commerce: PAGE_FED_REQUIRES,
  'css-rules': PAGE_FED_REQUIRES,
  extraction: PAGE_FED_REQUIRES,
  media: PAGE_FED_REQUIRES,
  pages: PAGE_FED_REQUIRES,
  'sampled-pages': PAGE_FED_REQUIRES,
  'structured-fields': PAGE_FED_REQUIRES,
  'text-metrics': PAGE_FED_REQUIRES,
  tokens: PAGE_FED_REQUIRES,
  'ua-parity': PAGE_FED_REQUIRES,
  author: ORIGIN_ONLY_REQUIRES,
  conditional: ORIGIN_ONLY_REQUIRES,
  currency: ORIGIN_ONLY_REQUIRES,
  discovery: ORIGIN_ONLY_REQUIRES,
  domains: ORIGIN_ONLY_REQUIRES,
  feeds: ORIGIN_ONLY_REQUIRES,
  'fetch-classify': ORIGIN_ONLY_REQUIRES,
  mcp: ORIGIN_ONLY_REQUIRES,
  openapi: ORIGIN_ONLY_REQUIRES,
  robots: ORIGIN_ONLY_REQUIRES,
  rsl: ORIGIN_ONLY_REQUIRES,
  security: ORIGIN_ONLY_REQUIRES,
  sitemap: ORIGIN_ONLY_REQUIRES,
};

/**
 * The deliberate disagreements (design §7.4).
 *
 * The runner rejects an unread scan before this evidence gate applies. These
 * exemptions state what an audit still needs after that check. A shell or a
 * response envelope can hold the fact that an audit judges, so requiring
 * rendered text would delete that finding. Each entry names the keys dropped
 * from what the source would otherwise imply.
 */
export const GATE_EXEMPTIONS = {
  'content-extraction/server-rendered': {
    drop: ['rendered-body', 'sample-adequate'],
    reason: 'A shell is what this audit reports. Gating it would delete the finding.',
  },
  'operability-safety/no-blocking-captcha': {
    drop: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    reason:
      'The runner rejects an unread scan first. On a readable response, wafProtection ' +
      'can identify a captcha wall without rendered text or an adequate page sample.',
  },
  // The id here was `operability-safety/no-bot-detection` until 2026-08-28 — a
  // category that does not hold this audit, so the entry matched nothing and
  // the drop came only from BLOCK_EXEMPT_CATEGORY.
  'access-crawl-control/no-bot-detection': {
    drop: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    reason:
      'The runner rejects an unread scan first. On a readable response, wafProtection ' +
      'can identify a bot-defense product without rendered text or an adequate sample.',
  },
  'access-crawl-control/no-redirect-chains': {
    drop: ['origin-reachable', 'rendered-body', 'sample-adequate'],
    reason:
      'The runner rejects an unread scan first. On a readable response, request and final ' +
      'URLs prove the redirect chain without rendered text or an adequate page sample.',
  },
  // The seven below share one shape. `check-requires` derives `rendered-body`
  // from the source touching `ctx.pages`, but each of these reads the response
  // envelope — head markup, headers, robots.txt, transport timing, the URL —
  // and a JS shell serves all of that in full. Gating them on rendered text
  // would withhold a verdict the scan is holding.
  'access-crawl-control/no-nofollow': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Reads `<meta name="robots">` and the X-Robots-Tag header. A body that renders no ' +
      'text still carries both.',
  },
  'access-crawl-control/robots-directives': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Reads robots directives from meta tags and the X-Robots-Tag header, both served ' +
      'whole by a page whose body is empty.',
  },
  'access-crawl-control/robots-ai-group-shadowing': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'The verdict comes from robots.txt. The scanned pages only contribute extra probe ' +
      'paths, so a shell narrows the probe set without changing what is judged.',
  },
  'content-extraction/language-attribute': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Reads the `lang` attribute on `<html>`, which is served before any body renders.',
  },
  'content-extraction/server-responsiveness': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Measures TTFB from the response. A shell answers as fast or as slow as anything ' +
      'else the origin serves.',
  },
  'answer-readiness/descriptive-urls': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Judges the URL strings of the pages the scan fetched. A URL is readable whether or ' +
      'not the page behind it rendered text.',
  },
  'operability-safety/third-party-dom-write-blast-radius': {
    drop: ['rendered-body', 'sample-adequate'],
    reason:
      'Every origin the served HTML names is counted whether or not the body renders, and ' +
      'a page that ships a vendor script statically is the case worth reporting. The audit ' +
      'declines its own empty census on a shell rather than certifying one.',
  },
  'access-crawl-control/https-enabled': {
    drop: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    reason:
      'The runner rejects an unread scan first. Once a response is readable, the base URL ' +
      'proves the transport without rendered text or an adequate page sample.',
  },
};

/** Every audit in `access-crawl-control` is about being refused. */
const BLOCK_EXEMPT_CATEGORY = 'access-crawl-control';

/** Read every registered audit source under `packages/core/src/audits`. */
export function auditSourceFiles(repoRoot) {
  const base = path.join(repoRoot, 'packages/core/src/audits');
  const files = [];
  for (const category of fs.readdirSync(base)) {
    const dir = path.join(base, category);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.ts')) continue;
      if (file.endsWith('.test.ts') || file === 'index.ts') continue;
      files.push(path.join(dir, file));
    }
  }
  return files.sort();
}

/**
 * Every `category/slug` id an audit source declares.
 *
 * A source may hold other `id:` fields — `sensitive-paths` names its URL
 * spaces that way — so the shape is filtered here and the caller picks the one
 * the registry knows.
 */
export function declaredIds(source) {
  return [...source.matchAll(/^\s*id:\s*['"]([^'"]+)['"]/gm)]
    .map((m) => m[1])
    .filter((id) => /^[a-z][a-z-]*\/[a-z0-9-]+$/.test(id));
}

/** The `requires` array an audit source declares, or null when it has none. */
export function declaredRequires(source) {
  const match = source.match(/^\s*requires:\s*\[([^\]]*)\]/m);
  if (!match) return null;
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/** Gatherer module names an audit imports. */
export function importedGatherers(source) {
  return [...source.matchAll(/from\s+['"][^'"]*gatherers\/([a-z-]+)['"]/g)].map((m) => m[1]);
}

/** Whether an audit reads the sampled pages itself. */
export function readsPagesDirectly(source) {
  return /\bctx\.pages\b/.test(source);
}

/**
 * The a11y audits read every scanned page through `A11yBackedAudit`, which
 * lives in `operability-safety/_shared.ts` rather than under `gatherers/`.
 * Spreading its `base` is therefore a page read, and it is where those audits
 * declare `requires` once for all of them.
 */
export function usesA11yBase(source) {
  return /from\s+['"]\.\/_shared['"]/.test(source) && /\.\.\.base\b/.test(source);
}

/**
 * What an audit's `requires` should say, given what its source reads.
 *
 * Returns `{ expected, unknownGatherers, exemption }`. `expected` is already
 * exemption-adjusted, so a caller compares it to the declaration as-is.
 */
export function expectedRequires(source, id) {
  const gatherers = importedGatherers(source);
  const unknownGatherers = gatherers.filter((name) => !(name in GATHERER_EVIDENCE));

  const keys = new Set(ORIGIN_ONLY_REQUIRES);
  if (readsPagesDirectly(source) || usesA11yBase(source)) {
    for (const key of PAGE_FED_REQUIRES) keys.add(key);
  }
  for (const name of gatherers) {
    for (const key of GATHERER_EVIDENCE[name] ?? []) keys.add(key);
  }

  const exemption = GATE_EXEMPTIONS[id ?? ''];
  const dropped = new Set(exemption?.drop ?? []);
  if (id?.startsWith(`${BLOCK_EXEMPT_CATEGORY}/`)) dropped.add('unblocked-fetches');
  for (const key of dropped) keys.delete(key);

  const expected = EVIDENCE_KEYS.filter((key) => keys.has(key));
  return { expected, unknownGatherers, exemption };
}
