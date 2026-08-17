import { describe, it, expect } from 'vitest';
import { HowToSchemaAudit } from './howto-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (body: string, head = '') =>
  mockPageContext('https://example.com/guide', `<html><head>${head}</head><body>${body}</body></html>`, 1);

const steps = '<h2>1. First step</h2><h2>2. Second step</h2>';
const howto = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to do X',
  step: [
    { '@type': 'HowToStep', name: 'First', text: 'Do first.' },
    { '@type': 'HowToStep', name: 'Second', text: 'Do second.' },
  ],
};

describe('HowToSchemaAudit', () => {
  const audit = new HowToSchemaAudit();

  it('warns (low) when no sequential numbered headings exist', () => {
    const ctx = mockCheckContext([page('<h2>Introduction</h2>')]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No pages with sequential numbered headings');
  });

  it('passes when stepped page has HowTo schema with a step array', () => {
    const ctx = mockCheckContext([page(steps, ld(howto))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects HowTo nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(steps, ld({ '@context': 'https://schema.org', '@graph': [howto] })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when stepped page has no HowTo schema', () => {
    const ctx = mockCheckContext([page(steps)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No HowTo schema found');
  });

  it('fails when HowTo is present but lacks a step array', () => {
    const ctx = mockCheckContext([
      page(steps, ld({ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to X' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('warns when only some pages with sequential headings have HowTo schema', () => {
    // Covers the someHave warn path
    const ctx = mockCheckContext([
      page(steps, ld(howto)),
      mockPageContext(
        'https://example.com/tutorial',
        `<html><head></head><body>${steps}</body></html>`,
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toBe('1/2 pages with HowTo schema');
  });

  it('detects HowTo with array @type and skips empty headings (Array.isArray + empty heading branch)', () => {
    // @type as an array triggers the Array.isArray branch in matchesType.
    // The empty <h2></h2> exercises the `if (text)` false branch in extractHeadings.
    const ctx = mockCheckContext([
      page(`<h2></h2>${steps}`, ld({ ...howto, '@type': ['HowTo', 'CreativeWork'] })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
