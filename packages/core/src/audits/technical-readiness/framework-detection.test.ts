import { describe, it, expect } from 'vitest';
import { FrameworkDetectionAudit } from './framework-detection';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FrameworkDetectionAudit', () => {
  const audit = new FrameworkDetectionAudit();

  it('detects Next.js via __NEXT_DATA__ script', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><script id="__NEXT_DATA__" type="application/json">{}</script></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Next.js');
  });

  it('detects framework via generator meta tag', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><head><meta name="generator" content="WordPress 6.0"></head><body></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('WordPress');
  });

  it('detects React via data-reactroot', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><div data-reactroot></div></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('React');
  });

  it('passes with generic message when no framework is detected', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>plain</p></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No specific frontend framework');
  });

  it('fails when there are no pages', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages available');
  });

  it('detects Nuxt.js via script src containing "nuxt"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><head><script src="/_nuxt/app.js"></script></head><body></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Nuxt.js');
  });

  it('detects Vue.js via data-v-field attribute', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><div data-v-field="name"></div></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Vue.js');
  });

  it('detects Angular via ng-version attribute', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><div ng-version="15.0.0"></div></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Angular');
  });

  it('detects Astro via style[data-astro-cid]', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><head><style data-astro-cid="abc123">body{}</style></head><body></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Astro');
  });

  it('detects Svelte via script src containing "svelte"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><script src="/build/svelte-bundle.js"></script></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Svelte');
  });
});
