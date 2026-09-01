import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';
import {
  scanReadPageText,
  unreadPageTextReason,
} from '../../scan-evidence';

export class DataTablesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'content-extraction/data-tables',
    category: 'content-extraction',
    title: 'Data tables properly structured',
    failureTitle: 'Data tables properly structured',
    description:
      'AI agents use <thead> and <th> elements to understand column headers and interpret table data correctly. Without proper structure, agents cannot map cell values to their column meanings, leading to garbled data extraction in AI-generated comparisons and summaries.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('B', 'scored'),
    evidenceGrade: 'B',
    tier: 'scored',
    dossier: 'docs/evidence/audits/content-extraction/data-tables.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents rely on <thead> and <th> elements to understand column headers and map cell values to their meanings. Without proper table structure, agents cannot interpret tabular data correctly, leading to garbled comparisons and inaccurate data extraction in AI-generated summaries.',
      fix: 'Add a <thead> section containing a <tr> with <th> elements for each column header. Place data rows inside a <tbody> section. Use the scope attribute on <th> elements for complex tables with row and column headers.',
      code: '<table>\n  <thead>\n    <tr><th scope="col">Feature</th><th scope="col">Value</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Speed</td><td>100ms</td></tr>\n  </tbody>\n</table>',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table',
      tags: ['tables', 'structure', 'semantic', 'html'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalTables = 0;
    let properTables = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      $('table').each((_, el) => {
        totalTables++;
        const hasTh = $(el).find('th').length > 0;
        const hasThead = $(el).find('thead').length > 0;
        // Accept tables with th in thead (column headers) or tbody (row headers)
        if (hasTh && (hasThead || $(el).find('tbody th').length > 0)) properTables++;
      });
    }

    if (totalTables === 0) {
      // A shell serves an empty body, so "no tables" is the scan finding
      // nothing to look at rather than the page having nothing to fix.
      if (!scanReadPageText(ctx.evidence)) {
        return this.notApplicable(
          'The scanned page served no readable text, so it held no tables to judge.',
          'Tables have <thead> and <th> elements',
          unreadPageTextReason(ctx.evidence),
        );
      }
      return this.pass(
        'No data tables found — check not applicable.',
        'Tables have <thead> and <th> elements',
        'No <table> elements',
      );
    }

    const allProper = properTables === totalTables;
    const majorityProper = properTables > totalTables / 2;

    if (allProper) {
      return this.pass(
        `All ${totalTables} table(s) have proper <thead> and <th> structure.`,
        'All <table> elements have <thead> and <th>',
        `${properTables}/${totalTables} properly structured tables`,
      );
    }

    if (majorityProper) {
      return this.warn(
        `${properTables}/${totalTables} table(s) have proper <thead> and <th> structure.`,
        'All <table> elements have <thead> and <th>',
        `${properTables}/${totalTables} properly structured tables`,
        {
          priority: 'medium',
          description:
            'AI agents use <thead> and <th> elements to understand column headers and interpret table data correctly. Without proper structure, agents cannot map cell values to their column meanings, leading to garbled data extraction in AI-generated comparisons and summaries.',
          code: '<table>\n  <thead><tr><th>Feature</th><th>Value</th></tr></thead>\n  <tbody><tr><td>Speed</td><td>100ms</td></tr></tbody>\n</table>',
        },
      );
    }

    return this.fail(
      `${properTables}/${totalTables} table(s) have proper <thead> and <th> structure.`,
      'All <table> elements have <thead> and <th>',
      `${properTables}/${totalTables} properly structured tables`,
      {
        priority: 'medium',
        description:
          'AI agents use <thead> and <th> elements to understand column headers and interpret table data correctly. Without proper structure, agents cannot map cell values to their column meanings, leading to garbled data extraction in AI-generated comparisons and summaries.',
        code: '<table>\n  <thead><tr><th>Feature</th><th>Value</th></tr></thead>\n  <tbody><tr><td>Speed</td><td>100ms</td></tr></tbody>\n</table>',
      },
    );
  }
}
