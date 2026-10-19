import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { setDocument } from "./checks";
import { toVNode } from "./core";
import {
  isDataTable,
  toGrid,
  getAllCells,
  getCellPosition,
  getScope,
  isColumnHeader,
  isRowHeader,
  isDataCell,
  getHeaders,
  traverse,
} from "./table";

/**
 * Table model: data-versus-layout classification, the cell grid, and header
 * resolution.
 *
 * `td-has-header` and `th-has-data-cells` only run on tables `isDataTable`
 * accepts, and both read headers through the grid. A layout table classified
 * as data invents violations; a data table classified as layout hides them.
 * The heuristic order mirrors the WCAG-era data-table algorithm the engine
 * ports; each case below pins one exit of it.
 */

type TableArg = Parameters<typeof isDataTable>[0];
type CellArg = Parameters<typeof isDataCell>[0];

function build(body: string): Document {
  const d = new JSDOM(
    `<!doctype html><html lang="en"><head><title>T</title></head><body>${body}</body></html>`,
  ).window.document;
  setDocument(d);
  return d;
}

function table(body: string, selector = "table"): TableArg {
  const found = build(body).querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return found as unknown as TableArg;
}

function cell(d: Document, selector: string): CellArg {
  const found = d.querySelector(selector);
  if (!found) throw new Error(`no element matched ${selector}`);
  return found as unknown as CellArg;
}

/** `n` rows of `cols` plain data cells. */
function rows(n: number, cols: number, attrs = ""): string {
  const row = `<tr${attrs}>${"<td>x</td>".repeat(cols)}</tr>`;
  return row.repeat(n);
}

describe("isDataTable", () => {
  it("rejects a presentational table that is not focusable", () => {
    expect(
      isDataTable(
        table(`<table role="presentation"><tr><th>A</th></tr></table>`),
      ),
    ).toBe(false);
  });

  it("does not let role=none excuse a focusable table", () => {
    expect(
      isDataTable(
        table(`<table role="none" tabindex="0"><tr><th>A</th></tr></table>`),
      ),
    ).toBe(true);
  });

  it("accepts an editable table", () => {
    expect(
      isDataTable(table(`<table contenteditable="true">${rows(1, 1)}</table>`)),
    ).toBe(true);
  });

  it("accepts a table inside an editable region", () => {
    expect(
      isDataTable(
        table(`<div contenteditable="true"><table>${rows(1, 1)}</table></div>`),
      ),
    ).toBe(true);
  });

  it.each(["grid", "treegrid", "table"])("accepts role=%s", (role) => {
    expect(
      isDataTable(table(`<table role="${role}">${rows(1, 1)}</table>`)),
    ).toBe(true);
  });

  it("accepts a table with a landmark role", () => {
    expect(
      isDataTable(table(`<table role="navigation">${rows(1, 1)}</table>`)),
    ).toBe(true);
  });

  it("rejects a table marked datatable=0", () => {
    expect(
      isDataTable(table(`<table datatable="0"><tr><th>A</th></tr></table>`)),
    ).toBe(false);
  });

  it("accepts a table with a summary", () => {
    expect(
      isDataTable(table(`<table summary="Prices">${rows(1, 1)}</table>`)),
    ).toBe(true);
  });

  it.each([
    ["<caption>Prices</caption>", "a caption"],
    ["<thead><tr><td>A</td></tr></thead>", "a thead"],
    ["<tfoot><tr><td>A</td></tr></tfoot>", "a tfoot"],
    ['<colgroup><col span="1"></colgroup>', "a colgroup"],
  ])("accepts a table with %s (%s)", (inner) => {
    expect(isDataTable(table(`<table>${inner}${rows(1, 1)}</table>`))).toBe(
      true,
    );
  });

  it.each([
    ['<td scope="row">A</td>', "scope"],
    ['<td headers="h">A</td>', "headers"],
    ['<td abbr="A">Alpha</td>', "abbr"],
    ['<td role="rowheader">A</td>', "a header role"],
    ["<td><abbr>A</abbr></td>", "a lone abbr child"],
  ])("accepts a cell carrying %s (%s)", (td) => {
    expect(isDataTable(table(`<table><tr>${td}</tr></table>`))).toBe(true);
  });

  it("rejects a table that contains another table", () => {
    expect(
      isDataTable(
        table(
          `<table id="o"><tr><td><table>${rows(1, 1)}</table></td></tr></table>`,
          "#o",
        ),
      ),
    ).toBe(false);
  });

  it("rejects a single-row table", () => {
    expect(isDataTable(table(`<table>${rows(1, 12)}</table>`))).toBe(false);
  });

  it("rejects a table whose sample row is one plain cell", () => {
    expect(isDataTable(table(`<table>${rows(2, 1)}</table>`))).toBe(false);
  });

  it("accepts a table whose sample row has five or more cells", () => {
    expect(isDataTable(table(`<table>${rows(2, 5)}</table>`))).toBe(true);
  });

  it("accepts rows with alternating background colours", () => {
    expect(
      isDataTable(
        table(
          `<table><tr style="background-color:red"><td>a</td><td>b</td></tr><tr style="background-color:blue"><td>c</td><td>d</td></tr></table>`,
        ),
      ),
    ).toBe(true);
  });

  it("accepts rows with differing background images", () => {
    expect(
      isDataTable(
        table(
          `<table><tr style="background-image:url(a.png)"><td>a</td><td>b</td></tr><tr style="background-image:url(b.png)"><td>c</td><td>d</td></tr></table>`,
        ),
      ),
    ).toBe(true);
  });

  it("accepts a table of twenty or more rows", () => {
    expect(isDataTable(table(`<table>${rows(20, 2)}</table>`))).toBe(true);
  });

  it("rejects a small table with fewer than ten cells", () => {
    expect(isDataTable(table(`<table>${rows(3, 3)}</table>`))).toBe(false);
  });

  it("accepts a table of ten or more plain cells", () => {
    expect(isDataTable(table(`<table>${rows(5, 2)}</table>`))).toBe(true);
  });

  it("classifies a table in a document without a window", () => {
    const d = new JSDOM("").window.document.implementation.createHTMLDocument(
      "x",
    );
    d.body.innerHTML = `<table>${rows(3, 2)}</table>`;
    expect(isDataTable(d.querySelector("table") as unknown as TableArg)).toBe(
      false,
    );
  });

  it("rejects a table that embeds media", () => {
    expect(
      isDataTable(
        table(
          `<table>${rows(4, 3)}<tr><td><iframe src="/x"></iframe></td><td>x</td><td>x</td></tr></table>`,
        ),
      ),
    ).toBe(false);
  });
});

