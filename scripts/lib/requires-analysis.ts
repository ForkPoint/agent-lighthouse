/**
 * What evidence each audit needs, derived from what its source reads.
 *
 * The requirement is a static property of the file: an audit that touches
 * `ctx.pages`, directly or through a page-fed gatherer, cannot say anything
 * true about a scan that fetched no readable page. Deriving it here — rather
 * than inferring it at runtime — keeps the declaration in the audit's own meta
 * where a reader finds it, and lets a build-time check refuse the drift.
 */
import {
  auditSourceFiles,
  declaredIds,
  readsPagesDirectly,
} from "../../packages/core/src/tests/audit-sources";

export { auditSourceFiles, declaredIds, readsPagesDirectly };

/** Every evidence key, in the order they are declared in `scan-evidence.ts`. */
export const EVIDENCE_KEYS: readonly string[] = [
  "origin-reachable",
  "unblocked-fetches",
  "rendered-body",
  "sample-adequate",
];

/** What an audit needs when it reads pages, and when it does not. */
const PAGE_FED_REQUIRES: readonly string[] = EVIDENCE_KEYS;
const ORIGIN_ONLY_REQUIRES: readonly string[] = [
  "origin-reachable",
  "unblocked-fetches",
];

/**
 * Which gatherers are fed by the sampled pages.
 *
 * The gatherer layer exists so audits do not touch `ctx.pages` directly, so a
 * pages-only grep would classify the best-behaved audits as safe and leave
 * them running blind on a shell scan. A gatherer missing from this map fails
 * the check — that is what keeps the map honest when one is added.
 */
export const GATHERER_EVIDENCE: Record<string, readonly string[]> = {
  commerce: PAGE_FED_REQUIRES,
  "css-rules": PAGE_FED_REQUIRES,
  extraction: PAGE_FED_REQUIRES,
  media: PAGE_FED_REQUIRES,
  pages: PAGE_FED_REQUIRES,
  "sampled-pages": PAGE_FED_REQUIRES,
  "structured-fields": PAGE_FED_REQUIRES,
  "text-metrics": PAGE_FED_REQUIRES,
  tokens: PAGE_FED_REQUIRES,
  "ua-parity": PAGE_FED_REQUIRES,
  author: ORIGIN_ONLY_REQUIRES,
  conditional: ORIGIN_ONLY_REQUIRES,
  currency: ORIGIN_ONLY_REQUIRES,
  discovery: ORIGIN_ONLY_REQUIRES,
  domains: ORIGIN_ONLY_REQUIRES,
  feeds: ORIGIN_ONLY_REQUIRES,
  "fetch-classify": ORIGIN_ONLY_REQUIRES,
  mcp: ORIGIN_ONLY_REQUIRES,
  openapi: ORIGIN_ONLY_REQUIRES,
  robots: ORIGIN_ONLY_REQUIRES,
  rsl: ORIGIN_ONLY_REQUIRES,
  security: ORIGIN_ONLY_REQUIRES,
  sitemap: ORIGIN_ONLY_REQUIRES,
};

export interface GateExemption {
  drop: readonly string[];
  reason: string;
}

/**
 * The deliberate disagreements (design §7.4).
 *
 * The runner rejects an unread scan before this evidence gate applies. These
 * exemptions state what an audit still needs after that check. A shell or a
 * response envelope can hold the fact that an audit judges, so requiring
 * rendered text would delete that finding. Each entry names the keys dropped
 * from what the source would otherwise imply.
 */
