import { describe, it, expect } from 'vitest';
import { ComparisonTablesAudit } from './comparison-tables';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ComparisonTablesAudit', () => {
  const audit = new ComparisonTablesAudit();

  it('passes when a table is present', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><main>
        <table><thead><tr><th>Feature</th><th>A</th><th>B</th></tr></thead>
        <tbody><tr><td>Price</td><td>$10</td><td>$20</td></tr></tbody></table>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 table');
  });

  it('fails when no table is present', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><main><p>No tables here.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No comparison tables');
  });

  it('fails when no pages were scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('counts tables across multiple pages and only records the first page url', () => {
    const page1 = mockPageContext(
      'https://example.com/page1',
      `<html><body><main>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
      </main></body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/page2',
      `<html><body><main>
        <table><thead><tr><th>B</th></tr></thead><tbody><tr><td>2</td></tr></tbody></table>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 table');
  });
});
