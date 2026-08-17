/**
 * Vendored axe-core `commons/table` helpers, adapted to real jsdom DOM. These
 * operate directly on real table elements/cells (as axe's table checks do).
 *
 * `isDataTable` keeps axe's full heuristic. The geometry-based branches
 * (offsetWidth/clientWidth borders, viewport width) degrade to their jsdom
 * (zero-layout) values exactly as the original axe-in-jsdom oracle saw them, so
 * data/layout classification stays in parity for our fixtures.
 */
import { VNode, toVNode, escapeSelector, memoize, findUp, type AnyNode } from './core';
import { getExplicitRole, getRoleType } from './aria';
import { isFocusable } from './dom';

type Cell = AnyNode & {
  nodeName: string;
  getAttribute: (a: string) => string | null;
  colSpan: number;
  rowSpan: number;
  textContent: string;
  children: ArrayLike<unknown>;
};
type Table = AnyNode & {
  rows: ArrayLike<{ cells: ArrayLike<Cell> }>;
};

export function getAllCells(tableElm: Table): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < tableElm.rows.length; r++) {
    const row = tableElm.rows[r];
    for (let c = 0; c < row.cells.length; c++) cells.push(row.cells[c]);
  }
  return cells;
}

function toGridImpl(node: Table): Cell[][] {
  const table: Cell[][] = [];
  const rows = node.rows;
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].cells;
    table[i] = table[i] || [];
    let columnIndex = 0;
    for (let j = 0; j < cells.length; j++) {
      for (let colSpan = 0; colSpan < cells[j].colSpan; colSpan++) {
        const rowspanAttr = cells[j].getAttribute('rowspan');
        const rowspanValue =
          parseInt(rowspanAttr as string, 10) === 0 || (cells[j] as unknown as { rowspan?: number }).rowspan === 0
            ? rows.length
            : cells[j].rowSpan;
        for (let rowSpan = 0; rowSpan < rowspanValue; rowSpan++) {
          table[i + rowSpan] = table[i + rowSpan] || [];
          while (table[i + rowSpan][columnIndex]) columnIndex++;
          table[i + rowSpan][columnIndex] = cells[j];
        }
        columnIndex++;
      }
    }
  }
  return table;
}

export const toGrid = memoize(toGridImpl);
export const toArray = toGrid;

function getCellPositionImpl(cell: Cell, tableGrid?: Cell[][]): { x: number; y: number } | undefined {
  if (!tableGrid) tableGrid = toGrid(findUp(cell, 'table') as unknown as Table);
  for (let rowIndex = 0; rowIndex < tableGrid.length; rowIndex++) {
    if (tableGrid[rowIndex]) {
      const index = tableGrid[rowIndex].indexOf(cell);
      if (index !== -1) return { x: index, y: rowIndex };
    }
  }
  return undefined;
}

export const getCellPosition = memoize(getCellPositionImpl);

export function getScope(el: Cell | VNode): boolean | string {
  const vNode = toVNode(el instanceof VNode ? el.actualNode : el);
  const cell = vNode.actualNode as unknown as Cell;
  const scope = vNode.attr('scope');
  const role = getExplicitRole(vNode);

  if (!['td', 'th'].includes(vNode.props.nodeName)) {
    throw new TypeError('Expected TD or TH element');
  }
  if (role === 'columnheader') return 'col';
  if (role === 'rowheader') return 'row';
  if (scope === 'col' || scope === 'row') return scope;
  if (vNode.props.nodeName !== 'th') return false;
  if (!vNode.actualNode) return 'auto';

  const tableGrid = toGrid(findUp(cell, 'table') as unknown as Table);
  const pos = getCellPosition(cell, tableGrid)!;
  const headerRow = tableGrid[pos.y].every((node) => (node as Cell).nodeName.toUpperCase() === 'TH');
  if (headerRow) return 'col';
  const headerCol = tableGrid
    .map((col) => col[pos.x])
    .every((node) => node && (node as Cell).nodeName.toUpperCase() === 'TH');
  if (headerCol) return 'row';
  return 'auto';
}

export function isColumnHeader(element: Cell | VNode): boolean {
  return ['col', 'auto'].indexOf(getScope(element) as string) !== -1;
}

export function isRowHeader(cell: Cell | VNode): boolean {
  return ['row', 'auto'].includes(getScope(cell) as string);
}

