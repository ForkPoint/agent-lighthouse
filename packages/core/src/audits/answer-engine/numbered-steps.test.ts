import { describe, it, expect } from 'vitest';
import { NumberedStepsAudit } from './numbered-steps';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('NumberedStepsAudit', () => {
  const audit = new NumberedStepsAudit();

  it('passes when an ordered list is present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <h2>How to Get Started</h2>
        <ol><li>Create an account</li><li>Configure your key</li></ol>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 ordered list');
  });

  it('fails when no ordered list is present', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><main><ul><li>Bullet</li></ul></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No ordered lists');
  });

  it('fails when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('counts ordered lists across multiple pages and only records the first page url', () => {
    const page1 = mockPageContext(
      'https://example.com/page1',
      `<html><body><main><ol><li>Step 1</li><li>Step 2</li></ol></main></body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/page2',
      `<html><body><main><ol><li>Step A</li></ol><ol><li>Step B</li></ol></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('3 ordered list');
  });
});
