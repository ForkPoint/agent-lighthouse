import { describe, it, expect } from "vitest";
import { ClaimreviewAdvisoryAudit } from "./claimreview-advisory";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

function withJsonLd(nodes: object[], url = "https://example.test/fact-check") {
  const audit = new ClaimreviewAdvisoryAudit();
  const html = `<html><head><script type="application/ld+json">${JSON.stringify(
    nodes.length === 1 ? nodes[0] : nodes,
  )}</script></head><body><main><p>Copy.</p></main></body></html>`;
  return audit.audit(mockCheckContext([mockPageContext(url, html)]));
}

const VALID = {
  "@context": "https://schema.org",
  "@type": "ClaimReview",
  claimReviewed: "The mayor doubled the city budget in one year.",
  url: "https://example.test/fact-check",
  reviewRating: {
    "@type": "Rating",
    ratingValue: 2,
    bestRating: 5,
    alternateName: "Mostly false",
  },
};

describe("ClaimreviewAdvisoryAudit", () => {
  const audit = new ClaimreviewAdvisoryAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  // Absence is not a defect, and it must not read as a pass either: this audit
  // exists to tell operators who already invested where the channel stands.
  it("is notApplicable when no ClaimReview node exists anywhere", () => {
    const result = withJsonLd([
      { "@context": "https://schema.org", "@type": "Article", headline: "X" },
    ]);
    expect(result.status).toBe("na");
  });

  it("passes a well-formed ClaimReview and carries the advisory", () => {
    const result = withJsonLd([VALID]);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("phasing out");
    expect(result.message).toContain("Fact Check Explorer");
  });

  it("finds a ClaimReview nested inside a @graph", () => {
    const result = withJsonLd([
      { "@context": "https://schema.org", "@graph": [VALID] },
    ]);
    expect(result.status).toBe("pass");
  });

  it("warns when reviewRating carries only a numeric ratingValue", () => {
    const result = withJsonLd([
      {
        ...VALID,
        reviewRating: { "@type": "Rating", ratingValue: 2, bestRating: 5 },
      },
    ]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("alternateName");
  });

  it("warns when claimReviewed is missing", () => {
    const { claimReviewed: _drop, ...withoutClaim } = VALID;
    const result = withJsonLd([withoutClaim]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("claimReviewed");
  });

  it("warns when url is missing", () => {
    const { url: _drop, ...withoutUrl } = VALID;
    const result = withJsonLd([withoutUrl]);
    expect(result.status).toBe("warn");
  });

  it("warns when a page carries more than one ClaimReview node", () => {
    const result = withJsonLd([
      VALID,
      { ...VALID, claimReviewed: "A second claim entirely." },
    ]);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("only one");
  });

  // The advisory measures the state of an external product, not the quality of
  // the site, so it must never move a score.
  it("contributes zero weight to the score", () => {
    const audit2 = new ClaimreviewAdvisoryAudit();
    const result = withJsonLd([VALID]);
    expect(audit2.toCheckResult(result).weight).toBe(0);
  });

  it("is declared informative in both places the scorer reads", () => {
    expect(ClaimreviewAdvisoryAudit.meta.tier).toBe("informative");
    expect(ClaimreviewAdvisoryAudit.meta.scoreDisplayMode).toBe("informative");
    expect(ClaimreviewAdvisoryAudit.meta.weight).toBe(0);
  });

  it("reports the page the markup is on", () => {
    const result = withJsonLd([VALID]);
    expect(result.pageUrl).toBe("https://example.test/fact-check");
  });
});
