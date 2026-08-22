import { describe, it, expect } from 'vitest';
import { TdmRepAudit } from './tdm-rep';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { PageContext } from '../../check-context';

const page = (head = '', url = 'https://example.com/'): PageContext =>
  mockPageContext(url, `<html lang="en"><head>${head}</head><body></body></html>`);

function withHeader(p: PageContext, name: string, value: string): PageContext {
  p.fetchResult.headers[name] = value;
  return p;
}

/** A spec-shaped TDM-Rep policy: an array of objects with location + reservation. */
const specFile = (reservation: number) =>
  JSON.stringify([
    {
      location: 'https://example.com/',
      'tdm-reservation': reservation,
      'tdm-policy': 'https://example.com/tdm-policy',
    },
  ]);

describe('TdmRepAudit', () => {
  const audit = new TdmRepAudit();

  it('returns na on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe('absence is not a penalty', () => {
    // Roughly every site on the web was losing 0.5 for not adopting a
    // convention nothing consumes.
    it('is na when nothing is declared anywhere', () => {
      const result = audit.audit(
        mockCheckContext([page()], { '/.well-known/tdmrep.json': mockFetchResult('', 404) }),
      );
      expect(result.status).toBe('na');
      expect(result.status).not.toBe('warn');
    });

    it('is na when the well-known path was never fetched', () => {
      expect(audit.audit(mockCheckContext([page()])).status).toBe('na');
    });

    it('never returns fail', () => {
      expect(audit.audit(mockCheckContext([page()])).status).not.toBe('fail');
    });
  });

  describe('reservation direction is reported, not flattened', () => {
    it('distinguishes reservation=1 (rights reserved)', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="tdm-reservation" content="1">')]),
      );
      expect(result.message).toContain('reserved');
      expect(result.message).not.toContain('permitted');
      expect(result.found).toContain('1');
    });

    it('distinguishes reservation=0 (mining permitted)', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="tdm-reservation" content="0">')]),
      );
      expect(result.message).toContain('permitted');
      expect(result.message).not.toContain('rights reserved');
    });

    // describeReservation used to call anything that was not "1" an
    // affirmative grant of mining rights the publisher never made.
    it('does not report an unrecognized value as permission', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="tdm-reservation" content="yes">')]),
      );
      expect(result.status).toBe('warn');
      expect(result.message).not.toContain('permitted');
      expect(result.message).toContain('not a value the protocol defines');
    });

    it('warns when pages disagree instead of returning whichever came first', () => {
      const result = audit.audit(
        mockCheckContext([
          page('<meta name="tdm-reservation" content="1">'),
          page('<meta name="tdm-reservation" content="0">', 'https://example.com/blog'),
        ]),
      );
      expect(result.status).toBe('warn');
      expect(result.message).toContain('disagree');
    });

    it('passes when every page declares the same value', () => {
      const result = audit.audit(
        mockCheckContext([
          page('<meta name="tdm-reservation" content="1">'),
          page('<meta name="tdm-reservation" content="1">', 'https://example.com/blog'),
        ]),
      );
      expect(result.status).toBe('pass');
    });

    it('reports the policy URL when one is declared', () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            '<meta name="tdm-reservation" content="1"><meta name="tdm-policy" content="https://example.com/p">',
          ),
        ]),
      );
      expect(result.message).toContain('https://example.com/p');
    });
  });

  describe('the HTTP header — the CG calls it the preferred technique', () => {
    it('passes on a tdm-reservation response header', () => {
      const result = audit.audit(mockCheckContext([withHeader(page(), 'tdm-reservation', '1')]));
      expect(result.status).toBe('pass');
      expect(result.found).toContain('header');
    });

    it('prefers the header over the meta tag', () => {
      const result = audit.audit(
        mockCheckContext([withHeader(page('<meta name="tdm-reservation" content="0">'), 'tdm-reservation', '1')]),
      );
      expect(result.found).toContain('header');
      expect(result.message).toContain('reserved');
    });
  });

  describe('/.well-known/tdmrep.json validation', () => {
    it('passes on the spec-defined array-of-objects shape', () => {
      const result = audit.audit(
        mockCheckContext([page()], {
          '/.well-known/tdmrep.json': mockFetchResult(specFile(1), 200, 'application/json'),
        }),
      );
      expect(result.status).toBe('pass');
      expect(result.message).toContain('reserved');
      expect(result.found).toContain('tdmrep.json');
    });

    // An SPA catch-all answering 200 + text/html at an unknown well-known path
    // used to be reported as "a file exists but is not valid JSON" — a
    // confident statement about a file that does not exist.
    it('treats a 200 HTML soft-404 as no file at all', () => {
      const result = audit.audit(
        mockCheckContext([page()], {
          '/.well-known/tdmrep.json': mockFetchResult(
            '<!doctype html><html><body>Not found</body></html>',
            200,
            'text/html',
          ),
        }),
      );
      expect(result.status).toBe('na');
    });

    it('guards on a leading < even when the content-type claims JSON', () => {
      const result = audit.audit(
        mockCheckContext([page()], {
          '/.well-known/tdmrep.json': mockFetchResult('<html></html>', 200, 'application/json'),
        }),
      );
      expect(result.status).toBe('na');
    });

    it('warns when a JSON document is served but does not parse', () => {
      const result = audit.audit(
        mockCheckContext([page()], {
          '/.well-known/tdmrep.json': mockFetchResult('{ nope', 200, 'application/json'),
        }),
      );
      expect(result.status).toBe('warn');
      expect(result.message).toContain('does not parse');
    });

    it('rejects parseable JSON that is not the spec shape', () => {
      for (const body of ['123', '{"tdm-reservation":1}', '[]', '[{"location":"/"}]']) {
        const result = audit.audit(
          mockCheckContext([page()], {
            '/.well-known/tdmrep.json': mockFetchResult(body, 200, 'application/json'),
          }),
        );
        expect(result.status, body).toBe('warn');
        expect(result.message, body).toContain('array of objects');
      }
    });

    it('prefers the site-wide file over the page meta tag', () => {
      const result = audit.audit(
        mockCheckContext([page('<meta name="tdm-reservation" content="0">')], {
          '/.well-known/tdmrep.json': mockFetchResult(specFile(1), 200, 'application/json'),
        }),
      );
      expect(result.found).toContain('tdmrep.json');
      expect(result.message).toContain('reserved');
    });
  });

  describe('meta contract', () => {
    const meta = TdmRepAudit.meta;

    it('is grade C, experimental, weight 0, informative', () => {
      expect(meta.id).toBe('access-crawl-control/tdm-rep');
      expect(meta.evidenceGrade).toBe('C');
      expect(meta.tier).toBe('experimental');
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe('informative');
    });

    // The internal incoherence: a legal-compliance signal was being described
    // as if it made agents behave differently.
    it('does not claim that AI crawlers act on the declaration', () => {
      const copy = JSON.stringify(meta).toLowerCase();
      expect(copy).toContain('no major ai crawler');
      expect(copy).not.toContain('puts you in control of how ai systems may use your content');
    });
  });
});
