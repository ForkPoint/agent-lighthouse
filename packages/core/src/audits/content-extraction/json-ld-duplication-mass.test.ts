import { describe, it, expect } from "vitest";
import { JsonLdDuplicationMassAudit } from "./json-ld-duplication-mass";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

const ARTICLE_BODY =
  "The copper kettle reaches a rolling boil in about three minutes on a gas hob, and holds its heat for a further hour once the lid is closed. Descaling it takes equal parts water and white vinegar left overnight, then two rinses. ";

const block = (value: object) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;

const page = (
  head: string,
  body = "<main><p>Kettles.</p></main>",
): CheckContext =>
  mockCheckContext([
    mockPageContext(
      "https://example.com/kettles",
      `<html><head>${head}</head><body>${body}</body></html>`,
      1,
    ),
  ]);

describe("JsonLdDuplicationMassAudit", () => {
  const audit = new JsonLdDuplicationMassAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable on a page with no JSON-LD", async () => {
    expect((await audit.audit(page(""))).status).toBe("na");
  });

  // The wave's only non-scored audit: it reports a cost, it does not accuse.
  it("registers as informative at weight 0", () => {
    const { meta } = JsonLdDuplicationMassAudit;
    expect(meta.evidenceGrade).toBe("C");
    expect(meta.tier).toBe("informative");
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe("informative");
    expect(meta.defaultPriority).toBe("low");
  });

  it("reports a small Organization block without a finding", async () => {
    const result = await audit.audit(
      page(
        block({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Kettle Co",
        }),
      ),
    );
    expect(result.status).toBe("pass");
    expect(Number(result.details?.["jsonLdTokens"])).toBeGreaterThan(0);
  });

  it("reports two blocks declaring the same node as duplicates", async () => {
    const node = {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://example.com/kettles#product",
      name: "Copper kettle",
    };
    const result = await audit.audit(page(`${block(node)}${block(node)}`));
    expect(Number(result.details?.["duplicateNodes"])).toBe(1);
    expect(result.found).toContain("Product");
  });

  it("reports an articleBody that repeats text already in the DOM", async () => {
    const body = ARTICLE_BODY.repeat(3);
    const result = await audit.audit(
      page(
        block({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Kettles",
          articleBody: body,
        }),
        `<main><h1>Kettles</h1><p>${body}</p></main>`,
      ),
    );
    expect(result.status).toBe("warn");
    expect(Number(result.details?.["duplicatedBodyOverlap"])).toBeGreaterThan(
      0.8,
    );
    expect(result.found).toContain("articleBody");
  });

  it("ignores a long string that does not appear in the DOM", async () => {
    const result = await audit.audit(
      page(
        block({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Kettles",
          articleBody: ARTICLE_BODY.repeat(3),
        }),
        "<main><p>An unrelated page about mugs and their handles entirely.</p></main>",
      ),
    );
    expect(Number(result.details?.["duplicatedBodyOverlap"])).toBeLessThan(0.2);
  });

  it("states the cost in the dossier terms", async () => {
    const result = await audit.audit(
      page(
        block({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Kettle Co",
        }),
      ),
    );
    expect(result.found).toMatch(
      /\d+ tokens of this \d+-token page are structured data/,
    );
  });

  it("never fails", async () => {
    const body = ARTICLE_BODY.repeat(10);
    const result = await audit.audit(
      page(
        block({
          "@context": "https://schema.org",
          "@type": "Article",
          articleBody: body,
        }),
        `<main><p>${body}</p></main>`,
      ),
    );
    expect(result.status).not.toBe("fail");
  });
});
