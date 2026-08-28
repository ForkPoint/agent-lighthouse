import { describe, it, expect } from 'vitest';
import { FigureFigcaptionAudit } from './figure-figcaption';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('FigureFigcaptionAudit', () => {
  const audit = new FigureFigcaptionAudit();

  it('passes when all <figure> elements have a <figcaption>', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><figure><img src="c.png" alt="chart"><figcaption>Fig 1.</figcaption></figure></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('passes (not applicable) when there are no figures and no images', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>Plain text</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No images or <figure>');
  });

  it('warns when there are no figures but images exist', () => {
    const page = mockPageContext('https://example.com', '<html><body><img src="a.jpg" alt="x"></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('could benefit');
  });

  it('warns when a majority but not all figures have captions', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <figure><img src="1.png" alt="a"><figcaption>One</figcaption></figure>
        <figure><img src="2.png" alt="b"><figcaption>Two</figcaption></figure>
        <figure><img src="3.png" alt="c"></figure>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when no figures have captions', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><figure><img src="1.png" alt="a"></figure><figure><img src="2.png" alt="b"></figure></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/2');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new FigureFigcaptionAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
