import { describe, it, expect } from 'vitest';
import { runA11yForHtml } from './runner';

/**
 * Regression guard for issue #11 — scans froze at 40% "Analyzing pages" and
 * never completed on large real-world storefronts.
 *
 * Root cause (after CSS-stripping was already in place): the `aria-required-parent`
 * rule's `getAriaOwners` ran a full-document `querySelector('[aria-owns~=id]')`
 * for EVERY ancestor of EVERY candidate. In jsdom `querySelector` is a JS scan
 * (not native), so this went quadratic on big DOMs — ~40s for one 8k-node page —
 * and because the work is synchronous it blocked the event loop, so no per-scan
 * timeout could interrupt it. A per-document `aria-owns` reverse index makes the
 * lookup linear.
 *
 * The DOM below took >90s to evaluate before the fix and ~1s after. The tight
 * test timeout is the real tripwire: if the quadratic path ever returns, this
 * test times out instead of silently regressing scan latency.
 */
function buildLargeMenuDom(candidates: number, depth: number): string {
  let inner = '';
  for (let i = 0; i < candidates; i++) {
    // role="menuitem" requires a menu/menubar/group parent; orphaned here so
    // every candidate reaches the getAriaOwners ancestor walk (the hot path).
    // Each is wrapped in a chain of id-bearing <div>s — the old code ran a
    // full-document querySelector for each of those ids.
    let node = `<span role="menuitem" id="mi-${i}">x${i}</span>`;
    for (let d = 0; d < depth; d++) node = `<div id="w-${i}-${d}">${node}</div>`;
    inner += node;
  }
  return `<!doctype html><html lang="en"><head><title>t</title></head><body><nav id="nav">${inner}</nav></body></html>`;
}

describe('accessibility large-DOM performance (issue #11 regression)', () => {
  it('evaluates aria-required-parent on a large orphaned-role DOM without hanging', async () => {
    const html = buildLargeMenuDom(800, 8); // ~7k nodes, all required-parent candidates
    const started = Date.now();
    const r = await runA11yForHtml(html, 'https://large.test/', ['aria-required-parent']);
    const elapsedMs = Date.now() - started;
    // All menuitems are orphaned → the rule reports a violation.
    expect(r['aria-required-parent']?.status).toBe('fail');
    // Linear path finishes in ~1–3s; the pre-fix quadratic path took >90s. The
    // 30s test timeout is the tripwire; this assert documents the budget.
    expect(elapsedMs).toBeLessThan(20000);
  }, 30000);

  it('resolves required context supplied via aria-owns (index preserves semantics)', async () => {
    // A menuitem with no DOM-ancestor menu, but a role="menu" element that
    // aria-owns it → required context IS satisfied → the rule must pass. This
    // guards that swapping the per-ancestor querySelector for the index did not
    // change the aria-owns resolution.
    const owned =
      '<!doctype html><html lang="en"><head><title>t</title></head><body>' +
      '<ul role="menu" id="m" aria-owns="mi"></ul><span role="menuitem" id="mi">x</span></body></html>';
    const orphan =
      '<!doctype html><html lang="en"><head><title>t</title></head><body>' +
      '<span role="menuitem" id="mi">x</span></body></html>';
    const ownedRes = await runA11yForHtml(owned, 'https://owns.test/', ['aria-required-parent']);
    const orphanRes = await runA11yForHtml(orphan, 'https://owns.test/', ['aria-required-parent']);
    expect(ownedRes['aria-required-parent']?.status).toBe('pass');
    expect(orphanRes['aria-required-parent']?.status).toBe('fail');
  });
});
