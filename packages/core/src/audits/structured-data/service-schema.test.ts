import { describe, it, expect } from "vitest";
import { ServiceSchemaAudit } from "./service-schema";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
/** A page on a services section — the audit's in-scope shape. */
const page = (head: string, body = "") =>
  mockPageContext(
    "https://example.com/services",
    `<html><head>${head}</head><body>${body}</body></html>`,
    1,
  );
/** A page on a pure product store: no services URL, no services link. */
const storePage = (head: string, body = "") =>
  mockPageContext(
    "https://shop.example.com/products/widget",
    `<html><head>${head}</head><body>${body}</body></html>`,
    1,
  );

describe("ServiceSchemaAudit", () => {
  const audit = new ServiceSchemaAudit();

  it("is registered under the narrowed id", () => {
    expect(ServiceSchemaAudit.meta.id).toBe("structured-data/service-schema");
  });

  it("fails when no Service schema is present", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Acme",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No Service schema found");
  });

  it("passes when Service has name and provider", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Consulting",
          provider: { "@type": "Organization", name: "Acme" },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("detects a Service nested inside @graph", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Service",
              name: "Consulting",
              provider: { "@type": "Organization", name: "Acme" },
            },
          ],
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("detects a Service in a top-level `[{...}]` array (Shopify-style)", () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Consulting",
            provider: { "@type": "Organization", name: "Acme" },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("accepts ProfessionalService, the other in-scope type", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Acme Legal",
          provider: { "@type": "Organization", name: "Acme" },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("detects a Service with array @type (Array.isArray branch in matchesAnyType)", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": ["Service", "ProfessionalService"],
          name: "Consulting",
          provider: { "@type": "Organization", name: "Acme" },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("warns when the Service is missing provider", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Consulting",
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("missing: provider");
  });

  // The narrowing: a Product node is the Product half's business now (3.22),
  // so this audit must not claim it — neither as a subject nor as evidence
  // that "a Service exists". On a page that IS in scope (a services section),
  // Product markup does not rescue a missing Service node.
  it("ignores Product schema entirely — that half moved to advanced-product-details", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Widget",
          brand: { "@type": "Brand", name: "Acme" },
          offers: {
            "@type": "Offer",
            availability: "https://schema.org/InStock",
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No Service schema found");
  });

  // Scoping. Before the 2026-08-22 fix this audit declared
  // applicablePageTypes: ['product'], inherited from the pre-split audit. That
  // is backwards for a Service-only check: it never ran on the service sites
  // it is for (no product page in the scan → skipped as an `na` stub), and on
  // ecommerce stores — the only sites it did run on — it was a guaranteed
  // `fail`, because stores do not emit Service markup.
  describe("scoping: runs where Service markup is plausible, na elsewhere", () => {
    it("declares the page types a service business actually publishes on", () => {
      expect(ServiceSchemaAudit.meta.applicablePageTypes).toEqual([
        "homepage",
        "content",
      ]);
      expect(ServiceSchemaAudit.meta.applicablePageTypes).not.toContain(
        "product",
      );
    });

    it("runs and passes on a service site that has Service markup", () => {
      const ctx = mockCheckContext([
        page(
          ld({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Consulting",
            provider: { "@type": "Organization", name: "Acme" },
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("is na — not fail — on a product store with no service intent", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            brand: { "@type": "Brand", name: "Acme" },
            offers: {
              "@type": "Offer",
              availability: "https://schema.org/InStock",
            },
          }),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("na");
      expect(result.message).toContain("No service offering detected");
    });

    it("is na on a site with neither Service markup nor a services section", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("na");
    });

    // The audit must still be able to fail: a site that clearly sells services
    // but publishes no Service markup is exactly what it exists to catch.
    it("fails a site whose nav links to a services section but has no Service markup", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
          }),
          '<nav><a href="/our-services">Our Services</a></nav>',
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("No Service schema found");
    });

    it("treats link text as service intent even when the href is opaque", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
          }),
          '<nav><a href="/p/9f2c">What we do</a></nav>',
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("fail");
    });

    // Service markup anywhere in the scan puts the site in scope regardless of
    // URLs and links — the strongest possible evidence of service intent.
    it("is in scope when Service markup exists on a page with no services URL", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Installation",
            provider: { "@type": "Organization", name: "Acme" },
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    // A store's "Customer Service" / "Terms of Service" chrome must not drag
    // every ecommerce site back into scope.
    it("does not read generic store chrome as a services section", () => {
      const ctx = mockCheckContext([
        storePage(
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
          }),
          '<footer><a href="/legal/terms-of-service">Terms of Service</a>' +
            '<a href="/help/contact">Customer service</a></footer>',
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("na");
    });
  });

  // 3.8's required fix: "drop `description` from the required set" —
  // schema.org does not require it and no consumer documents it.
  it("does not require description", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Consulting",
          provider: { "@type": "Organization", name: "Acme" },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).not.toContain("description");
  });

  // 3.8's required fix: "evaluate the best-covered node rather than `[0]`".
  // A listing stub hoisted ahead of the real Service node must not decide the
  // verdict for the whole scan.
  it("judges the best-covered Service node, not the first one found", () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Consulting",
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Consulting",
            provider: { "@type": "Organization", name: "Acme" },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("warns naming every missing property when no node covers any of them", () => {
    const ctx = mockCheckContext([
      page(ld({ "@context": "https://schema.org", "@type": "Service" })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("missing: name, provider");
  });

  it("reports the Service count in `found`", () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Consulting",
            provider: { "@type": "Organization", name: "Acme" },
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Training",
            provider: { "@type": "Organization", name: "Acme" },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.found).toContain("2");
  });
});