describe("toGrid", () => {
  it("expands colspan and rowspan into grid slots", () => {
    const d = build(
      '<table><tr><td id="a" rowspan="2">A</td><td id="b">B</td></tr><tr><td id="c">C</td></tr></table>',
    );
    const grid = toGrid(d.querySelector("table") as unknown as TableArg);
    expect(grid.map((r) => r.map((c) => (c as unknown as Element).id))).toEqual(
      [
        ["a", "b"],
        ["a", "c"],
      ],
    );
  });

  // rowspan=0 spans every remaining row.
  it("spans all rows for rowspan=0", () => {
    const d = build(
      '<table><tr><td id="a" rowspan="0">A</td><td id="b">B</td></tr><tr><td id="c">C</td></tr><tr><td id="e">E</td></tr></table>',
    );
    const grid = toGrid(d.querySelector("table") as unknown as TableArg);
    expect(grid.map((r) => (r[0] as unknown as Element).id)).toEqual([
      "a",
      "a",
      "a",
    ]);
  });

  it("lists every cell in row order", () => {
    const d = build(
      "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr></table>",
    );
    expect(
      getAllCells(d.querySelector("table") as unknown as TableArg).map(
        (c) => c.textContent,
      ),
    ).toEqual(["A", "B", "C"]);
  });
});

describe("getCellPosition", () => {
  it("builds the grid from the cell's own table when none is given", () => {
    const d = build('<table><tr><td>A</td><td id="t">B</td></tr></table>');
    expect(getCellPosition(cell(d, "#t"))).toEqual({ x: 1, y: 0 });
  });

  it("returns undefined for a cell outside the grid", () => {
    const d = build(
      '<table id="one"><tr><td>A</td></tr></table><table><tr><td id="t">B</td></tr></table>',
    );
    const grid = toGrid(d.querySelector("#one") as unknown as TableArg);
    expect(getCellPosition(cell(d, "#t"), grid)).toBeUndefined();
  });
});

