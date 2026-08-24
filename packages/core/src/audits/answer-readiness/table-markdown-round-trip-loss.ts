import type { AnyNode, Element } from 'domhandler';
import type { CheerioAPI } from 'cheerio';
import type { AuditMeta, AuditResult } from '../../types';
import { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import { weightForGrade } from '../../scorer';

/** Below this a table is a layout wrapper or a definition list, not a grid. */
const MIN_COLUMNS = 2;
const MIN_ROWS = 2;

/** Guard against a hostile `colspan="100000"` expanding the grid forever. */
const MAX_SPAN = 64;

/** Cells named in the report. The rest are counted. */
const REPORTED_CELLS = 10;

/** A column is numeric when this share of its body cells parse as numbers. */
const NUMERIC_MAJORITY = 0.5;

/** Below this share of tables surviving the round trip, the page fails. */
const FAIL_SCORE = 0.5;

/** Currency symbols and unit tokens that carry a cell's meaning. */
const UNIT_TOKEN = /[$€£¥₹]|%|\b(?:usd|eur|gbp|jpy|kg|mg|km|cm|mm|ms|kwh|mph|kmh|gb|mb)\b/gi;

/** A cell that reads as a number, with or without a sign, separators or a suffix. */
const NUMERIC_CELL = /^[^\p{L}\d]*[-+]?\d[\d\s.,]*\s*[^\p{L}\d]*$/u;

interface Cell {
  text: string;
  isHeader: boolean;
  row: number;
  column: number;
  colspan: number;
  rowspan: number;
}

interface TableReport {
  index: number;
  caption: string;
  lost: string[];
  ragged: string[];
  blockContent: string[];
  nested: boolean;
  headerlessNumeric: boolean;
  strandedUnits: string[];
}

/** One line of the GFM text, split on the pipes a serializer did not escape. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '\\' && line[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  // A serializer writes a leading and a trailing pipe, so the split yields an
  // empty piece at each end that is not a cell.
  return cells.slice(1, -1).map((c) => c.trim());
}

/** Collapse a cell to the single line GFM allows. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The table as the grid a reader sees, with every spanned cell repeated into
 * every coordinate it covers.
 *
 * This is the source of truth the round trip is diffed against: a header
 * spanning two columns heads both of them, whatever the markup says once.
 */
function buildGrid($: CheerioAPI, table: Element): Cell[][] {
  const grid: Array<Array<Cell | undefined>> = [];
  const rows = $(table)
    .find('tr')
    .toArray()
    .filter((tr) => $(tr).closest('table')[0] === table);

  rows.forEach((tr, rowIndex) => {
    let column = 0;
    const cells = $(tr)
      .children('th, td')
      .toArray()
      .filter((cell): cell is Element => cell.type === 'tag');
    for (const node of cells) {
      while (grid[rowIndex]?.[column] !== undefined) column += 1;
      const colspan = Math.min(MAX_SPAN, Math.max(1, Number(node.attribs['colspan']) || 1));
      const rowspan = Math.min(MAX_SPAN, Math.max(1, Number(node.attribs['rowspan']) || 1));
      const cell: Cell = {
        text: flatten($(node).text()),
        isHeader: node.tagName === 'th',
        row: rowIndex,
        column,
        colspan,
        rowspan,
      };
      for (let dr = 0; dr < rowspan; dr += 1) {
        const target = (grid[rowIndex + dr] ??= []);
        for (let dc = 0; dc < colspan; dc += 1) target[column + dc] = cell;
      }
      column += colspan;
    }
    grid[rowIndex] ??= [];
  });

  const width = Math.max(0, ...grid.map((row) => row.length));
  return grid.map((row) =>
    Array.from(
      { length: width },
      (_v, c) => row[c] ?? { text: '', isHeader: false, row: 0, column: c, colspan: 1, rowspan: 1 },
    ),
  );
}

/**
 * The grid as GFM, written the way any HTML-to-markdown converter writes it.
 *
 * GFM has no colspan, no rowspan and no second header row. A spanned cell is
 * therefore written once, at the coordinate it starts from, and the coordinates
 * it also covered are written empty. That is the loss this audit measures.
 */
function serialize(grid: Cell[][]): string {
  const line = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`;
  const width = grid[0]?.length ?? 0;
  const written = grid.map((row, r) =>
    row.map((cell, c) => (cell.row === r && cell.column === c ? cell.text : '')),
  );
  const head = written[0] ?? [];
  const body = written.slice(1);
  return [line(head), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join('\n');
}

/** Read the markdown back the way a model's reader does. */
function parse(markdown: string): string[][] {
  const lines = markdown.split('\n').filter((l) => l.trim() !== '');
  const rows = lines.filter((l) => !/^\s*\|?\s*:?-{3,}/.test(l)).map(splitRow);
  const width = rows[0]?.length ?? 0;
  return rows.map((row) =>
    Array.from({ length: width }, (_v, c) => row[c] ?? ''),
  );
}

/** Cells the source grid holds that the round trip does not return. */
function diff(grid: Cell[][], reparsed: string[][]): string[] {
  const lost: string[] = [];
  for (let r = 0; r < grid.length; r += 1) {
    const row = grid[r]!;
    for (let c = 0; c < row.length; c += 1) {
      const expected = row[c]!.text;
      const actual = reparsed[r]?.[c] ?? '';
      if (expected === actual) continue;
      const cause = row[c]!.colspan > 1 || row[c]!.rowspan > 1 ? 'spanned cell' : 'cell';
      lost.push(
        `row ${r + 1}, column ${c + 1}: ${cause} "${expected}" comes back as "${actual}"`,
      );
    }
  }
  return lost;
}

/** True when the node is an element rather than text or a comment. */
function isElement(node: AnyNode): node is Element {
  return node.type === 'tag';
}

export class TableMarkdownRoundTripLossAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'answer-readiness/table-markdown-round-trip-loss',
    category: 'answer-readiness',
    title: 'Tables survive conversion to markdown',
    failureTitle: 'Tables lose cells when converted to the markdown a model reads',
    description:
      'Converts every main-content table to GFM markdown — the representation an answer engine’s reader emits — reads it back, and diffs it cell for cell against the source grid. Reports every cell lost or displaced by coordinate, plus the tables whose numbers carry no header and whose units live only in the caption.',
    scoreDisplayMode: 'ternary',
    tier: 'scored',
    evidenceGrade: 'B',
    weight: weightForGrade('B', 'scored'),
    defaultPriority: 'medium',
    dossier: 'docs/evidence/audits/answer-readiness/table-markdown-round-trip-loss.md',
    guidance: {
      impact:
        'A model does not read your table markup. Something converts it to markdown first, and GFM markdown has no merged cells, no second header row and no lists inside a cell. A header spanning two columns arrives heading one of them; the other column of numbers arrives with no header at all. The model still answers the question — with a number read from the wrong column, stated as confidently as a right one.',
      fix: 'Flatten spanned headers into one header row of plain `th` cells, repeating the text where a span used to cover two columns. Put the unit or currency in the header cell rather than in the caption. Take paragraphs and lists out of cells. Where a table is genuinely two tables, publish it as two.',
      effort: 'moderate',
      docsUrl:
        'https://forkpoint.github.io/agent-lighthouse/audits/answer-readiness/table-markdown-round-trip-loss/',
      tags: ['tables', 'markdown', 'extraction', 'accuracy'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.notApplicable('No page was fetched.', 'A page with a data table', 'No pages');
    }
    const $ = page.$;
    const scope = $('main').length > 0 ? $('main') : $('body');
    const tables = scope
      .find('table')
      .toArray()
      .filter(isElement)
      // A table inside a table is measured as part of its outermost table.
      .filter((table) => $(table).parents('table').length === 0);

    const reports: TableReport[] = [];
    tables.forEach((table, index) => {
      const grid = buildGrid($, table);
      const width = grid[0]?.length ?? 0;
      if (width < MIN_COLUMNS || grid.length < MIN_ROWS) return;

      const reparsed = parse(serialize(grid));
      const cells = $(table).find('th, td').toArray().filter(isElement);

      const ragged: string[] = [];
      $(table)
        .find('tr')
        .toArray()
        .filter((tr) => $(tr).closest('table')[0] === table)
        .forEach((tr, rowIndex) => {
          const declared = $(tr)
            .children('th, td')
            .toArray()
            .filter(isElement)
            .reduce(
              (sum, cell) =>
                sum + Math.min(MAX_SPAN, Math.max(1, Number(cell.attribs['colspan']) || 1)),
              0,
            );
          const filled = grid[rowIndex]?.filter((c) => c.text !== '').length ?? 0;
          if (declared !== width && filled !== width) {
            ragged.push(`row ${rowIndex + 1} declares ${declared} cell(s) where the header has ${width}`);
          }
        });

      const blockContent = cells
        .filter((cell) => $(cell).find('p, ul, ol, dl, table').length > 0)
        .slice(0, REPORTED_CELLS)
        .map((cell) => `<${cell.tagName}> "${flatten($(cell).text()).slice(0, 60)}" carries block content`);

      const headerCells = cells.filter((cell) => cell.tagName === 'th');
      const bodyRows = grid.slice(1);
      let numericColumns = 0;
      for (let c = 0; c < width; c += 1) {
        const values = bodyRows.map((row) => row[c]?.text ?? '').filter((t) => t !== '');
        if (values.length === 0) continue;
        const numeric = values.filter((t) => NUMERIC_CELL.test(t)).length;
        if (numeric / values.length >= NUMERIC_MAJORITY) numericColumns += 1;
      }

      const caption = flatten($(table).children('caption').text());
      const outside = `${caption} ${flatten($(table).find('tfoot').text())}`;
      const inside = grid
        .flat()
        .map((cell) => cell.text)
        .join(' ');
      const strandedUnits = [...new Set(outside.match(UNIT_TOKEN) ?? [])].filter(
        (token) => !new RegExp(token.replace(/[$€£¥₹%]/g, '\\$&'), 'i').test(inside),
      );

      reports.push({
        index: index + 1,
        caption,
        lost: diff(grid, reparsed),
        ragged,
        blockContent,
        nested: $(table).find('table').length > 0,
        headerlessNumeric: headerCells.length === 0 && numericColumns >= 2,
        strandedUnits,
      });
    });

    if (reports.length === 0) {
      return this.notApplicable(
        'No data table in the main content.',
        'A data table with at least two rows and two columns',
        `${tables.length} table element(s), none of them a data grid`,
      );
    }

    const broken = reports.filter(
      (r) => r.lost.length > 0 || r.headerlessNumeric || r.strandedUnits.length > 0,
    );
    const corrupting = reports.filter((r) => r.headerlessNumeric || r.strandedUnits.length > 0);
    const score = (reports.length - broken.length) / reports.length;

    const findings: string[] = [];
    for (const report of reports) {
      const label = report.caption === '' ? `table ${report.index}` : `table ${report.index} (“${report.caption}”)`;
      for (const cell of report.lost.slice(0, REPORTED_CELLS)) findings.push(`${label}: ${cell}`);
      if (report.lost.length > REPORTED_CELLS) {
        findings.push(`${label}: ${report.lost.length - REPORTED_CELLS} further cell(s) lost`);
      }
      for (const row of report.ragged) findings.push(`${label}: ${row}`);
      for (const cell of report.blockContent) findings.push(`${label}: ${cell}`);
      if (report.nested) findings.push(`${label}: contains a nested table, which markdown cannot express`);
      if (report.headerlessNumeric) {
        findings.push(`${label}: two or more columns of numbers and no header cell to name them`);
      }
      if (report.strandedUnits.length > 0) {
        findings.push(
          `${label}: ${report.strandedUnits.join(', ')} appears only outside the grid, so the numbers arrive unitless`,
        );
      }
    }

    const displayValue = `${reports.length - broken.length}/${reports.length} tables survive`;
    const expected = 'Every main-content table converts to markdown and back with no cell lost';
    const found = `${reports.length - broken.length} of ${reports.length} table(s) survive the round trip; ${findings.length} finding(s).`;
    const details = {
      tables: reports.length,
      survivingTables: reports.length - broken.length,
      lostCells: reports.reduce((sum, r) => sum + r.lost.length, 0),
      raggedRows: reports.reduce((sum, r) => sum + r.ragged.length, 0),
      blockContentCells: reports.reduce((sum, r) => sum + r.blockContent.length, 0),
      headerlessNumericTables: reports.filter((r) => r.headerlessNumeric).length,
      strandedUnitTables: reports.filter((r) => r.strandedUnits.length > 0).length,
      score: Number(score.toFixed(4)),
      findings: findings.slice(0, 100),
    };

    if (corrupting.length > 0 || score < FAIL_SCORE) {
      return {
        ...this.fail(
          corrupting.length > 0
            ? `${corrupting.length} table(s) hand a model numbers it cannot name: no header, or units left outside the grid.`
            : `Only ${reports.length - broken.length} of ${reports.length} table(s) survive conversion to markdown.`,
          expected,
          found,
          'Flatten spanned headers into one plain header row, move units into the header cells, and take block content out of cells.',
        ),
        displayValue,
        details,
      };
    }

    if (broken.length > 0 || findings.length > 0) {
      return {
        ...this.warn(
          `${broken.length} of ${reports.length} table(s) lose cells on the way to markdown.`,
          expected,
          found,
          'Repeat the text of a spanned header into every column it covers, and give every row the same number of cells.',
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `All ${reports.length} table(s) convert to markdown and back with every cell intact.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
