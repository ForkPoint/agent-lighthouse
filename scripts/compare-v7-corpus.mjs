#!/usr/bin/env node
/**
 * Compare the release runner with this checkout on identical saved responses.
 * node --import tsx scripts/compare-v7-corpus.mjs --baseline-root=/tmp/v6 --out=/tmp/comparison.json
 * The baseline must be an extracted 6.0.0 checkout with its dependencies available.
 * No snapshots or source files are rewritten. This is runner evidence, not a crawl.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import dns from "node:dns/promises";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const match = /^--(baseline-root|out)=(.+)$/.exec(arg);
    if (!match) throw new Error(`Unsupported argument: ${arg}`);
    return [match[1], match[2]];
  }),
);
if (!args["baseline-root"] || !args.out)
  throw new Error(
    "Required: --baseline-root=<6.0.0 checkout> --out=<json file>",
  );
const root = resolve(import.meta.dirname, "..");
const baselineRoot = resolve(args["baseline-root"]);
const baselineVersion = JSON.parse(
  readFileSync(resolve(baselineRoot, "packages/core/package.json")),
).version;
if (baselineVersion !== "6.0.0")
  throw new Error(`Expected baseline 6.0.0, got ${baselineVersion}`);

// Every audit fetch is stubbed below. Refuse any accidental direct HTTP request too.
const require = createRequire(resolve(root, "packages/core/package.json"));
const { MockAgent, setGlobalDispatcher } = require("undici");
const offline = new MockAgent();
offline.disableNetConnect();
setGlobalDispatcher(offline);
dns.lookup = async () => ({ address: "93.184.216.34", family: 4 });
const comparisonTime = "2026-10-07T00:00:00.000Z";
Date.now = () => Date.parse(comparisonTime);
const load = async (dir) => ({
  ...(await import(
    pathToFileURL(resolve(dir, "packages/core/src/index.ts")).href
  )),
  ...(await import(
    pathToFileURL(resolve(dir, "packages/core/src/parser.ts")).href
  )),
});
const before = await load(baselineRoot);
const after = await load(root);
const corpusDir = resolve(root, "packages/core/test-data/corpus/real");
const names = readdirSync(corpusDir)
  .filter((name) => name.endsWith(".html.gz"))
  .map((name) => name.replace(/\.html\.gz$/, ""))
  .sort();
const results = [];
const errors = [];

function page(engine, html, p, declaration) {
  const $ = engine.parseHtml(html);
  const jsonLd = engine.extractJsonLd($);
  const structuredData = [
    ...jsonLd,
    ...engine.extractMicrodata($),
    ...engine.extractRdfa($),
  ];
  const meta = engine.extractMetaTags($);
  const classification = declaration
    ? (engine.declaredPageClassification?.(declaration) ?? {
        type: declaration,
        source: "declared",
      })
    : (engine.classifyPage?.(p.url, $, structuredData, meta) ?? {
        type: engine.detectPageType(p.url, $, structuredData, meta, true),
        source: "detected",
      });
  return {
    url: p.url,
    pageType: classification.type,
    pageTypeSource: classification.source,
    classification,
    $,
    jsonLd,
    structuredData,
    meta,
    headLinks: engine.extractHeadLinks($),
    fetchResult: {
      ...p,
      url: p.redirectChain?.[0]?.from ?? p.url,
      finalUrl: p.url,
      body: html,
    },
  };
}

async function replay(engine, html, p, declaration) {
  const target = page(engine, html, p, declaration);
  // Match the orchestrator's parsed-page admission rule; preserve the attempted response.
  const pages = p.status === 200 && html ? [target] : [];
  const waf = engine.detectWafProtection(
    p.url,
    target.fetchResult,
    {},
    pages.length,
  );
  const evidence = engine.buildScanEvidence({
    requestedUrl: p.url,
    homepageResult: target.fetchResult,
    pages,
    rootFiles: {},
    wafProtection: waf,
  });
  const ctx = {
    pages,
    rootFiles: {},
    domain: new URL(p.url).hostname,
    baseUrl: new URL(p.url).origin,
    evidence,
    pageAttempts: [
      {
        url: p.url,
        pageType: target.pageType,
        source: target.pageTypeSource,
        outcome: pages.length ? "read" : "unread",
        status: p.status,
      },
    ],
    wafProtection: waf ?? undefined,
    fetch: async ({ url }) => ({
      url,
      finalUrl: url,
      status: 404,
      body: "",
      headers: {},
      ttfbMs: 0,
      totalMs: 0,
      contentType: "",
      contentLength: 0,
    }),
  };
  const result = await engine.runAudits(ctx, engine.defaultConfig);
  for (const check of result.checks) {
    if (
      (check.tags ?? []).includes("scan-error") ||
      (check.advisoryResults ?? []).some((a) =>
        (a.tags ?? []).includes("scan-error"),
      )
    )
      errors.push({
        id: check.id,
        url: p.url,
        declaration,
        explanation: check.explanation,
      });
  }
  return {
    pageType: target.pageType,
    classification: target.classification,
    evidence: {
      judgeable: evidence.judgeable,
      met: evidence.met,
      renderedByPage: evidence.renderedByPage,
    },
    runnerScore: result.overallScore,
    checks: result.checks,
  };
}

function state(check) {
  return {
    status: check.status,
    score: check.score,
    mode: check.scoreDisplayMode,
    tags: check.tags ?? [],
  };
}
function reasons(id, a, b, previous, next) {
  const out = [];
  if (previous.pageType !== next.pageType)
    out.push(
      `Page purpose changed from ${previous.pageType} to ${next.pageType}; see parser classification signals and the v7 article/general contract.`,
    );
  if (
    a.tags?.includes("skipped:page-type") !==
    b.tags?.includes("skipped:page-type")
  )
    out.push(
      "The applicable-page population changed; the runner now uses the corrected page purpose and metadata.",
    );
  if (
    a.tags?.includes("skipped:no-evidence") !==
    b.tags?.includes("skipped:no-evidence")
  )
    out.push(
      "Evidence eligibility changed for the selected population; unselected or unread pages cannot supply body evidence.",
    );
  if (
    [
      "content-extraction/single-h1",
      "content-extraction/main-element",
      "content-extraction/language-attribute",
      "content-extraction/header-footer",
      "content-extraction/hydration-payload-share",
      "access-crawl-control/no-nofollow",
    ].includes(id)
  )
    out.push(
      "P1/P2 common-check correction: evaluate the selected pages rather than requiring or preferring a homepage.",
    );
  if (a.scoreDisplayMode !== b.scoreDisplayMode)
    out.push(
      "Type-specific detected findings remain informative; only an eligible declared population can use the audit's scored mode.",
    );
  if (!out.length)
    out.push("REVIEW REQUIRED: no known applicability explanation.");
  return out;
}

for (const name of names) {
  const html = gunzipSync(
    readFileSync(resolve(corpusDir, `${name}.html.gz`)),
  ).toString("utf8");
  const p = JSON.parse(
    readFileSync(resolve(corpusDir, `${name}.json`), "utf8"),
  );
  const hash = createHash("sha256").update(html).digest("hex");
  if (hash !== p.sha256) throw new Error(`Fixture checksum differs: ${name}`);
  const legacyPurpose = page(before, html, p).pageType;
  const currentPurpose = page(after, html, p).pageType;
  // Fixed caller inputs plus an explicit migration from old content to article.
  const scenarios = [
    { name: "detected" },
    { name: "legacy-declaration", old: legacyPurpose, next: legacyPurpose },
  ];
  if (currentPurpose === "article")
    scenarios.push({
      name: "article-declaration",
      old: "content",
      next: "article",
    });
  for (const scenario of scenarios) {
    const previous = await replay(before, html, p, scenario.old);
    const next = await replay(after, html, p, scenario.next);
    const oldChecks = new Map(previous.checks.map((c) => [c.id, c]));
    const changes = next.checks.flatMap((b) => {
      const a = oldChecks.get(b.id);
      if (!a) throw new Error(`Unexpected new audit ${b.id}`);
      if (JSON.stringify(state(a)) === JSON.stringify(state(b))) return [];
      return [
        {
          id: b.id,
          before: state(a),
          after: state(b),
          reasons: reasons(b.id, a, b, previous, next),
          explanationBefore: a.explanation,
          explanationAfter: b.explanation,
        },
      ];
    });
    if (oldChecks.size !== next.checks.length)
      throw new Error("Registry sizes differ");
    const { checks: oldResults, ...oldSummary } = previous;
    const { checks: newResults, ...newSummary } = next;
    results.push({
      fixture: name,
      scenario: scenario.name,
      fixtureSha256: hash,
      url: p.url,
      capturedAt: p.capturedAt,
      status: p.status,
      storedKind: p.kind,
      before: {
        ...oldSummary,
        auditCount: oldResults.length,
        coverage: "not recorded by 6.0.0",
      },
      after: {
        ...newSummary,
        auditCount: newResults.length,
        coverage: newResults
          .filter((c) => c.coverage)
          .map((c) => ({ id: c.id, ...c.coverage })),
      },
      changes,
    });
  }
  console.log(`${name}: compared ${scenarios.length} scenarios`);
}
const output = {
  formatVersion: 1,
  comparisonTime,
  baselineVersion,
  baselineCommit: "8fb4bf8dc01a113842dc491609f02ba4e30c8904",
  candidate: "v7 working tree",
  fixtureCount: names.length,
  scenarioCount: results.length,
  limits: [
    "Runner/evidence replay, not a full crawl or a published score comparison.",
    "Only saved response headers, bodies and timings are measured. Root files are not supplied; secondary requests receive synthetic 404s.",
    "No accessibility engine results. These audits remain unassessed.",
    "DNS is stubbed; direct HTTP is disabled. This does not test network safety.",
    "One page per scenario. Mixed provenance, failed overrides, and cache concurrency use separate integration tests.",
    "runnerScore is the raw runner average before the orchestrator's unscored-scan suppression.",
  ],
  changedResults: results.reduce((n, r) => n + r.changes.length, 0),
  unexplainedChanges: results.flatMap((r) =>
    r.changes
      .filter((c) => c.reasons.some((s) => s.startsWith("REVIEW REQUIRED")))
      .map((c) => ({ fixture: r.fixture, scenario: r.scenario, id: c.id })),
  ),
  errors,
  results,
};
mkdirSync(dirname(resolve(args.out)), { recursive: true });
writeFileSync(resolve(args.out), JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify({
    fixtureCount: output.fixtureCount,
    scenarioCount: output.scenarioCount,
    changedResults: output.changedResults,
    unexplainedChanges: output.unexplainedChanges.length,
    errors: errors.length,
  }),
);
await offline.close();
if (output.unexplainedChanges.length || errors.length) process.exitCode = 1;
