import { describe, it, expect, vi } from 'vitest';
import { C2paManifestSurvivesDeliveryAudit } from './c2pa-manifest-survives-delivery';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import { MAX_RESPONSE_BODY_BYTES } from '../../constants';
import type { FetchOptions, FetchResult } from '../../fetcher';
import type { AuditResult } from '../../types';

vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return { ...actual, isSafeUrl: async (url: string) => url.startsWith('https://example.com') };
});

const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

/** A JPEG whose APP11 segment carries a JUMBF store. */
function signedJpeg(): Uint8Array {
  const payload = 'JP\x00\x01jumbc2pa manifest store';
  const length = payload.length + 2;
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xeb, (length >> 8) & 0xff, length & 0xff,
    ...Buffer.from(payload, 'latin1'),
    0xff, 0xd9,
  ]);
}

/** A JPEG with no provenance metadata at all. */
function plainJpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]);
}

interface Site {
  html: string;
  /** Bytes per image URL. Anything absent answers 404. */
  images: Record<string, Uint8Array>;
}

function run(site: Site) {
  const audit = new C2paManifestSurvivesDeliveryAudit();
  const ctx = mockCheckContext([mockPageContext('https://example.com/post', site.html)]);
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const bytes = site.images[o.url];
    if (!bytes) return mockFetchResult('', 404, 'image/jpeg');
    const result = mockFetchResult('', 200, 'image/jpeg');
    result.bytes = bytes;
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

describe('C2paManifestSurvivesDeliveryAudit', () => {
  const audit = new C2paManifestSurvivesDeliveryAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the site serves no image', async () => {
    const { result } = run({ html: '<html><body><p>Text only.</p></body></html>', images: {} });
    expect((await result).status).toBe('na');
  });

  // Nothing to strip is not a defect.
  it('is notApplicable when no image carries a manifest', async () => {
    const { result } = run({
      html: '<html><body><img src="/a.jpg"></body></html>',
      images: { 'https://example.com/a.jpg': plainJpeg() },
    });
    expect((await result).status).toBe('na');
  });

  it('fails when the origin carries a manifest and the served variant does not', async () => {
    const { result } = run({
      html: '<html><body><img src="/_next/image?url=%2Fhero.jpg&w=640&q=75"></body></html>',
      images: {
        'https://example.com/_next/image?url=%2Fhero.jpg&w=640&q=75': plainJpeg(),
        'https://example.com/hero.jpg': signedJpeg(),
      },
    });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'strippedInTransit').join(' ')).toContain('hero.jpg');
    expect(r.details?.['manifestCoverage']).toBe(0);
  });

  it('passes when the variant keeps the manifest its origin carries', async () => {
    const { result } = run({
      html: '<html><body><img src="/cdn-cgi/image/width=800/hero.jpg"></body></html>',
      images: {
        'https://example.com/cdn-cgi/image/width=800/hero.jpg': signedJpeg(),
        'https://example.com/hero.jpg': signedJpeg(),
      },
    });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(strings(r, 'preserved')).toHaveLength(1);
    expect(r.details?.['manifestCoverage']).toBe(100);
  });

  it('passes a plain signed asset with no variant form', async () => {
    const { result } = run({
      html: '<html><body><img src="/hero.jpg"></body></html>',
      images: { 'https://example.com/hero.jpg': signedJpeg() },
    });
    const r = await result;
    expect(r.status).toBe('pass');
  });

  // A store may sit past the read cap, so a truncated asset is unknown, not unsigned.
  it('skips an image larger than the read cap rather than calling it unsigned', async () => {
    const huge = new Uint8Array(MAX_RESPONSE_BODY_BYTES);
    huge.set(plainJpeg(), 0);
    const { result } = run({
      html: '<html><body><img src="/big.jpg"><img src="/hero.jpg"></body></html>',
      images: { 'https://example.com/big.jpg': huge, 'https://example.com/hero.jpg': signedJpeg() },
    });
    const r = await result;
    expect(strings(r, 'skipped').join(' ')).toContain('big.jpg');
    expect(r.details?.['imagesChecked']).toBe(1);
  });

  it('fetches at most six images and never the same one twice', async () => {
    const images: Record<string, Uint8Array> = {};
    const tags: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      images[`https://example.com/i${i}.jpg`] = signedJpeg();
      tags.push(`<img src="/i${i}.jpg">`);
    }
    // The same image twice: the second must not cost a request.
    tags.push('<img src="/i0.jpg">');
    const { result, requests } = run({ html: `<html><body>${tags.join('')}</body></html>`, images });
    await result;
    expect(requests.length).toBeLessThanOrEqual(6);
    expect(new Set(requests.map((o) => o.url)).size).toBe(requests.length);
    expect(requests.every((o) => o.binary === true)).toBe(true);
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = C2paManifestSurvivesDeliveryAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
