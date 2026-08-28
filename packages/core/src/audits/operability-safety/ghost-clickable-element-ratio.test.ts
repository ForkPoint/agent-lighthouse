import { describe, it, expect } from 'vitest';
import { GhostClickableElementRatioAudit } from './ghost-clickable-element-ratio';
import {
  mockCheckContext,
  mockPageContext,
  walledSiteContext,
} from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

/** A homepage carrying `body`, with an optional inline stylesheet. */
function page(body: string, css = ''): CheckContext {
  const style = css ? `<style>${css}</style>` : '';
  return mockCheckContext([
    mockPageContext('https://example.com/', `<html><head>${style}</head><body>${body}</body></html>`),
  ]);
}

/** N semantic buttons, to move the ratio without changing what is under test. */
const semantic = (n: number) =>
  Array.from({ length: n }, (_v, i) => `<button>Action ${i}</button>`).join('');

describe('GhostClickableElementRatioAudit', () => {
  const audit = new GhostClickableElementRatioAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes a page of native buttons at ratio 1.0', async () => {
    const result = await audit.audit(page(semantic(5)));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1.00');
  });

  it('counts a div with an inline click handler as a ghost', async () => {
    const result = await audit.audit(page(`${semantic(3)}<div onclick="go()">Add to cart</div>`));
    expect(result.found).toContain('ghost');
    expect(result.details?.['ghostCount']).toBe(1);
  });

  // The class vocabulary alone is enough: no listener, no stylesheet.
  it('counts a div whose class advertises a button as a ghost', async () => {
    const result = await audit.audit(page(`${semantic(3)}<div class="btn-primary">Buy</div>`));
    expect(result.details?.['ghostCount']).toBe(1);
  });

  it('counts a div made clickable only by a stylesheet cursor rule', async () => {
    const result = await audit.audit(
      page(`${semantic(3)}<div class="promo">Buy</div>`, '.promo { cursor: pointer }'),
    );
    expect(result.details?.['ghostCount']).toBe(1);
  });

  it('does not count the same div once it carries a role and a name', async () => {
    const result = await audit.audit(
      page(`${semantic(3)}<div role="button" class="promo">Buy</div>`, '.promo { cursor: pointer }'),
    );
    expect(result.details?.['ghostCount']).toBe(0);
  });

  it('counts an anchor with no href as a ghost and says why', async () => {
    const result = await audit.audit(page(`${semantic(3)}<a>Products</a>`));
    expect(result.details?.['ghostCount']).toBe(1);
    expect(result.found).toContain('no href');
  });

  // Two distinct defects, two distinct remediations, so `found` keeps them apart.
  it('separates the empty-name arm from the click-signal arm', async () => {
    const result = await audit.audit(page(`${semantic(3)}<button><svg></svg></button>`));
    expect(result.details?.['ghostCount']).toBe(1);
    expect(result.found).toContain('no accessible name');
  });

  it('fails below a ratio of 0.9 and warns at exactly 0.9', async () => {
    // 1 ghost of 10 targets -> 0.90 exactly.
    const atBoundary = await audit.audit(page(`${semantic(9)}<div onclick="go()">x</div>`));
    expect(atBoundary.status).toBe('warn');
    // 2 ghosts of 10 -> 0.80.
    const below = await audit.audit(
      page(`${semantic(8)}<div onclick="go()">x</div><div onclick="go()">y</div>`),
    );
    expect(below.status).toBe('fail');
  });

  it('is notApplicable when the page carries no click target of either kind', async () => {
    const result = await audit.audit(page('<p>Just prose.</p>'));
    expect(result.status).toBe('na');
  });

  // The CDP tier in the sketch needs a live browser. The audit must not claim it.
  it('does not promise the headless CDP tier in its description', () => {
    const { meta } = GhostClickableElementRatioAudit;
    expect(meta.description).not.toContain('CDP');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
  });

  // A bot wall does not have to answer with an error status. A Cloudflare
  // managed challenge is served at 200 `text/html` from the requested host,
  // and its one `role="main"` wrapper is a semantic click target — enough for
  // the survey to report a ratio of 1.00 and pass Cloudflare's markup as the
  // site's.
  it('declines when no response can be attributed to this site', async () => {
    const result = await new GhostClickableElementRatioAudit().audit(walledSiteContext());
    expect(result.status).toBe('na');
    expect(result.message).toContain('attributed to this site');
  });

});
