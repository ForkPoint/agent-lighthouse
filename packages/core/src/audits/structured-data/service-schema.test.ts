import { describe, it, expect } from "vitest";
import { ServiceSchemaAudit } from "./service-schema";
import { mockPageContext, mockCheckContext } from "#core/__tests__/test-utils";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  PageType,
  ScoreDisplayMode,
} from "#core/types";

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

  it("is not applicable when no Service schema is present", () => {
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
    expect(result.status).toBe(CheckStatus.NotApplicable);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("missing: provider");
  });

  // The narrowing: a Product node is the Product half's business now (3.22),
  // so this audit must not claim it — neither as a subject nor as evidence
  // that "a Service exists". Even on a services URL,
  // Product markup does not establish Service adoption.
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
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No Service schema found");
  });

  // Scoping. Before the 2026-08-22 fix this audit declared
  // applicablePageTypes: ['product'], inherited from the pre-split audit. That
  // is backwards for a Service-only check: it never ran on the service sites
  // it is for (no product page in the scan → skipped as an `na` stub), and on
  // ecommerce stores — the only sites it did run on — it was a guaranteed
  // `fail`, because stores do not emit Service markup.
  describe("scoping: evaluates existing markup, na elsewhere", () => {
    it("uses markup presence on every page type", () => {
      expect(ServiceSchemaAudit.meta.applicablePageTypes).toBeUndefined();
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
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
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
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain("No Service schema found");
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
      expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
    });

    it("does not require markup on a site whose nav links to a services section but has no Service markup", () => {
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
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.message).toContain("No Service schema found");
    });

    it("does not require markup from service link text", () => {
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
      expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
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
      expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
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
      expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("warns naming every missing property when no node covers any of them", () => {
    const ctx = mockCheckContext([
      page(ld({ "@context": "https://schema.org", "@type": "Service" })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
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
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2");
  });
});

describe("Service schema evidence contract", () => {
  it("does not score an unproven Service consumer path", () => {
    expect(ServiceSchemaAudit.meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(ServiceSchemaAudit.meta.tier).toBe(AuditTier.Informative);
    expect(ServiceSchemaAudit.meta.weight).toBe(0);
    expect(ServiceSchemaAudit.meta.scoreDisplayMode).toBe(
      ScoreDisplayMode.Informative,
    );
  });

  it.each(Object.values(PageType))(
    "does not require optional markup on %s pages",
    (pageType) => {
      const input = page("", '<a href="/services">Our services</a>');
      input.pageType = pageType;
      expect(
        new ServiceSchemaAudit().audit(mockCheckContext([input])).status,
      ).toBe(CheckStatus.NotApplicable);
    },
  );
});

it.each(Object.values(PageType))(
  "keeps Service findings unscored on %s pages",
  (pageType) => {
    const input = page(ld({ "@type": "Service", name: "Consulting" }));
    input.pageType = pageType;
    const audit = new ServiceSchemaAudit();
    const result = audit.toCheckResult(
      audit.audit(mockCheckContext([storePage(""), input])),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.weight).toBe(0);
    expect(result.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
  },
);

describe("ServiceSchemaAudit ProfessionalService fields", () => {
  it("does not ask ProfessionalService for a provider it cannot carry", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "Acme Legal",
          address: "1 Main St",
        }),
      ),
    ]);
    expect(new ServiceSchemaAudit().audit(ctx).status).toBe(CheckStatus.Pass);
  });
  it("still asks a plain Service for its provider", () => {
    const ctx = mockCheckContext([
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Consulting",
        }),
      ),
    ]);
    expect(new ServiceSchemaAudit().audit(ctx).status).toBe(CheckStatus.Warn);
  });
});
