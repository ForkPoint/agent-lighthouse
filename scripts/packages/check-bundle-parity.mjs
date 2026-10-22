#!/usr/bin/env node
/**
 * Checks that core's CommonJS and ESM bundles build the same audits and reach
 * the same verdicts. Run after `pnpm build`.
 *
 * Unit tests import the TypeScript sources, so they never run either bundle.
 * The CLI and the MCP bin load the CommonJS one. Up to 9.1.0, tsup's CJS
 * output lowered the `rules` instance field of every audit made by
 * `defineA11yAudit` into a prototype method that the constructor reached
 * through one module-scope variable, so 16 of 17 accessibility audits
 * evaluated the last audit's rule. The ESM bundle was correct and no test
 * noticed.
 *
 * For every registered audit this script loads both bundles and compares:
 *
 * - the registration's meta, and that an instance's class carries the same;
 * - behaviour: each bundle builds its own copy of one small fixed scan
 *   context, runs the audit on it, and the `status`, `expected`, `found` and
 *   `message` of the two results (or the two errors) must match. The context
 *   carries accessibility results in which every engine rule has a different
 *   status, so an audit that reads another audit's rules gives itself away.
 *
 * Comparing results rather than instance fields also covers a hoisted field
 * that holds a function, such as a captured predicate, which a field
 * comparison would have to skip. Its limit is the other direction: a
 * transform bug that breaks both bundles the same way passes here, and only
 * the source tests can see it.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = join(root, "packages", "core", "dist");

const require = createRequire(import.meta.url);
const cjs = require(join(dist, "index.js"));
const esm = await import(pathToFileURL(join(dist, "index.mjs")).href);

const URL_ = "https://example.com/";
const HTML =
  '<!doctype html><html lang="en"><head><title>Widgets</title>' +
  '<meta name="description" content="Hand-finished widgets." /></head>' +
  "<body><main><h1>Widgets</h1><p>Widgets are machined from bar stock.</p>" +
  '<form action="/contact" method="post"><input type="email" name="email">' +
  '<button type="submit">Send</button></form></main></body></html>';

/** Engine rule ids, in a fixed order, as both bundles know them. */
function engineRules(mod) {
  const ids = new Set();
  for (const regs of Object.values(mod.defaultConfig.audits))
    for (const reg of regs) {
      const rules = reg.create().rules;
      if (Array.isArray(rules)) for (const r of rules) ids.add(r);
    }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * One rule result per engine rule, with the status cycling through fail,
 * pass, incomplete and inapplicable, so two different rule sets almost never
 * aggregate to the same `status` and `found`, and never to the same
 * `expected`.
 */
function a11yFixture(rules) {
  // The engine's RuleStatus values; core does not export that enum.
  const statuses = ["fail", "pass", "incomplete", "inapplicable"];
  return Object.fromEntries(
    rules.map((id, i) => {
      const status = statuses[i % statuses.length];
      const nodes =
        status === "fail"
          ? [{ target: `#${id}`, summary: `${id} violation` }]
          : [];
      return [id, { status, nodes }];
    }),
  );
}

function fetchResult(body, status, contentType) {
  return {
    url: URL_,
    finalUrl: URL_,
    status,
    body,
    headers: { "content-type": contentType },
    ttfbMs: 0,
    totalMs: 0,
    contentType,
    contentLength: body.length,
  };
}

/** A fresh scan context built from one bundle's own helpers. */
function context(mod, rules) {
  const $ = mod.parseHtml(HTML);
  const jsonLd = mod.extractJsonLd($);
  const meta = mod.extractMetaTags($);
  const page = {
    url: URL_,
    pageType: mod.detectPageType(URL_, $, jsonLd, meta, true),
    pageTypeSource: mod.PageTypeSource.Declared,
    fetchResult: fetchResult(HTML, 200, "text/html"),
    $,
    jsonLd,
    meta,
    headLinks: mod.extractHeadLinks($),
    a11yResults: a11yFixture(rules),
  };
  return {
    pages: [page],
    rootFiles: {},
    domain: "example.com",
    baseUrl: "https://example.com",
    fetch: async () => fetchResult("", 404, "text/plain"),
    evidence: mod.allEvidenceMet(),
  };
}

/** The comparable part of one audit run: its verdict, or its error. */
async function verdict(reg, ctx) {
  try {
    const r = await reg.create().audit(ctx);
    return {
      status: r?.status,
      expected: r?.expected,
      found: r?.found,
      message: r?.message,
    };
  } catch (err) {
    return { error: String(err) };
  }
}

/** id -> { meta, staticMeta, verdict } for one bundle's default registry. */
async function snapshot(mod, rules) {
  const out = new Map();
  for (const regs of Object.values(mod.defaultConfig.audits)) {
    for (const reg of regs) {
      out.set(reg.meta.id, {
        meta: reg.meta,
        staticMeta: reg.create().constructor.meta,
        verdict: await verdict(reg, context(mod, rules)),
      });
    }
  }
  return out;
}

// One rule list for both bundles, so a bundle that wires the wrong rules
// cannot also change the fixture it is judged on.
const rules = engineRules(esm);
const fromCjs = await snapshot(cjs, rules);
const fromEsm = await snapshot(esm, rules);
const failures = [];

for (const id of new Set([...fromCjs.keys(), ...fromEsm.keys()])) {
  const c = fromCjs.get(id);
  const e = fromEsm.get(id);
  if (!c || !e) {
    failures.push(`${id}: registered only in the ${c ? "CJS" : "ESM"} bundle`);
    continue;
  }
  if (!isDeepStrictEqual(c.meta, e.meta))
    failures.push(`${id}: meta differs between bundles`);
  for (const [name, s] of [
    ["CJS", c],
    ["ESM", e],
  ]) {
    if (s.staticMeta !== s.meta)
      failures.push(
        `${id}: ${name} instance's class meta is not its registration's`,
      );
  }
  for (const key of new Set([
    ...Object.keys(c.verdict),
    ...Object.keys(e.verdict),
  ])) {
    if (!isDeepStrictEqual(c.verdict[key], e.verdict[key]))
      failures.push(
        `${id}: \`${key}\` differs — CJS ${JSON.stringify(c.verdict[key])}, ESM ${JSON.stringify(e.verdict[key])}`,
      );
  }
}

if (failures.length > 0) {
  console.error(`FAIL core CJS and ESM bundles disagree (${failures.length}):`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nRun `pnpm build` first if the bundles are stale.");
  process.exit(1);
}
console.log(
  `ok   core CJS and ESM bundles agree on ${fromEsm.size} audits (meta and verdicts)`,
);
