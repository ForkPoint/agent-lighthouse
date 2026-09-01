import { describe, it, expect } from "vitest";
import { ReviewSchemaAudit } from "./review-schema";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/** A content page (never detected as `product`) carrying arbitrary body/head markup. */
const contentPage = (body: string, head = "") =>
  mockPageContext(
    "https://example.com/about",
    `<html><head>${head}</head><body>${body}</body></html>`,
    1,
  );

/** A product page: `/products/…` is detected as `product` on its own. */
const productPage = (body: string, head = "") =>
  mockPageContext(
    "https://example.com/products/widget",
    `<html><head>${head}</head><body>${body}</body></html>`,
    1,
  );

const homepage = (body: string, head = "") =>
  mockPageContext(
    "https://example.com/",
    `<html><head>${head}</head><body>${body}</body></html>`,
    0,
  );

/** A repeated review component — the structural applicability signal. */
const testimonials = (n = 3, text = "Great service") =>
  Array.from(
    { length: n },
    (_, i) => `<div class="testimonial-card">${text} ${i}</div>`,
  ).join("");

const validRating = {
  "@type": "AggregateRating",
  ratingValue: "4.8",
  reviewCount: "150",
};

describe("ReviewSchemaAudit", () => {
  const audit = new ReviewSchemaAudit();

  describe("applicability (structural, not word-matching)", () => {
    it('is not applicable when the word "review" appears only as page chrome', () => {
      const ctx = mockCheckContext([
        contentPage(
          '<a href="/write-review">Write a review</a><p>Please review your preferences.</p><footer>Reviews</footer>',
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("na");
    });

    it("is not applicable on a page with no review content at all", () => {
      const ctx = mockCheckContext([
        contentPage("<h1>Welcome to our shop</h1>"),
      ]);
      expect(audit.audit(ctx).status).toBe("na");
    });

    it("fires on a non-English page with repeated review components", () => {
      const ctx = mockCheckContext([
        contentPage(
          `<h2>Bewertungen</h2>${testimonials(3, "Sehr gut")}`,
          ld({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Acme",
            aggregateRating: validRating,
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("fires on a rendered star-rating widget with no schema at all", () => {
      const ctx = mockCheckContext([
        contentPage('<div class="star-rating" aria-label="4.5 von 5"></div>'),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("fail");
    });
  });

  describe("detection requires substance, not presence", () => {
    it('fails on an empty "review": [] array (Shopify/Judge.me zero-review shape)', () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            review: [],
          }),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).not.toBe("pass");
      expect(result.status).toBe("fail");
    });

    it('fails on an empty "aggregateRating": {}', () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            aggregateRating: {},
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("fail");
    });

    it("fails when reviewCount is 0", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "0",
              reviewCount: 0,
            },
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("fail");
    });

    it("passes on ratingValue plus a non-zero reviewCount", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
            aggregateRating: validRating,
          }),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("pass");
      expect(result.message).toContain("Review");
    });

    it("passes on a non-empty review array with review bodies", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
            review: [
              {
                "@type": "Review",
                author: { "@type": "Person", name: "Alice" },
                reviewRating: { "@type": "Rating", ratingValue: "5" },
                reviewBody: "Excellent.",
              },
            ],
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("detects a standalone AggregateRating nested inside @graph", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "AggregateRating",
                ratingValue: "5",
                reviewCount: "3",
              },
            ],
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("detects a standalone Review with an array @type", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": ["Review", "UserReview"],
            author: { "@type": "Person", name: "Alice" },
            reviewBody: "Great product!",
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("fails when review content exists but no review schema does", () => {
      const ctx = mockCheckContext([
        contentPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
          }),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("no Review or AggregateRating");
    });
  });

  // Absorbed from 3.23 (product-reviews): the product case is scoped to product
  // pages and to Product-attached ratings, instead of accepting any rating
  // object anywhere on the site.
  describe("product scoping (absorbs 3.23)", () => {
    it("warns when the only rating is an Organization badge and product pages carry none", () => {
      const ctx = mockCheckContext([
        homepage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Acme",
            aggregateRating: validRating,
          }),
        ),
        productPage(
          "",
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
          }),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("product");
    });

    it("passes when the Product itself carries the rating", () => {
      const ctx = mockCheckContext([
        productPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            aggregateRating: validRating,
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("detects a Product rating in a top-level [{…}] array (Shopify-style)", () => {
      const ctx = mockCheckContext([
        productPage(
          testimonials(),
          ld([
            {
              "@context": "https://schema.org",
              "@type": "Product",
              name: "Widget",
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                reviewCount: "125",
              },
            },
          ]),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("pass");
    });

    it("fails a product page whose Product rating is empty", () => {
      const ctx = mockCheckContext([
        productPage(
          testimonials(),
          ld({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "Widget",
            aggregateRating: { "@type": "AggregateRating" },
          }),
        ),
      ]);
      expect(audit.audit(ctx).status).toBe("fail");
    });
  });
});
