import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
  const base = resolve(process.cwd(), 'packages/core/src/audits');
  const byId = new Map<string, string>();
  for (const category of readdirSync(base)) {
    const dir = join(base, category);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'index.ts') continue;
      const source = readFileSync(join(dir, file), 'utf8');
      // A source may hold other `id:` fields — `sensitive-paths` names its URL
      // spaces that way — so only `category/slug` shapes are taken, and the
      // caller picks the one the registry knows.
      for (const match of source.matchAll(/^\s*id:\s*'([a-z][a-z-]*\/[a-z0-9-]+)'/gm)) {
        byId.set(match[1]!, source);
      }
    }
  }
  return byId;
}

/**
 * Whether the audit decides by searching a scanned page's served HTML.
 *
 * The narrow question the shell contract needs, and it is not the one
 * `requires` answers. Several audits are exempted from `rendered-body` because
 * they read the response *envelope* — the `lang` attribute, a robots meta tag,
 * the `X-Robots-Tag` header, TTFB, the URL — all of which a JS shell serves
 * whole, so passing a shell is the right verdict for them. An audit that
 * instead runs a substring search over `page.fetchResult.body` is not in that
 * group: a shell's body is a mount point and a bundle, so "pattern not found"
 * says nothing about the site.
 *
 * That distinction is what `no-bot-detection` and `no-blocking-captcha` fell
 * through. Both declare `requires: []` so a 403 still reaches their wall
 * branch, and a filter reading the declaration therefore never asked either of
 * them anything about a shell — while both went on to report "found nothing"
 * at weight 1.0 about a body holding one empty `<div>`.
 */
export function readsServedPageBody(source: string): boolean {
  return /fetchResult\.body/.test(source);
}
