import { describe, it, expect } from "vitest";
import { TextFragmentAddressabilityAudit } from "./text-fragment-addressability";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

const ANSWER =
  "Resoling replaces the outsole and midsole of a welted boot while keeping the upper.";

function run(body: string, head = "", headers: Record<string, string> = {}) {
  const audit = new TextFragmentAddressabilityAudit();
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  const page = mockPageContext("https://example.test/faq", html);
  Object.assign(page.fetchResult.headers, headers);
  return audit.audit(mockCheckContext([page]));
}

function faqJsonLd(answer: string) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Do prices change?",
        acceptedAnswer: { "@type": "Answer", text: answer },
      },
    ],
  })}</script>`;
}

const SIMPLE = `<main><h2>What is resoling?</h2><p>${ANSWER}</p></main>`;

describe("TextFragmentAddressabilityAudit", () => {
  const audit = new TextFragmentAddressabilityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the page carries no h2/h3, no dd and no FAQ answers", () => {
    expect(run("<main><h1>Boots</h1><p>Copy.</p></main>").status).toBe("na");
  });

  // Document Policy is a header-only mechanism.
  it("fails on a Document-Policy: force-load-at-top response header", () => {
    const result = run(SIMPLE, "", { "document-policy": "force-load-at-top" });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("http-equiv");
  });

  it('does not fail on a <meta http-equiv="Document-Policy"> with no such header', () => {
    const result = run(
      SIMPLE,
      '<meta http-equiv="Document-Policy" content="force-load-at-top">',
    );
    expect(result.status).not.toBe("fail");
  });

  it("emits a working fragment URL for an answer span inside one block", () => {
    const result = run(SIMPLE);
    expect(result.status).toBe("pass");
    expect(result.found).toContain("#:~:text=");
  });

  it("reports a span that crosses a block boundary as unaddressable", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><div><p>Resoling replaces the outsole</p><p>and midsole of a welted boot.</p></div></main>`,
    );
    expect(result.status).toBe("fail");
    expect(result.message).toContain("block");
  });

  it("flags a soft hyphen in an answer span as a normalization hazard", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p>Resoling replaces the out­sole and midsole.</p></main>`,
    );
    expect(result.status).toBe("warn");
    expect(result.message).toMatch(/soft hyphen|zero-width/);
  });

  it("flags a zero-width space in an answer span as a normalization hazard", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p>Resoling replaces the out​sole and midsole.</p></main>`,
    );
    expect(result.status).toBe("warn");
    expect(result.message).toMatch(/soft hyphen|zero-width/);
  });

  // A repeated span with nothing around it inside its block cannot be pinned.
  it("reports a duplicated span with no same-block prefix or suffix as unaddressable", () => {
    const result = run(
      `<main><dl><dt>Shipping</dt><dd>Prices vary by region.</dd></dl><p>Prices vary by region.</p></main>`,
      faqJsonLd("Prices vary by region."),
    );
    expect(result.status).toBe("fail");
    expect(result.message).toContain("more than once");
  });

  it("addresses a duplicated span through a same-block prefix and emits it", () => {
    const result = run(
      `<main><dl><dt>Shipping</dt><dd>Domestic orders ship free. Prices vary by region.</dd></dl><p>Prices vary by region.</p></main>`,
      faqJsonLd("Prices vary by region."),
    );
    expect(result.status).toBe("pass");
    expect(result.found).toContain("-,");
    expect(result.found).toContain("free");
  });

  it("reports the page the spans are on", () => {
    expect(run(SIMPLE).pageUrl).toBe("https://example.test/faq");
  });
});
