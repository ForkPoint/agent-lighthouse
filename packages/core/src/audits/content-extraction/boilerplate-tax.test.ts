import { describe, it, expect } from "vitest";
import { BoilerplateTaxAudit } from "./boilerplate-tax";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

/** Distinct prose, seeded so two pages never share a five-word window. */
const body = (seed: string, n = 60) =>
  Array.from(
    { length: n },
    (_v, i) =>
      `${seed}${i}alpha ${seed}${i}bravo ${seed}${i}charlie ${seed}${i}delta ${seed}${i}echo ${seed}${i}foxtrot.`,
  ).join(" ");

const CHROME = `<header>${"Shop mugs kettles and cafetieres in our seasonal sale today. ".repeat(12)}</header>`;
const FOOTER = `<footer>${"Contact us about delivery returns warranty and trade accounts here. ".repeat(12)}</footer>`;

function site(
  pages: Array<{ url: string; content: string; chrome?: boolean }>,
): CheckContext {
  return mockCheckContext(
    pages.map((page, index) =>
      mockPageContext(
        page.url,
        `<html><body>${page.chrome === false ? "" : CHROME}<main><p>${page.content}</p></main>${
          page.chrome === false ? "" : FOOTER
        }</body></html>`,
        index,
      ),
    ),
  );
}

describe("BoilerplateTaxAudit", () => {
  const audit = new BoilerplateTaxAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  // Document frequency over two pages is not a measurement.
  it("is notApplicable with fewer than three pages", async () => {
    const ctx = site([
      { url: "https://example.com/a", content: body("alpha") },
      { url: "https://example.com/b", content: body("bravo") },
    ]);
    expect((await audit.audit(ctx)).status).toBe("na");
  });

  it("fails when every page repeats the same chrome around a thin body", async () => {
    const ctx = site([
      { url: "https://example.com/a", content: body("alpha", 2) },
      { url: "https://example.com/b", content: body("bravo", 2) },
      { url: "https://example.com/c", content: body("charlie", 2) },
      { url: "https://example.com/d", content: body("delta", 2) },
      { url: "https://example.com/e", content: body("echo", 2) },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("distinct");
  });

  it("passes when each page carries its own content", async () => {
    const ctx = site([
      { url: "https://example.com/a", content: body("alpha"), chrome: false },
      { url: "https://example.com/b", content: body("bravo"), chrome: false },
      { url: "https://example.com/c", content: body("charlie"), chrome: false },
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  // 4 of 5 pages is exactly 0.80, the boilerplate floor.
  it("marks a shingle boilerplate at document frequency 0.8 but not at 0.6", async () => {
    const shared = "the same nine word sentence appears on several pages here.";
    const withShared = (seed: string) => `${shared} ${body(seed)}`;
    const at80 = site([
      {
        url: "https://example.com/a",
        content: withShared("alpha"),
        chrome: false,
      },
      {
        url: "https://example.com/b",
        content: withShared("bravo"),
        chrome: false,
      },
      {
        url: "https://example.com/c",
        content: withShared("charlie"),
        chrome: false,
      },
      {
        url: "https://example.com/d",
        content: withShared("delta"),
        chrome: false,
      },
      { url: "https://example.com/e", content: body("echo"), chrome: false },
    ]);
    const at60 = site([
      {
        url: "https://example.com/a",
        content: withShared("alpha"),
        chrome: false,
      },
      {
        url: "https://example.com/b",
        content: withShared("bravo"),
        chrome: false,
      },
      {
        url: "https://example.com/c",
        content: withShared("charlie"),
        chrome: false,
      },
      { url: "https://example.com/d", content: body("delta"), chrome: false },
      { url: "https://example.com/e", content: body("echo"), chrome: false },
    ]);
    expect(
      Number((await audit.audit(at80)).details?.["boilerplateShingles"]),
    ).toBeGreaterThan(0);
    expect(
      Number((await audit.audit(at60)).details?.["boilerplateShingles"]),
    ).toBe(0);
  });

  it("states the cost in the dossier terms: tokens paid for tokens received", async () => {
    const ctx = site([
      { url: "https://example.com/a", content: body("alpha") },
      { url: "https://example.com/b", content: body("bravo") },
      { url: "https://example.com/c", content: body("charlie") },
    ]);
    const result = await audit.audit(ctx);
    expect(result.found).toMatch(
      /reading 3 pages .* pays \d+ tokens to receive \d+ tokens/,
    );
  });

  // 20 blog posts must not outvote 2 product pages.
  it("stratifies the sample by URL path depth", async () => {
    const blog = Array.from({ length: 20 }, (_v, i) => ({
      url: `https://example.com/blog/2026/post-${i}`,
      content: body(`post${i}`),
      chrome: false,
    }));
    const products = [
      { url: "https://example.com/mug", content: body("mug"), chrome: false },
      {
        url: "https://example.com/kettle",
        content: body("kettle"),
        chrome: false,
      },
    ];
    const result = await audit.audit(site([...blog, ...products]));
    const analyzed = result.details?.["analyzedPages"] as string[];
    expect(analyzed.length).toBeLessThan(22);
    expect(analyzed).toContain("https://example.com/mug");
    expect(analyzed).toContain("https://example.com/kettle");
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = BoilerplateTaxAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
  });
});