export function isDataCell(cell: Cell): boolean {
  if (!cell.children.length && !cell.textContent.trim()) return false;
  const role = getExplicitRole(cell);
  if (role) return ['cell', 'gridcell'].includes(role);
  return cell.nodeName.toUpperCase() === 'TD';
}

export function isHeader(cell: Cell): boolean {
  if (isColumnHeader(cell) || isRowHeader(cell)) return true;
  const id = cell.getAttribute('id');
  if (id) {
    const doc = (cell as unknown as { ownerDocument: { querySelector: (s: string) => unknown } }).ownerDocument;
    return !!doc.querySelector(`[headers~="${escapeSelector(id)}"]`);
  }
  return false;
}

function traverseForHeaders(headerType: 'row' | 'col', position: { x: number; y: number }, tableGrid: Cell[][]): Cell[] {
  const property = headerType === 'row' ? '_rowHeaders' : '_colHeaders';
  const predicate = headerType === 'row' ? isRowHeader : isColumnHeader;
  const startCell = tableGrid[position.y][position.x];

  const colspan = startCell.colSpan - 1;
  const rowspanAttr = startCell.getAttribute('rowspan');
  const rowspanValue =
    parseInt(rowspanAttr as string, 10) === 0 || (startCell as unknown as { rowspan?: number }).rowspan === 0
      ? tableGrid.length
      : startCell.rowSpan;
  const rowspan = rowspanValue - 1;

  const rowStart = position.y + rowspan;
  const colStart = position.x + colspan;
  const rowEnd = headerType === 'row' ? position.y : 0;
  const colEnd = headerType === 'row' ? 0 : position.x;

  let headers: Cell[] | undefined;
  const cells: Cell[] = [];
  for (let row = rowStart; row >= rowEnd && !headers; row--) {
    for (let col = colStart; col >= colEnd; col--) {
      const cell = tableGrid[row] ? tableGrid[row][col] : undefined;
      if (!cell) continue;
      const vNode = toVNode(cell) as unknown as Record<string, Cell[] | undefined>;
      if (vNode[property]) {
        headers = vNode[property];
        break;
      }
      cells.push(cell);
    }
  }
  headers = (headers || []).concat(cells.filter(predicate));
  cells.forEach((tableCell) => {
    (toVNode(tableCell) as unknown as Record<string, Cell[]>)[property] = headers as Cell[];
  });
  return headers;
}

export function getHeaders(cell: Cell, tableGrid?: Cell[][]): (Cell | null)[] {
  if (cell.getAttribute('headers')) {
    const headers = idrefs(cell, 'headers') as (Cell | null)[];
    if (headers.filter((header) => header).length) return headers;
  }
  if (!tableGrid) tableGrid = toGrid(findUp(cell, 'table') as unknown as Table);
  const position = getCellPosition(cell, tableGrid)!;
  const rowHeaders = traverseForHeaders('row', position, tableGrid);
  const colHeaders = traverseForHeaders('col', position, tableGrid);
  return ([] as (Cell | null)[]).concat(rowHeaders, colHeaders).reverse();
}

type Dir = { x: number; y: number };
function traverseTable(
  dir: Dir,
  position: { x: number; y: number },
  tableGrid: Cell[][],
  callback?: (cell: Cell, pos: { x: number; y: number }, grid: Cell[][]) => boolean | void,
): Cell[] {
  const cell = tableGrid[position.y] ? tableGrid[position.y][position.x] : undefined;
  if (!cell) return [];
  if (typeof callback === 'function') {
    if (callback(cell, position, tableGrid) === true) return [cell];
  }
  const result = traverseTable(dir, { x: position.x + dir.x, y: position.y + dir.y }, tableGrid, callback);
  result.unshift(cell);
  return result;
}

