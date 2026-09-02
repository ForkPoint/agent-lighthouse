import { describe, it, expect } from "vitest";
import { AuditResultSchema } from "./schemas";
import {
  detailLines,
  truncateLine,
  capDetailList,
  MAX_DETAIL_ITEMS,
  MAX_DETAIL_CHARS,
} from "./detail-lines";

/**
 * The caps here are the schema's, so they are asserted against the schema
 * rather than against copies of the numbers.
 */

/** Whether `details` survives the schema an audit result is validated with. */
function accepted(details: Record<string, unknown>): boolean {
  return AuditResultSchema.safeParse({ status: "fail", score: 0, details })
    .success;
}

describe("detailLines", () => {
  it("renders each item through the callback", () => {
    expect(detailLines([1, 2, 3], (n) => `n=${n}`)).toEqual([
      "n=1",
      "n=2",
      "n=3",
    ]);
  });

  it("honours the caller-supplied limit", () => {
    expect(detailLines([1, 2, 3, 4], (n) => String(n), 2)).toEqual(["1", "2"]);
  });

  it("never exceeds the schema cap, whatever limit the caller asks for", () => {
    const many = Array.from({ length: 500 }, (_v, i) => i);
    const lines = detailLines(many, String, 400);
    expect(lines).toHaveLength(MAX_DETAIL_ITEMS);
    expect(accepted({ items: lines })).toBe(true);
  });

  it("truncates an over-long line rather than dropping it", () => {
    const lines = detailLines(["x".repeat(5000)], (s) => s);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(MAX_DETAIL_CHARS);
    expect(accepted({ items: lines })).toBe(true);
  });

  it("returns an empty array for no items", () => {
    expect(detailLines([], String)).toEqual([]);
  });

  // The combination is what broke on real storefronts: many findings, each of
  // them quoting page markup of unbounded length.
  it("survives the schema when both caps are exceeded at once", () => {
    const items = Array.from({ length: 400 }, () => "y".repeat(4000));
    expect(accepted({ items: detailLines(items, (s) => s) })).toBe(true);
  });
});

describe("truncateLine", () => {
  it("leaves a short line alone", () => {
    expect(truncateLine("short")).toBe("short");
  });

  it("leaves a line of exactly the cap alone", () => {
    const exact = "z".repeat(MAX_DETAIL_CHARS);
    expect(truncateLine(exact)).toBe(exact);
  });

  it("marks where a long line was cut", () => {
    const cut = truncateLine("z".repeat(MAX_DETAIL_CHARS + 1));
    expect(cut).toHaveLength(MAX_DETAIL_CHARS);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("capDetailList", () => {
  it("caps an already-rendered list", () => {
    const lines = capDetailList(
      Array.from({ length: 300 }, (_v, i) => `line ${i}`),
    );
    expect(lines).toHaveLength(MAX_DETAIL_ITEMS);
    expect(lines[0]).toBe("line 0");
  });

  it("honours a tighter caller limit", () => {
    expect(capDetailList(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});
