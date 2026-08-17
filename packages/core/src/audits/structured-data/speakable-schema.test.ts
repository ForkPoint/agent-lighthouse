import { describe, it, expect } from 'vitest';
import { SpeakableSchemaAudit } from './speakable-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`, 0);

describe('SpeakableSchemaAudit', () => {
  const audit = new SpeakableSchemaAudit();

  it('passes when a schema has speakable with a cssSelector array', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Home',
          speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.title', '.summary'] },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Speakable property');
  });

  it('detects speakable on a schema nested inside @graph', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              headline: 'X',
              speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.headline'] },
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when no speakable property is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Home' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No speakable property');
  });

  it('fails when speakable cssSelector is not an array', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          speakable: { '@type': 'SpeakableSpecification', cssSelector: '.title' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