export function traverse(
  dir: Dir | string,
  startPos: { x: number; y: number } | Cell[][],
  tableGrid?: Cell[][] | ((cell: Cell) => boolean | void),
  callback?: (cell: Cell) => boolean | void,
): Cell[] {
  let pos: { x: number; y: number };
  let grid: Cell[][];
  let cb: ((cell: Cell, p: { x: number; y: number }, g: Cell[][]) => boolean | void) | undefined;
  if (Array.isArray(startPos)) {
    cb = tableGrid as (cell: Cell) => boolean | void;
    grid = startPos as Cell[][];
    pos = { x: 0, y: 0 };
  } else {
    pos = startPos as { x: number; y: number };
    grid = tableGrid as Cell[][];
    cb = callback as (cell: Cell) => boolean | void;
  }
  let d: Dir;
  if (typeof dir === 'string') {
    d = { left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 } }[dir]!;
  } else {
    d = dir;
  }
  return traverseTable(d, { x: pos.x + d.x, y: pos.y + d.y }, grid, cb);
}

// ── isDataTable ──────────────────────────────────────────────────

export function isDataTable(node: Table): boolean {
  const role = getExplicitRole(node);
  if ((role === 'presentation' || role === 'none') && !isFocusable(node)) return false;

  const el = node as unknown as {
    getAttribute: (a: string) => string | null;
    tHead?: unknown;
    tFoot?: unknown;
    caption?: unknown;
    children: ArrayLike<{ nodeName: string }>;
    getElementsByTagName: (t: string) => ArrayLike<unknown>;
    querySelector: (s: string) => unknown;
    ownerDocument: { defaultView: Window | null };
  };

  if (el.getAttribute('contenteditable') === 'true' || findUp(node, '[contenteditable="true"]')) return true;
  if (role === 'grid' || role === 'treegrid' || role === 'table') return true;
  if (getRoleType(role) === 'landmark') return true;
  if (el.getAttribute('datatable') === '0') return false;
  if (el.getAttribute('summary')) return true;
  if (el.tHead || el.tFoot || el.caption) return true;

  for (let ci = 0; ci < el.children.length; ci++) {
    if (el.children[ci].nodeName.toUpperCase() === 'COLGROUP') return true;
  }

  let cells = 0;
  const rows = node.rows;
  const rowLength = rows.length;
  let hasBorder = false;
  for (let ri = 0; ri < rowLength; ri++) {
    const row = rows[ri];
    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
      const cell = row.cells[cellIndex] as Cell & { offsetWidth?: number; clientWidth?: number; offsetHeight?: number; clientHeight?: number };
      if (cell.nodeName.toUpperCase() === 'TH') return true;
      if (
        !hasBorder &&
        (cell.offsetWidth !== cell.clientWidth || cell.offsetHeight !== cell.clientHeight)
      ) {
        hasBorder = true;
      }
      if (cell.getAttribute('scope') || cell.getAttribute('headers') || cell.getAttribute('abbr')) return true;
      if (['columnheader', 'rowheader'].includes(getExplicitRole(cell) as string)) return true;
      if (cell.children.length === 1 && (cell.children[0] as { nodeName: string }).nodeName.toUpperCase() === 'ABBR') {
        return true;
      }
      cells++;
    }
  }

  if (el.getElementsByTagName('table').length) return false;
  if (rowLength < 2) return false;

  const sampleRow = rows[Math.ceil(rowLength / 2)];
  if (sampleRow.cells.length === 1 && (sampleRow.cells[0] as Cell).colSpan === 1) return false;
  if (sampleRow.cells.length >= 5) return true;
  if (hasBorder) return true;

  const view = el.ownerDocument.defaultView;
  let bgColor: string | undefined;
  let bgImage: string | undefined;
  for (let ri = 0; ri < rowLength; ri++) {
    const row = rows[ri] as unknown as Element;
    const style = view ? view.getComputedStyle(row) : null;
    const rowBgColor = style ? style.getPropertyValue('background-color') : '';
    const rowBgImage = style ? style.getPropertyValue('background-image') : '';
    if (bgColor && bgColor !== rowBgColor) return true;
    bgColor = rowBgColor;
    if (bgImage && bgImage !== rowBgImage) return true;
    bgImage = rowBgImage;
  }

  if (rowLength >= 20) return true;

  const width = (node as unknown as { getBoundingClientRect?: () => { width: number } }).getBoundingClientRect?.().width ?? 0;
  const viewportWidth = (view as unknown as { innerWidth?: number })?.innerWidth || 1024;
  if (width > viewportWidth * 0.95) return false;
  if (cells < 10) return false;
  if (el.querySelector('object, embed, iframe, applet')) return false;
  return true;
}

// Lazy import to break aria/table cycle for idrefs.
import { idrefs } from './dom';
