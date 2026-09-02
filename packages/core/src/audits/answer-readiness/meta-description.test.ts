import { describe, it, expect } from "vitest";
import { MetaDescriptionAudit } from "./meta-description";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

const doc = (head: string, body = "") =>
  `<html lang="en"><head>${head}</head><body>${body}</body></html>`;

const withDesc = (desc: string, head = "", body = "") =>
  mockCheckContext([
    mockPageContext(
      "https://example.com/",
      doc(`<meta name="description" content="${desc}">${head}`, body),
    ),
  ]);

describe("MetaDescriptionAudit", () => {
  const audit = new MetaDescriptionAudit();

  it("passes when description is 50-300 chars", () => {
    const desc =
      "A concise summary of the page content describing exactly what users will learn here today.";
    const result = audit.audit(withDesc(desc));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Meta description present");
  });

  it("warns when description is too short", () => {
    const result = audit.audit(withDesc("Too short."));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("should be 50-300");
  });

  it("warns when description is too long", () => {
    const result = audit.audit(withDesc("x".repeat(350)));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("350");
  });

  it("fails when description is missing", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", doc("")),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("missing");
  });

  it("fails when there are no pages", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
  });

  // --- absorbed from meta-description-aeo (v1 9.11) ------------------------

  it("passes when the description shares terms with the page title", () => {
    const result = audit.audit(
      withDesc(
        "Merino wool sweaters knitted in Portugal, with free shipping and a lifetime repair guarantee.",
        "<title>Merino Wool Sweaters | Acme</title>",
      ),
    );
    expect(result.status).toBe("pass");
  });

  it("warns when the description shares no term with the title or H1", () => {
    const result = audit.audit(
      withDesc(
        "Discover the possibilities that await you and explore everything our teams have built together.",
        "<title>Merino Wool Sweaters | Acme</title>",
        "<h1>Merino Wool Sweaters</h1>",
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("does not describe");
  });

  it("uses the H1 when the page has no title element", () => {
    const result = audit.audit(
      withDesc(
        "Sourdough baking schedules, hydration ratios and oven timings for consistently open crumb.",
        "",
        "<h1>Sourdough baking guide</h1>",
      ),
    );
    expect(result.status).toBe("pass");
  });

  it("skips the overlap check when the page has neither a title nor an H1", () => {
    const result = audit.audit(
      withDesc(
        "An accurate page summary with no headings on the page to compare it against here.",
      ),
    );
    expect(result.status).toBe("pass");
  });

  it("warns on a keyword string rather than a human-readable description", () => {
    const result = audit.audit(
      withDesc(
        "wool sweaters, merino sweaters, wool jumpers, knitwear, cashmere, mens wool, womens wool",
        "<title>Merino Wool Sweaters | Acme</title>",
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("keyword");
  });

  it("does not reward the invented action/result formula", () => {
    // v1 9.11 passed this as "follows an action/result pattern". The formula is
    // gone: the description is judged only on whether it describes the page.
    const result = audit.audit(
      withDesc(
        "Learn how to get the benefits and discover what our approach can do for ambitious teams.",
        "<title>Merino Wool Sweaters | Acme</title>",
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.message).not.toContain("action/result");
  });

  it("does not pass a description on a capitalized word alone", () => {
    // v1 9.11's proper-noun regex passed any description with one capitalized
    // word after the first token — and so passed every German description.
    const result = audit.audit(
      withDesc(
        "Willkommen bei uns, hier finden Sie alles was Ihr Herz begehrt in unserem grossen Angebot.",
        "<title>Merino Wool Sweaters | Acme</title>",
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.message).not.toContain("concrete and specific");
  });

  it("reports the length problem before the quality problems", () => {
    const result = audit.audit(
      withDesc("Discover more.", "<title>Merino Wool Sweaters</title>"),
    );
    expect(result.status).toBe("warn");
    expect(result.message).toContain("should be 50-300");
  });

  it("never fails on a quality problem alone", () => {
    const result = audit.audit(
      withDesc(
        "Discover the possibilities that await you and explore everything our teams have built together.",
        "<title>Merino Wool Sweaters | Acme</title>",
      ),
    );
    expect(result.status).not.toBe("fail");
    expect(result.priority).toBe("medium");
  });
});

describe("MetaDescriptionAudit — brand-only page subject", () => {
  const audit = new MetaDescriptionAudit();

  it("does not call an accurate description irrelevant when the subject is only a brand name", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(
          '<title>Acme</title><meta name="description" content="Refurbished espresso machines, serviced in-house and shipped within two working days.">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).not.toBe("warn");
  });

  it("still warns when a real subject shares nothing with the description", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(
          '<title>Refurbished espresso machines</title><meta name="description" content="Weekly newsletter about municipal bond yields and treasury auctions.">',
          "<h1>Refurbished espresso machines</h1>",
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("shares no term");
  });
});
