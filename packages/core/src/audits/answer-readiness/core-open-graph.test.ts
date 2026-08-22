import { describe, it, expect } from 'vitest';
import { CoreOpenGraphAudit } from './core-open-graph';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

const ALL_OG = `
  <meta property="og:title" content="Title">
  <meta property="og:description" content="Description">
  <meta property="og:image" content="https://example.com/i.png">
  <meta property="og:url" content="https://example.com/">
`;

const SITE_NAME = '<meta property="og:site_name" content="Example Co">';

const ALL_TWITTER = `
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Title">
  <meta name="twitter:description" content="Description">
`;

const ctxFor = (head: string) =>
  mockCheckContext([mockPageContext('https://example.com/', doc(head))]);

describe('CoreOpenGraphAudit', () => {
  const audit = new CoreOpenGraphAudit();

  it('passes when all four core OG tags and og:site_name are present', () => {
    const result = audit.audit(ctxFor(ALL_OG + SITE_NAME));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All core OG tags');
  });

  it('warns when some but not all core OG tags are present', () => {
    const result = audit.audit(
      ctxFor(
        '<meta property="og:title" content="Title"><meta property="og:url" content="https://example.com/">' +
          SITE_NAME,
      ),
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:image');
    expect(result.priority).toBe('high');
  });

  it('fails when all core OG tags are missing', () => {
    const result = audit.audit(ctxFor(''));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing OG tags');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });

  // --- absorbed from og-site-name (v1 4.8) ---------------------------------

  it('reports the og:site_name value it found', () => {
    const result = audit.audit(ctxFor(ALL_OG + SITE_NAME));
    expect(result.found).toContain('Example Co');
  });

  it('warns at low priority when only og:site_name is missing', () => {
    const result = audit.audit(ctxFor(ALL_OG));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:site_name');
    expect(result.priority).toBe('low');
  });

  it('treats an unrendered template token as a missing og:site_name', () => {
    const result = audit.audit(
      ctxFor(ALL_OG + '<meta property="og:site_name" content="{{ site.title }}">'),
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:site_name');
  });

  it('treats the placeholder "Your Site Name" as a missing og:site_name', () => {
    const result = audit.audit(
      ctxFor(ALL_OG + '<meta property="og:site_name" content="Your Site Name">'),
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:site_name');
  });

  it('does not fail a page whose only OG tag is og:site_name', () => {
    // og:site_name alone still leaves all four core tags missing: the score is
    // decided by the core tags, and the recommended tag cannot rescue it.
    const result = audit.audit(ctxFor(SITE_NAME));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing OG tags');
  });

  // --- absorbed from twitter-card (v1 4.10), informational only ------------

  it('does not move the score when twitter:* tags are absent', () => {
    const withTwitter = audit.audit(ctxFor(ALL_OG + SITE_NAME + ALL_TWITTER));
    const withoutTwitter = audit.audit(ctxFor(ALL_OG + SITE_NAME));
    expect(withoutTwitter.status).toBe(withTwitter.status);
    expect(withoutTwitter.score).toBe(withTwitter.score);
    expect(withoutTwitter.priority).toBe(withTwitter.priority);
  });

  it('does not move the score when twitter:* tags are present but incomplete', () => {
    const result = audit.audit(
      ctxFor(ALL_OG + SITE_NAME + '<meta name="twitter:card" content="summary">'),
    );
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('reports a missing twitter tag as covered by its og:* fallback, not as missing', () => {
    const result = audit.audit(ctxFor(ALL_OG + SITE_NAME));
    expect(result.found).toContain('twitter:title');
    expect(result.found).toContain('og:title');
    expect(result.found?.toLowerCase()).toContain('falls back');
    expect(result.message).not.toContain('twitter:');
  });

  it('reports twitter:* with no og:* counterpart as uncovered', () => {
    const result = audit.audit(ctxFor(''));
    expect(result.found).toContain('twitter:description');
    expect(result.found?.toLowerCase()).toContain('no og:description');
  });

  it('notes a summary_large_image card with no image anywhere', () => {
    const result = audit.audit(
      ctxFor(
        '<meta property="og:title" content="Title">' +
          '<meta property="og:description" content="D">' +
          '<meta property="og:url" content="https://example.com/">' +
          '<meta name="twitter:card" content="summary_large_image">',
      ),
    );
    expect(result.found).toContain('summary_large_image');
    expect(result.found?.toLowerCase()).toContain('no image');
  });

  it('does not note the image interaction when og:image supplies one', () => {
    const result = audit.audit(
      ctxFor(ALL_OG + SITE_NAME + '<meta name="twitter:card" content="summary_large_image">'),
    );
    expect(result.status).toBe('pass');
    expect(result.found?.toLowerCase()).not.toContain('no image');
  });

  it('labels the twitter block as informational', () => {
    const result = audit.audit(ctxFor(ALL_OG + SITE_NAME));
    expect(result.found?.toLowerCase()).toContain('informational');
  });
});
