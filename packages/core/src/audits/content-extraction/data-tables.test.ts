import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { DataTablesAudit } from './data-tables';
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
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
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DataTablesAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(DataTablesAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === DataTablesAudit.meta.id)?.status).toBe('na');
  });

  // A JS shell serves a head and an empty body. No table arrived, so "no data
  // tables" would be the scan reporting its own silence as the page's shape.
  it('declines a page that served no readable text', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new DataTablesAudit();
    const rendered = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(rendered.status, 'the same input rendered is judged').not.toBe('na');

    const shell = await instance.audit(shellSiteContext());
    expect(shell.status).toBe('na');
  });
});
