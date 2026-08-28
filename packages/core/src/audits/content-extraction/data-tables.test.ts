import { describe, it, expect } from 'vitest';
import { DataTablesAudit } from './data-tables';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

describe('DataTablesAudit', () => {
  const audit = new DataTablesAudit();

  it('passes (not applicable) when there are no tables', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>No tables</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No data tables found');
  });

  it('passes when all tables have <thead> and <th>', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body><table>
        <thead><tr><th scope="col">Feature</th><th scope="col">Value</th></tr></thead>
        <tbody><tr><td>Speed</td><td>100ms</td></tr></tbody>
      </table></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when a majority but not all tables are structured', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
        <table><tbody><tr><th>RowHdr</th><td>2</td></tr></tbody></table>
        <table><tbody><tr><td>plain</td></tr></tbody></table>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when no table has proper header structure', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><table><tbody><tr><td>plain</td></tr></tbody></table></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DataTablesAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
