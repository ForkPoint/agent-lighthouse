import { describe, it, expect } from 'vitest';
import { ReportShapeError, summarize, scoreClass } from './report-viewer';

/**
 * `summarize` reads a file the visitor chose. Nothing about its contents is
 * known: it can be another tool's export, a truncated download, or something
 * written to break the page. These pin what it does with each of those.
 *
 * The pure half only — `mountReportViewer` is exercised against a DOM in
 * `report-viewer.dom.test.ts`.
 */
const REPORT = {
  scanId: 'scan-1',
  url: 'https://example.com/',
  domain: 'example.com',
  overallScore: 74,
  scoreTier: 'partially-ready',
  categories: [
    { id: 'ai-discovery', name: 'AI Discovery', weight: 1, score: 91, checks: [{ id: 'a' }, { id: 'b' }] },
    { id: 'agentic-commerce', name: 'Agentic Commerce', weight: 1, score: 42, checks: [] },
  ],
  pagesScanned: [
    { url: 'https://example.com/', pageType: 'home' },
    { url: 'https://example.com/p/1', pageType: 'product' },
  ],
  durationMs: 4200,
  scannedAt: '2026-08-23T10:00:00.000Z',
};

describe('summarize', () => {
  it('reads a real scan report', () => {
    const summary = summarize(REPORT);

    expect(summary.score).toBe(74);
    expect(summary.url).toBe('https://example.com/');
    expect(summary.tier).toBe('partially-ready');
    expect(summary.pages).toBe(2);
    expect(summary.durationMs).toBe(4200);
    expect(summary.categories).toEqual([
      { name: 'AI Discovery', score: 91, checks: 2 },
      { name: 'Agentic Commerce', score: 42, checks: 0 },
    ]);
  });

  it('refuses anything that is not a report, with a message a reader can act on', () => {
    for (const value of [null, 42, 'a string', [], {}, { overallScore: 'high' }]) {
      expect(() => summarize(value)).toThrow(ReportShapeError);
    }
    expect(() => summarize({})).toThrow(/overallScore/);
  });

  it('survives a report missing everything but its score', () => {
    const summary = summarize({ overallScore: 0 });

    expect(summary.score).toBe(0);
    expect(summary.categories).toEqual([]);
    expect(summary.pages).toBe(0);
    expect(summary.durationMs).toBe(0);
    expect(summary.url).not.toBe('');
  });

  it('drops category entries that are not categories rather than throwing', () => {
    const summary = summarize({
      overallScore: 50,
      categories: [null, 'x', { score: 10 }, { name: 'Real', score: 60, checks: 'not an array' }],
    });

    expect(summary.categories).toEqual([
      { name: 'Unnamed category', score: 10, checks: 0 },
      { name: 'Real', score: 60, checks: 0 },
    ]);
  });

  it('pulls scores and durations back into a range the page can render', () => {
    const summary = summarize({
      overallScore: 10_000,
      durationMs: -5,
      categories: [{ name: 'Negative', score: -20 }, { name: 'NaN', score: Number.NaN }],
    });

    expect(summary.score).toBe(100);
    expect(summary.durationMs).toBe(0);
    expect(summary.categories.map((c) => c.score)).toEqual([0, 0]);
  });

  it('truncates a field long enough to be a denial of service', () => {
    const summary = summarize({ overallScore: 80, url: 'https://example.com/'.padEnd(50_000, 'a') });

    expect(summary.url.length).toBeLessThan(400);
  });

  it('does not treat report text as markup', () => {
    const summary = summarize({
      overallScore: 80,
      url: '<img src=x onerror=alert(1)>',
      categories: [{ name: '<script>alert(1)</script>', score: 10 }],
    });

    // Kept verbatim: escaping belongs at the DOM boundary, and the renderer
    // writes text nodes, so the value never reaches a markup parser.
    expect(summary.url).toBe('<img src=x onerror=alert(1)>');
    expect(summary.categories[0]!.name).toBe('<script>alert(1)</script>');
  });
});

describe('scoreClass', () => {
  it('follows the published badge bands, so one score has one colour', () => {
    expect(scoreClass(90)).toBe(scoreClass(100));
    expect(scoreClass(89)).not.toBe(scoreClass(90));
    expect(scoreClass(69)).not.toBe(scoreClass(70));
    expect(scoreClass(49)).not.toBe(scoreClass(50));
  });
});
