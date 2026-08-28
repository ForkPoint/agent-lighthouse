import { describe, it, expect } from 'vitest';
import { UniqueMetaAudit } from './unique-meta';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

const doc = (title: string, desc: string) =>
  `<html lang="en"><head><title>${title}</title><meta name="description" content="${desc}"></head><body></body></html>`;

describe('UniqueMetaAudit', () => {
  const audit = new UniqueMetaAudit();

  it('passes when all pages have unique title + description', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/a', doc('Page A', 'Description A'), 0),
      mockPageContext('https://example.com/b', doc('Page B', 'Description B'), 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('unique');
  });

  it('fails when two pages share title + description', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/a', doc('Same Title', 'Same desc'), 0),
      mockPageContext('https://example.com/b', doc('Same Title', 'Same desc'), 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Duplicate');
  });

  it('passes (not applicable) when fewer than 2 pages are scanned', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/a', doc('A', 'a'))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('not applicable');
  });

  it('passes (not applicable) when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('pass');
  });

  it('uses meta[name="title"] as the title source when no <title> element exists', () => {
    const pageA = `<html lang="en"><head><meta name="title" content="Meta Title A"><meta name="description" content="Desc A"></head><body></body></html>`;
    const pageB = `<html lang="en"><head><meta name="title" content="Meta Title B"><meta name="description" content="Desc B"></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/a', pageA, 0),
      mockPageContext('https://example.com/b', pageB, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('unique');
  });

  it('passes when pages have unique titles but no descriptions', () => {
    const pageA = `<html lang="en"><head><title>Page A</title></head><body></body></html>`;
    const pageB = `<html lang="en"><head><title>Page B</title></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/a', pageA, 0),
      mockPageContext('https://example.com/b', pageB, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when pages share the same title and both lack descriptions', () => {
    const page = `<html lang="en"><head><title>Same Title</title></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/a', page, 0),
      mockPageContext('https://example.com/b', page, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Duplicate');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new UniqueMetaAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
