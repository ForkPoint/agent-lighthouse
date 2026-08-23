import { describe, it, expect } from 'vitest';
import { TableMarkdownRoundTripLossAudit } from './table-markdown-round-trip-loss';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { CheckContext } from '../../check-context';

/** A page whose main content is `markup`. */
function page(markup: string): CheckContext {
  return mockCheckContext([
    mockPageContext('https://example.com/', `<html><body><main>${markup}</main></body></html>`),
  ]);
}

const CLEAN = `<table>
  <tr><th>Plan</th><th>Price</th></tr>
  <tr><td>Starter</td><td>29 USD</td></tr>
  <tr><td>Team</td><td>99 USD</td></tr>
</table>`;

describe('TableMarkdownRoundTripLossAudit', () => {
  const audit = new TableMarkdownRoundTripLossAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the main content carries no data table', async () => {
    const result = await audit.audit(page('<p>Prose only.</p><table><tr><td>one</td></tr></table>'));
    expect(result.status).toBe('na');
  });

  it('passes a clean two-column table with zero loss', async () => {
    const result = await audit.audit(page(CLEAN));
    expect(result.status).toBe('pass');
    expect(result.details?.['lostCells']).toBe(0);
    expect(result.details?.['score']).toBe(1);
  });

  // GFM has no colspan: the second column it headed comes back empty.
  it('reports a spanned header by coordinate and cell text', async () => {
    const result = await audit.audit(
      page(`<table>
        <tr><th colspan="2">Revenue</th><th>Region</th></tr>
        <tr><td>2025</td><td>2026</td><td>EMEA</td></tr>
      </table>`),
    );
    expect(result.details?.['lostCells']).toBe(1);
    const findings = result.details?.['findings'] as string[];
    expect(findings[0]).toContain('row 1, column 2');
    expect(findings[0]).toContain('Revenue');
  });

  it('fails a table with no header cell and two numeric columns', async () => {
    const result = await audit.audit(
      page(`<table>
        <tr><td>2024</td><td>1200</td><td>Berlin</td></tr>
        <tr><td>2025</td><td>1450</td><td>Lisbon</td></tr>
        <tr><td>2026</td><td>1610</td><td>Dublin</td></tr>
      </table>`),
    );
    expect(result.status).toBe('fail');
    expect(result.details?.['headerlessNumericTables']).toBe(1);
    expect((result.details?.['findings'] as string[]).join(' ')).toContain('no header cell');
  });

  it('fails a table whose currency lives only in the caption', async () => {
    const result = await audit.audit(
      page(`<table>
        <caption>Monthly price in $</caption>
        <tr><th>Plan</th><th>Price</th></tr>
        <tr><td>Starter</td><td>29</td></tr>
        <tr><td>Team</td><td>99</td></tr>
      </table>`),
    );
    expect(result.status).toBe('fail');
    expect(result.details?.['strandedUnitTables']).toBe(1);
    expect((result.details?.['findings'] as string[]).join(' ')).toContain('arrive unitless');
  });

  it('reports a paragraph or list inside a cell', async () => {
    const result = await audit.audit(
      page(`<table>
        <tr><th>Plan</th><th>What you get</th></tr>
        <tr><td>Team</td><td><ul><li>Ten seats</li><li>Audit log</li></ul></td></tr>
      </table>`),
    );
    expect(result.details?.['blockContentCells']).toBe(1);
    expect((result.details?.['findings'] as string[]).join(' ')).toContain('block content');
  });

  it('reports a row whose cell count differs from the header', async () => {
    const result = await audit.audit(
      page(`<table>
        <tr><th>Plan</th><th>Price</th><th>Region</th></tr>
        <tr><td>Starter</td><td>29 USD</td></tr>
        <tr><td>Team</td><td>99 USD</td><td>EMEA</td></tr>
      </table>`),
    );
    expect(result.details?.['raggedRows']).toBe(1);
    expect((result.details?.['findings'] as string[]).join(' ')).toContain('declares 2 cell(s)');
  });

  it('scores tables with zero loss over all main-content tables', async () => {
    const result = await audit.audit(
      page(`${CLEAN}<table>
        <tr><th colspan="2">Revenue</th></tr>
        <tr><td>2025</td><td>2026</td></tr>
      </table>`),
    );
    expect(result.details?.['tables']).toBe(2);
    expect(result.details?.['survivingTables']).toBe(1);
    expect(result.details?.['score']).toBe(0.5);
    expect(result.displayValue).toBe('1/2 tables survive');
  });

  it('is a scored grade B audit', () => {
    const { meta } = TableMarkdownRoundTripLossAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
  });
});