describe("getScope", () => {
  it("reads role=columnheader as a column header", () => {
    const d = build(
      '<table><tr><td id="t" role="columnheader">A</td></tr></table>',
    );
    expect(getScope(cell(d, "#t"))).toBe("col");
  });

  it("reads role=rowheader as a row header", () => {
    const d = build(
      '<table><tr><td id="t" role="rowheader">A</td></tr></table>',
    );
    expect(getScope(cell(d, "#t"))).toBe("row");
  });

  it("returns false for a plain data cell", () => {
    const d = build('<table><tr><td id="t">A</td></tr></table>');
    expect(getScope(cell(d, "#t"))).toBe(false);
  });

  it("infers a row header from a column made only of th", () => {
    const d = build(
      '<table><tr><th id="t">A</th><td>1</td></tr><tr><th>B</th><td>2</td></tr></table>',
    );
    expect(getScope(cell(d, "#t"))).toBe("row");
    expect(isRowHeader(cell(d, "#t"))).toBe(true);
    expect(isColumnHeader(cell(d, "#t"))).toBe(false);
  });

  it("returns auto for a th in a mixed row and column", () => {
    const d = build(
      '<table><tr><td>x</td><td>1</td></tr><tr><td>y</td><th id="t">A</th></tr></table>',
    );
    expect(getScope(cell(d, "#t"))).toBe("auto");
    expect(isRowHeader(cell(d, "#t"))).toBe(true);
    expect(isColumnHeader(cell(d, "#t"))).toBe(true);
  });

  it("accepts a VNode", () => {
    const d = build('<table><tr><th id="t" scope="row">A</th></tr></table>');
    expect(getScope(toVNode(cell(d, "#t")))).toBe("row");
  });

  it("throws for an element that is not a cell", () => {
    const d = build('<table><tr id="t"><td>A</td></tr></table>');
    expect(() => getScope(cell(d, "#t"))).toThrow(TypeError);
  });
});

describe("isDataCell", () => {
  it("rejects an empty cell", () => {
    const d = build('<table><tr><td id="t"> </td></tr></table>');
    expect(isDataCell(cell(d, "#t"))).toBe(false);
  });

  it("accepts role=gridcell", () => {
    const d = build(
      '<table><tr><th id="t" role="gridcell">A</th></tr></table>',
    );
    expect(isDataCell(cell(d, "#t"))).toBe(true);
  });

  it("rejects a cell whose role is not a cell role", () => {
    const d = build(
      '<table><tr><td id="t" role="columnheader">A</td></tr></table>',
    );
    expect(isDataCell(cell(d, "#t"))).toBe(false);
  });
});

describe("getHeaders", () => {
  it("returns the headers attribute's references when they resolve", () => {
    const d = build(
      '<table><tr><th id="h1">A</th><th id="h2">B</th></tr><tr><td id="t" headers="h2">1</td><td>2</td></tr></table>',
    );
    expect(getHeaders(cell(d, "#t")).map((h) => h?.textContent)).toEqual(["B"]);
  });

  it("falls back to the grid when the headers attribute resolves to nothing", () => {
    const d = build(
      '<table><tr><th id="h1">A</th></tr><tr><td id="t" headers="nope">1</td></tr></table>',
    );
    expect(getHeaders(cell(d, "#t")).map((h) => h?.textContent)).toEqual(["A"]);
  });

  it("resolves the column header of a cell spanning every row", () => {
    const d = build(
      '<table><tr><th scope="col">A</th><th scope="col">B</th></tr><tr><td id="t" rowspan="0">1</td><td>2</td></tr><tr><td>3</td></tr></table>',
    );
    expect(getHeaders(cell(d, "#t")).map((h) => h?.textContent)).toEqual(["A"]);
  });

  it("resolves both row and column headers from the grid", () => {
    const d = build(
      '<table><tr><td></td><th scope="col">Col</th></tr><tr><th scope="row">Row</th><td id="t">1</td></tr></table>',
    );
    // Row headers are collected first, then the list is reversed.
    expect(getHeaders(cell(d, "#t")).map((h) => h?.textContent)).toEqual([
      "Col",
      "Row",
    ]);
  });
});

describe("traverse", () => {
  const grid = () => {
    const d = build(
      "<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td><td>e</td><td>f</td></tr></table>",
    );
    return toGrid(d.querySelector("table") as unknown as TableArg);
  };

  it("walks right from a position", () => {
    expect(
      traverse("right", { x: 0, y: 0 }, grid()).map((c) => c.textContent),
    ).toEqual(["b", "c"]);
  });

  it("starts at the origin when given only a grid", () => {
    expect(traverse("down", grid()).map((c) => c.textContent)).toEqual(["d"]);
  });

  it("accepts a direction vector", () => {
    expect(
      traverse({ x: 1, y: 1 }, { x: 0, y: 0 }, grid()).map(
        (c) => c.textContent,
      ),
    ).toEqual(["e"]);
  });

  it("stops at the cell the callback accepts", () => {
    expect(
      traverse("right", grid(), (c) => c.textContent === "b").map(
        (c) => c.textContent,
      ),
    ).toEqual(["b"]);
  });
});
