import { describe, it, expect } from 'vitest';
import { FakeHeadingsAudit } from './fake-headings';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('FakeHeadingsAudit', () => {
  const audit = new FakeHeadingsAudit();

  it('passes with a proper h1-h3 heading structure', () => {
    const html = `<html><body>
      <h1>Page Title</h1>
      <h2>Section One</h2>
      <p>Some body content that is clearly not a heading because it goes on and on.</p>
      <h3>Subsection</h3>
      <p>More content here.</p>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No fake headings detected');
  });

  it('fails when 5 or more divs use heading-like classes', () => {
    const fake = (text: string) => `<div class="text-2xl font-bold">${text}</div>`;
    const html = `<html><body>
      <h1>Real Title</h1>
      ${fake('Fake One')}${fake('Fake Two')}${fake('Fake Three')}${fake('Fake Four')}${fake('Fake Five')}
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Found 5 fake heading(s)');
  });

  it('warns when 1-4 fake headings are found', () => {
    const html = `<html><body>
      <h1>Real Title</h1>
      <div class="text-2xl font-bold">Fake One</div>
      <div class="text-3xl font-semibold">Fake Two</div>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Found 2 fake heading(s)');
  });

  it('does not flag elements inside <nav>', () => {
    const html = `<html><body>
      <nav><div class="text-2xl font-bold">Menu Brand</div></nav>
      <h1>Real Title</h1>
      <h2>Real Section</h2>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('flags inline styles with large font-size or heavy font-weight', () => {
    const html = `<html><body>
      <h1>Real Title</h1>
      <p style="font-size: 24px">Looks Like Heading</p>
      <span style="font-weight: 700">Also Headingish</span>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Found 2 fake heading(s)');
  });

  it('does not flag containers wrapping a real heading', () => {
    const html = `<html><body>
      <div class="heading"><h2>Real Heading Inside</h2></div>
      <h1>Title</h1>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('does not flag long bold paragraphs (emphasis, not headings)', () => {
    const longText = 'This is a fairly long paragraph of body text that happens to be bold for emphasis. '.repeat(3);
    const html = `<html><body>
      <h1>Title</h1>
      <p class="font-bold">${longText}</p>
    </body></html>`;
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html, 0)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('counts fake headings across multiple pages', () => {
    const page = (n: number) =>
      `<html><body><h1>Title ${n}</h1><div class="text-xl font-bold">Fake ${n}</div></body></html>`;
    const ctx = mockCheckContext(
      [0, 1, 2, 3, 4].map((n) => mockPageContext(`https://example.com/p${n}`, page(n), n)),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Found 5 fake heading(s)');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new FakeHeadingsAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
