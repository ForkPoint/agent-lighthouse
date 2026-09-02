import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Each registered audit's own source text, keyed by its id.
 *
 * A few contract suites need to ask what an audit's file *does*, not what its
 * meta *declares* — because the interesting failures are the ones where the
 * two disagree on purpose. `scripts/lib/requires-analysis.mjs` asks the same
 * question at build time, but it is an untyped CI script that reads the built
 * bundle, and importing it from a `tsc`-checked test file drags a `.d.mts` and
 * a rootDir escape in behind it. The walk is nine lines; the duplication is
 * cheaper than the coupling.
 *
 * Anchored on the repo root: vitest is only ever run from there, and the read
 * throws loudly rather than skipping if that stops being true.
 */
export function auditSources(): Map<string, string> {
  const base = resolve(process.cwd(), "packages/core/src/audits");
  const byId = new Map<string, string>();
  for (const category of readdirSync(base)) {
    const dir = join(base, category);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (
        !file.endsWith(".ts") ||
        file.endsWith(".test.ts") ||
        file === "index.ts"
      )
        continue;
      const source = readFileSync(join(dir, file), "utf8");
      // A source may hold other `id:` fields — `sensitive-paths` names its URL
      // spaces that way — so only `category/slug` shapes are taken, and the
      // caller picks the one the registry knows.
      for (const match of source.matchAll(
        /^\s*id:\s*['"]([a-z][a-z-]*\/[a-z0-9-]+)['"]/gm,
      )) {
        byId.set(match[1]!, source);
      }
    }
  }
  return byId;
}

/**
 * Whether an audit's source reads the sampled pages itself.
 *
 * The same test `scripts/lib/requires-analysis.mjs` makes at build time to
 * decide that an audit needs `rendered-body`. Reading it here lets the shell
 * contract find the audits that were let off that key by a `GATE_EXEMPTIONS`
 * entry, without importing an untyped `.mjs` into a `tsc`-checked test.
 */
export function readsPagesDirectly(source: string): boolean {
  return /\bctx\.pages\b/.test(source);
}

/**
 * What a shell page proves about an audit that was exempted from
 * `rendered-body`.
 *
 * - `envelope` — the audit reads what a shell serves whole: the `lang`
 *   attribute, a robots meta tag, the `X-Robots-Tag` header, TTFB, the URL,
 *   the redirect chain. Its verdict on a shell is a real verdict, `pass`
 *   included, so the shell tier must not hold it to "may not pass".
 * - `body` — the audit's verdict depends on the rendered document. "Found
 *   nothing" in a body that is one empty `<div>` says nothing about the site,
 *   so a `pass` there is vacuous and the shell tier holds it.
 *
 * Declared, not inferred. The review that produced this table proposed holding
 * every `rendered-body`-exempt audit to the rule; run against the shell state
 * that convicts seven audits which are right to pass it — `language-attribute`
 * reading `<html lang="en">`, `server-responsiveness` reading TTFB — because
 * no syntactic test separates a DOM read of the envelope from a DOM read of
 * the document. The previous filter inferred it from the literal string
 * `fetchResult.body`, which missed `third-party-dom-write-blast-radius`
 * entirely: it censuses origins through `page.$`.
 *
 * The contract suite asserts this table covers every exempted audit, so a new
 * exemption fails there until someone says which kind it is.
 */
export type ShellStance = "envelope" | "body";

export const SHELL_STANCE: ReadonlyMap<string, ShellStance> = new Map<
  string,
  ShellStance
>([
  // Reads `<meta name="robots">` and the X-Robots-Tag header.
  ["access-crawl-control/no-nofollow", "envelope"],
  // Reads the redirect chain the response carries.
  ["access-crawl-control/no-redirect-chains", "envelope"],
  // Reads robots directives from meta tags and the X-Robots-Tag header.
  ["access-crawl-control/robots-directives", "envelope"],
  // Reads the request scheme and the response status.
  ["access-crawl-control/https-enabled", "envelope"],
  // The verdict comes from robots.txt; pages only contribute probe paths.
  ["access-crawl-control/robots-ai-group-shadowing", "envelope"],
  // Measures TTFB, which a shell answers with as anything else.
  ["content-extraction/server-responsiveness", "envelope"],
  // Reads the `lang` attribute on `<html>`, served before any body renders.
  ["content-extraction/language-attribute", "envelope"],
  // Judges the URL strings of the pages the scan fetched.
  ["answer-readiness/descriptive-urls", "envelope"],
  // A shell is this audit's finding: it must report it, never pass it.
  ["content-extraction/server-rendered", "body"],
  // Substring search over the served HTML for a bot-defense loader.
  ["access-crawl-control/no-bot-detection", "body"],
  // Substring search over the served HTML for CAPTCHA markup.
  ["operability-safety/no-blocking-captcha", "body"],
  // Censuses the origins the served document names, through `page.$`.
  ["operability-safety/third-party-dom-write-blast-radius", "body"],
]);
