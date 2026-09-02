import { describe, it, expect } from "vitest";
import { OrganizationSchemaAudit } from "./organization-schema";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext(
    "https://example.com/",
    `<html><head>${head}</head><body></body></html>`,
    0,
  );

describe("OrganizationSchemaAudit", () => {
  const audit = new OrganizationSchemaAudit();

  it("fails when no Organization schema is present", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "WebSite",
          url: "https://example.com",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No Organization schema found");
  });

  it("passes when Organization has name, url, and logo", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Acme",
          url: "https://example.com",
          logo: "https://example.com/logo.png",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("found with name, url, and logo");
  });

  it("detects Organization nested inside @graph", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", url: "https://example.com" },
            {
              "@type": "Organization",
              name: "Acme",
              url: "https://example.com",
              logo: "https://example.com/logo.png",
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("detects Organization in a top-level `[{...}]` array (Shopify-style)", () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
            url: "https://example.com",
            logo: "https://example.com/logo.png",
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("warns when Organization is missing logo", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Acme",
          url: "https://example.com",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("missing: logo");
  });

  it("detects Organization with array @type (Array.isArray branch in matchesType)", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": ["Organization", "LocalBusiness"],
          name: "Acme",
          url: "https://example.com",
          logo: "https://example.com/logo.png",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });
});
