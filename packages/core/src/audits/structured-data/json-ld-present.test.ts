import { describe, it, expect } from "vitest";
import { JsonLdPresentAudit } from "./json-ld-present";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe("JsonLdPresentAudit", () => {
  const audit = new JsonLdPresentAudit();

  it("passes when a JSON-LD block is present", () => {
    const html = `<html><head>${ld({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
    })}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Found 1 JSON-LD block(s)");
  });

  it("passes when JSON-LD is a top-level array (counts as one block)", () => {
    const html = `<html><head>${ld([
      { "@context": "https://schema.org", "@type": "Product", name: "Shoe" },
    ])}</head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/products/shoe", html, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("fails when no JSON-LD is found on any page", () => {
    const html = "<html><head></head><body><h1>Hello</h1></body></html>";
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html, 0),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No JSON-LD structured data found");
  });
});
