import { describe, it, expect } from "vitest";
import { SchemaValidationAudit } from "./schema-validation";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string, url = "https://example.com/", index = 0) =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, index);

describe("SchemaValidationAudit", () => {
  const audit = new SchemaValidationAudit();

  it("fails when there are no JSON-LD blocks", () => {
    const ctx = mockCheckContext([page("")]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No JSON-LD blocks to validate");
  });

  it("passes when a top-level block has @context and @type", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Home",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("valid @context and @type");
  });

  it("passes when all @graph children have @context (inherited) and @type", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: "Acme" },
            { "@type": "WebSite", url: "https://example.com" },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.found).toBe("2/2 valid");
  });

  it("fails when a block is missing @type", () => {
    const ctx = mockCheckContext([
      page(ld({ "@context": "https://schema.org", name: "No type here" })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("missing @context or @type");
  });

  it("names the offending @type and page path in the failure message", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Shoe",
        }),
      ),
      page(
        ld({ "@context": "https://schema.org", name: "No type" }),
        "https://example.com/bikes",
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("missing @context or @type");
    // The reason must identify which block, by type, and where.
    expect(result.message).toContain("(untyped) on /bikes");
    expect(result.found).toBe("1/2 valid");
  });

  it("validates a top-level array-wrapped object", () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Shoe",
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("valid @context and @type");
  });
});
