import { describe, it, expect } from 'vitest';
import { SectionHeadingsAudit } from './section-headings';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('SectionHeadingsAudit', () => {
  const audit = new SectionHeadingsAudit();

  it('passes when all sections have a heading or aria-label', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <section><h2>Pricing</h2><p>x</p></section>
        <section aria-label="Testimonials"><p>y</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2/2');
  });

  it('warns when no <section> elements are present', () => {
    const page = mockPageContext('https://example.com', '<html><body><div>No sections</div></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No <section> elements found');
  });

  it('warns when a majority but not all sections are labeled', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <section><h2>A</h2></section>
        <section><h2>B</h2></section>
        <section><p>unlabeled</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when half or fewer sections are labeled', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <section><h2>Labeled</h2></section>
        <section><p>unlabeled</p></section>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('1/2');
  });
});