export const GATE_EXEMPTIONS: Record<string, GateExemption> = {
  "content-extraction/server-rendered": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "A shell is what this audit reports. Gating it would delete the finding.",
  },
  "operability-safety/no-blocking-captcha": {
    drop: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    reason:
      "The runner rejects an unread scan first. On a readable response, wafProtection " +
      "can identify a captcha wall without rendered text or an adequate page sample.",
  },
  "access-crawl-control/no-bot-detection": {
    drop: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    reason:
      "The runner rejects an unread scan first. On a readable response, wafProtection " +
      "can identify a bot-defense product without rendered text or an adequate sample.",
  },
  "access-crawl-control/no-redirect-chains": {
    drop: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    reason:
      "The runner rejects an unread scan first. On a readable response, request and final " +
      "URLs prove the redirect chain without rendered text, an adequate page sample, or unblocked status.",
  },
  "access-crawl-control/no-nofollow": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      'Reads `<meta name="robots">` and the X-Robots-Tag header. A body that renders no ' +
      "text still carries both.",
  },
  "access-crawl-control/robots-directives": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "Reads robots directives from meta tags and the X-Robots-Tag header, both served " +
      "whole by a page whose body is empty.",
  },
  "access-crawl-control/robots-ai-group-shadowing": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "The verdict comes from robots.txt. The scanned pages only contribute extra probe " +
      "paths, so a shell narrows the probe set without changing what is judged.",
  },
  "content-extraction/language-attribute": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "Reads the `lang` attribute on `<html>`, which is served before any body renders.",
  },
  "content-extraction/server-responsiveness": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "Measures TTFB from the response. A shell answers as fast or as slow as anything " +
      "else the origin serves.",
  },
  "answer-readiness/descriptive-urls": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "Judges the URL strings of the pages the scan fetched. A URL is readable whether or " +
      "not the page behind it rendered text.",
  },
  "operability-safety/third-party-dom-write-blast-radius": {
    drop: ["rendered-body", "sample-adequate"],
    reason:
      "Every origin the served HTML names is counted whether or not the body renders, and " +
      "a page that ships a vendor script statically is the case worth reporting. The audit " +
      "declines its own empty census on a shell rather than certifying one.",
  },
  "access-crawl-control/https-enabled": {
    drop: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    reason:
      "The runner rejects an unread scan first. Once a response is readable, the base URL " +
      "proves the transport without rendered text or an adequate page sample.",
  },
};

/** The `requires` array an audit source declares, or null when it has none. */
export function declaredRequires(source: string): string[] | null {
  const match = source.match(/^\s*requires:\s*\[([^\]]*)\]/m);
  if (!match) return null;
  return [...match[1]!.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

/** Gatherer module names an audit imports. */
export function importedGatherers(source: string): string[] {
  return [...source.matchAll(/from\s+['"][^'"]*gatherers\/([a-z-]+)['"]/g)].map(
    (m) => m[1]!,
  );
}

/**
 * The a11y audits read every scanned page through `A11yBackedAudit`, which
 * lives in `operability-safety/_shared.ts` rather than under `gatherers/`.
 * Spreading its `base` is therefore a page read, and it is where those audits
 * declare `requires` once for all of them.
 */
export function usesA11yBase(source: string): boolean {
  return (
    /from\s+['"]\.\/_shared['"]/.test(source) && /\.\.\.base\b/.test(source)
  );
}

export interface ExpectedRequiresResult {
  expected: string[];
  unknownGatherers: string[];
  exemption: GateExemption | undefined;
}

/**
 * What an audit's `requires` should say, given what its source reads.
 *
 * Returns `{ expected, unknownGatherers, exemption }`. `expected` is already
 * exemption-adjusted, so a caller compares it to the declaration as-is.
 */
export function expectedRequires(
  source: string,
  id: string,
): ExpectedRequiresResult {
  const gatherers = importedGatherers(source);
  const unknownGatherers = gatherers.filter(
    (name) => !(name in GATHERER_EVIDENCE),
  );

  const keys = new Set(ORIGIN_ONLY_REQUIRES);
  if (readsPagesDirectly(source) || usesA11yBase(source)) {
    for (const key of PAGE_FED_REQUIRES) keys.add(key);
  }
  for (const name of gatherers) {
    for (const key of GATHERER_EVIDENCE[name] ?? []) keys.add(key);
  }

  const exemption = GATE_EXEMPTIONS[id ?? ""];
  const dropped = new Set(exemption?.drop ?? []);
  for (const key of dropped) keys.delete(key);

  const expected = EVIDENCE_KEYS.filter((key) => keys.has(key));
  return { expected, unknownGatherers, exemption };
}
