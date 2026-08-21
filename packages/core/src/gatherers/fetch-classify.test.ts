import { describe, it, expect } from 'vitest';
import { classifyFetch, isRealFile, stripBom, normalizeNewlines } from './fetch-classify';
import type { FetchResult } from '../fetcher';

const fr = (over: Partial<FetchResult>): FetchResult => ({
  url: 'https://x.test/robots.txt',
  finalUrl: 'https://x.test/robots.txt',
  status: 200,
  headers: {},
  body: 'User-agent: *\nAllow: /',
  ttfbMs: 10,
  totalMs: 20,
  contentType: 'text/plain',
  contentLength: 22,
  ...over,
});

describe('classifyFetch', () => {
  it('classifies a plain text file as ok', () => {
    expect(classifyFetch(fr({}), 'text')).toBe('ok');
  });
  it('classifies an HTML body served for a text file as soft-404', () => {
    const spa = fr({
      body: '<!doctype html><html><head><title>App</title></head><body><div id="root"></div></body></html>',
      contentType: 'text/html',
    });
    expect(classifyFetch(spa, 'text')).toBe('soft-404');
    expect(isRealFile(spa, 'text')).toBe(false);
  });
  it('classifies HTML content-type with JSON expectation as soft-404', () => {
    const spa = fr({ contentType: 'text/html', body: '<!doctype html><p>not found</p>' });
    expect(classifyFetch(spa, 'json')).toBe('soft-404');
  });
  it('accepts JSON that parses when json expected, regardless of loose content-type', () => {
    const j = fr({ contentType: 'application/octet-stream', body: '{"a":1}' });
    expect(classifyFetch(j, 'json')).toBe('ok');
  });
  it('classifies 401/403/429 as blocked', () => {
    expect(classifyFetch(fr({ status: 403 }), 'text')).toBe('blocked');
    expect(classifyFetch(fr({ status: 429 }), 'text')).toBe('blocked');
  });
  it('classifies 404/410 and undefined as missing', () => {
    expect(classifyFetch(fr({ status: 404 }), 'text')).toBe('missing');
    expect(classifyFetch(undefined, 'text')).toBe('missing');
  });
  it('classifies 5xx and fetch errors as error', () => {
    expect(classifyFetch(fr({ status: 503 }), 'text')).toBe('error');
    expect(classifyFetch(fr({ status: 0, error: 'ENOTFOUND' }), 'text')).toBe('error');
  });
  it('html expectation accepts an HTML body as ok', () => {
    expect(classifyFetch(fr({ contentType: 'text/html', body: '<!doctype html><p>hi</p>' }), 'html')).toBe('ok');
  });
});

describe('stripBom / normalizeNewlines', () => {
  it('strips UTF-8 BOM', () => {
    expect(stripBom('﻿User-agent: *')).toBe('User-agent: *');
  });
  it('leaves BOM-free text alone', () => {
    expect(stripBom('abc')).toBe('abc');
  });
  it('normalizes CRLF and CR to LF', () => {
    expect(normalizeNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });
});
