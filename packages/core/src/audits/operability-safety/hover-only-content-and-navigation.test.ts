import { describe, it, expect } from 'vitest';
import { HoverOnlyContentAndNavigationAudit } from './hover-only-content-and-navigation';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

/** A homepage carrying `body`, with an optional inline stylesheet. */
function page(body: string, css = ''): CheckContext {
  const style = css ? `<style>${css}</style>` : '';
  return mockCheckContext([
    mockPageContext('https://example.com/', `<html><head>${style}</head><body>${body}</body></html>`),
  ]);
}

/** A menu whose submenu holds two destinations found nowhere else. */
const MENU = (triggerAttrs = '') => `
  <nav class="nav"><ul><li>
    <a href="/products" ${triggerAttrs}>Products</a>
    <ul class="submenu" id="sub">
      <li><a href="/products/mugs">Mugs</a></li>
      <li><a href="/products/plates">Plates</a></li>
    </ul>
  </li></ul></nav>`;

const HOVER_CSS = '.submenu { display: none } .nav li:hover .submenu { display: block }';

describe('HoverOnlyContentAndNavigationAudit', () => {
  const audit = new HoverOnlyContentAndNavigationAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('fails a submenu revealed only by :hover and names every lost destination', async () => {
    const result = await audit.audit(page(MENU(), HOVER_CSS));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('/products/mugs');
    expect(result.found).toContain('/products/plates');
  });

  it('passes once a :focus-within rule reveals the same submenu', async () => {
    const result = await audit.audit(
      page(MENU(), `${HOVER_CSS} .nav li:focus-within .submenu { display: block }`),
    );
    expect(result.status).toBe('pass');
  });

  // aria-expanded plus aria-controls means a JS toggle exists; CSS is not the
  // only path to the submenu, so the audit must not guess that it is.
  it('passes when the trigger carries aria-expanded and aria-controls', async () => {
    const result = await audit.audit(
      page(MENU('aria-expanded="false" aria-controls="sub"'), HOVER_CSS),
    );
    expect(result.status).toBe('pass');
  });

  it('reports title-only information apart from the navigation findings', async () => {
    const result = await audit.audit(
      page('<span title="Ships in 3 business days">Delivery</span>'),
    );
    expect(result.details?.['titleOnly']).toBe(1);
    expect(result.details?.['hoverMenus']).toBe(0);
    expect(result.found).toContain('title');
  });

  it('reports a tooltip container no aria-describedby points at', async () => {
    const result = await audit.audit(
      page('<button>Help</button><div class="tooltip">Use the 12-digit code.</div>'),
    );
    expect(result.details?.['hoverCards']).toBe(1);
  });

  it('says the CSS was partial when a stylesheet is cross-origin', async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        `<html><head><style>${HOVER_CSS}</style><link rel="stylesheet" href="https://cdn.example.net/a.css"></head><body>${MENU()}</body></html>`,
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.found).toContain('cross-origin');
  });

  it('is notApplicable when the page has no hover rule and no hover-only content', async () => {
    const result = await audit.audit(page('<nav><a href="/products">Products</a></nav>'));
    expect(result.status).toBe('na');
  });

  // The snapshot-diff tier needs a live browser. The audit must not claim it.
  it('does not promise the headless snapshot-diff tier', () => {
    const { meta } = HoverOnlyContentAndNavigationAudit;
    expect(meta.description).not.toContain('snapshot');
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.scoreDisplayMode).toBe('binary');
  });
});
