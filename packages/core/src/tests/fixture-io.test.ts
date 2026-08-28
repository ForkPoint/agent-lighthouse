import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import type { FetchResult } from '../fetcher';
import { classifyCapture, listFixtures, readFixture, FIXTURE_KINDS } from './fixture-io';

const response = (overrides: Partial<FetchResult> = {}): FetchResult => ({
  url: 'https://example.test/',
  finalUrl: 'https://example.test/',
  status: 200,
  headers: { 'content-type': 'text/html' },
  body: '',
  ttfbMs: 0,
  totalMs: 0,
  contentType: 'text/html',
  contentLength: 0,
  ...overrides,
});

const article = `<html><body><main><h1>A page with words on it</h1><p>${'word '.repeat(
  120,
)}</p></main></body></html>`;

describe('the real-page fixtures', () => {
  it('holds fixtures to read', () => {
    expect(listFixtures().length).toBeGreaterThan(0);
  });

  it('reads back HTML matching the SHA recorded at capture', () => {
    for (const name of listFixtures()) {
      const { html, provenance } = readFixture(name);
      const sha = createHash('sha256').update(html).digest('hex');
      expect(sha, `${name} does not match its recorded SHA`).toBe(provenance.sha256);
    }
  });

  it('records where and when each fixture came from', () => {
    for (const name of listFixtures()) {
      const { provenance } = readFixture(name);
      expect(provenance.url, name).toMatch(/^https:\/\//);
      expect(provenance.capturedAt, name).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('records what kind of thing was captured, and the status that decided it', () => {
    for (const name of listFixtures()) {
      const { provenance } = readFixture(name);
      expect(FIXTURE_KINDS, `${name} has an unknown kind`).toContain(provenance.kind);
      expect(provenance.status, name).toBeGreaterThanOrEqual(100);
    }
  });

  // A stored fixture is a status and a body, not the whole response, so a
  // wall diagnosed from headers cannot be replayed. What can be replayed is
  // the poisoning case: a refusal or an empty shell filed as a readable page.
  it('never files a refusal or an empty body as a readable page', () => {
    for (const name of listFixtures()) {
      const { html, provenance } = readFixture(name);
      if (provenance.status < 200 || provenance.status >= 300) {
        expect(provenance.kind, `${name} answered ${provenance.status}`).toBe('wall');
        continue;
      }
      const replayed = classifyCapture(response({ status: provenance.status, body: html }));
      if (provenance.kind === 'page' || provenance.kind === 'shell') {
        expect(replayed, `${name} was recorded as ${provenance.kind}`).toBe(provenance.kind);
      }
    }
  });
});

describe('classifyCapture', () => {
  it('calls a 2xx body carrying readable text a page', () => {
    expect(classifyCapture(response({ body: article }))).toBe('page');
  });

  it('calls any non-2xx response a wall, however much text it carries', () => {
    expect(classifyCapture(response({ status: 403, body: article }))).toBe('wall');
    expect(classifyCapture(response({ status: 429, body: article }))).toBe('wall');
    expect(classifyCapture(response({ status: 503, body: article }))).toBe('wall');
  });

  it('calls a 2xx bot interstitial a wall, not a shell', () => {
    const interstitial = classifyCapture(
      response({
        headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' },
        body: '<html><body>Just a moment...</body></html>',
      }),
    );
    expect(interstitial).toBe('wall');
  });

  it('calls a 2xx body with almost no readable text a shell', () => {
    expect(classifyCapture(response({ body: '<html><body><div id="root"></div></body></html>' }))).toBe(
      'shell',
    );
  });
});
