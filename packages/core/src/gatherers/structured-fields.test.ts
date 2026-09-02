import { describe, it, expect } from "vitest";
import {
  parseDictionary,
  parseLinkHeader,
  linksWithRel,
} from "./structured-fields";

describe("parseDictionary", () => {
  it("parses the AIPREF shape", () => {
    const result = parseDictionary("train-ai=n, search=y");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value]).toEqual([
      ["train-ai", "n"],
      ["search", "y"],
    ]);
  });

  it("reads a bare key as boolean true and keeps ?0 / ?1 verbatim", () => {
    const result = parseDictionary("train-ai, search=?0");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.get("train-ai")).toBe("?1");
    expect(result.value.get("search")).toBe("?0");
  });

  it("drops parameters rather than reading one as the value", () => {
    const result = parseDictionary("train-ai=n;until=2027");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.get("train-ai")).toBe("n");
  });

  it("rejects a string value, an empty value and a bad key with a reason", () => {
    expect(parseDictionary('train-ai="n"')).toEqual({
      ok: false,
      error: '"train-ai" carries a string; AIPREF values are tokens',
    });
    expect(parseDictionary("train-ai=")).toEqual({
      ok: false,
      error: '"train-ai" has no value',
    });
    expect(parseDictionary("Train-AI=n").ok).toBe(false);
  });

  // `yes` is a syntactically valid token. It is the AIPREF category vocabulary
  // that rejects it, not the structured-field grammar, so the parser must not
  // pretend otherwise.
  it("accepts a legacy Content-Signal value as a token", () => {
    const result = parseDictionary("ai-train=yes");
    expect(result.ok).toBe(true);
  });

  it("parses an empty field as an empty dictionary", () => {
    expect(parseDictionary("   ")).toEqual({ ok: true, value: new Map() });
  });
});

describe("parseLinkHeader", () => {
  it("parses href and parameters, unquoting values", () => {
    const [entry] = parseLinkHeader(
      '<https://example.com/l.xml>; rel="license"; type=application/rsl+xml',
    );
    expect(entry?.href).toBe("https://example.com/l.xml");
    expect(entry?.params["rel"]).toBe("license");
    expect(entry?.params["type"]).toBe("application/rsl+xml");
  });

  it("does not split on a comma inside a quoted parameter", () => {
    const entries = parseLinkHeader(
      '<https://a.example/1>; rel="self"; title="one, two"',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.params["title"]).toBe("one, two");
  });

  it("splits genuine multiple entries", () => {
    const entries = parseLinkHeader(
      "<https://a.example/hub>; rel=hub, <https://a.example/f>; rel=self",
    );
    expect(entries.map((e) => e.href)).toEqual([
      "https://a.example/hub",
      "https://a.example/f",
    ]);
  });

  it("matches rel as a token list, case-insensitively", () => {
    const header = '<https://a.example/hub>; rel="Hub alternate"';
    expect(linksWithRel(header, "hub")).toHaveLength(1);
    expect(linksWithRel(header, "self")).toHaveLength(0);
  });
});
