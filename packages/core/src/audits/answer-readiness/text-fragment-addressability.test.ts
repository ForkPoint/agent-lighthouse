import { describe, it, expect } from "vitest";
import { TextFragmentAddressabilityAudit } from "./text-fragment-addressability";
import { mockPageContext, mockCheckContext } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import { CheckStatus } from "../../types";

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

it("addresses a FAQ answer restored by the last inline declaration", () => {
  const result = run(
    `<h2>Resoling</h2><p style="display:none;display:block">${ANSWER}</p>`,
    faqJsonLd(ANSWER),
  );
  expect(result.status).toBe(CheckStatus.Pass);
});

it.each([
  `<div style="visibility:hidden"><section style="visibility:visible"><h2>Resoling</h2><p>${ANSWER}</p></section></div>`,
  `<h2>Resoling</h2><div style="visibility:hidden"><p style="visibility:visible">${ANSWER}</p></div>`,
])(
  "addresses a visible answer inside a visibility:hidden block: %s",
  (body) => {
    const result = run(body, faqJsonLd(ANSWER));
    expect(result.status).toBe(CheckStatus.Pass);
  },
);

describe("TextFragmentAddressabilityAudit", () => {
  const audit = new TextFragmentAddressabilityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the page carries no h2/h3, no dd and no FAQ answers", () => {
    expect(run("<main><h1>Boots</h1><p>Copy.</p></main>").status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  // Document Policy is a header-only mechanism.
  it("fails on a Document-Policy: force-load-at-top response header", () => {
    const result = run(SIMPLE, "", { "document-policy": "force-load-at-top" });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("http-equiv");
  });

  it('does not fail on a <meta http-equiv="Document-Policy"> with no such header', () => {
    const result = run(
      SIMPLE,
      '<meta http-equiv="Document-Policy" content="force-load-at-top">',
    );
    expect(result.status).not.toBe(CheckStatus.Fail);
  });

  it("emits a working fragment URL for an answer span inside one block", () => {
    const result = run(SIMPLE);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("#:~:text=");
  });

  it("reports a span that crosses a block boundary as unaddressable", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><div><p>Resoling replaces the outsole</p><p>and midsole of a welted boot.</p></div></main>`,
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("block");
  });

  it("flags a soft hyphen in an answer span as a normalization hazard", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p>Resoling replaces the out­sole and midsole.</p></main>`,
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toMatch(/soft hyphen|zero-width/);
  });

  it("flags a zero-width space in an answer span as a normalization hazard", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p>Resoling replaces the out​sole and midsole.</p></main>`,
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toMatch(/soft hyphen|zero-width/);
  });

  // A repeated span with nothing around it inside its block cannot be pinned.
  it("reports a duplicated span with no same-block prefix or suffix as unaddressable", () => {
    const result = run(
      `<main><dl><dt>Shipping</dt><dd>Prices vary by region.</dd></dl><p>Prices vary by region.</p></main>`,
      faqJsonLd("Prices vary by region."),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("more than once");
  });

  it("addresses a duplicated span through a same-block prefix and emits it", () => {
    const result = run(
      `<main><dl><dt>Shipping</dt><dd>Domestic orders ship free. Prices vary by region.</dd></dl><p>Prices vary by region.</p></main>`,
      faqJsonLd("Prices vary by region."),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("-,");
    expect(result.found).toContain("free");
  });

  it("reports the page the spans are on", () => {
    expect(run(SIMPLE).pageUrl).toBe("https://example.test/faq");
  });

  // A heading over a tile grid introduces labels, not an answer. The grid's
  // text crosses block boundaries by construction, not by an author's split.
  it("does not treat a tile grid after a heading as an answer span", () => {
    const tiles = ["Shirts", "Hoodies", "Trousers", "Shorts"]
      .map(
        (t) =>
          `<div class="tile"><h3>${t}</h3><div class="cta">Shop now</div></div>`,
      )
      .join("");
    const result = run(
      `<main><h2>Shop the range</h2><div class="grid">${tiles}</div></main>`,
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("does not treat a heading that follows a heading as an answer span", () => {
    const result = run("<main><h2>Men</h2><h2>Women</h2><h2>Kids</h2></main>");
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // A repeated call to action is a button, not an ambiguous answer.
  it("does not treat a short repeated call to action as an answer span", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p>${ANSWER}</p><h3>Boots</h3><div class="cta">Shop now</div><h3>Shoes</h3><div class="cta">Shop now</div></main>`,
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
  });

  // The spec groups text by its nearest block ancestor. Inline text beside a
  // heading inside one list item is one block, not a boundary crossing.
  it("addresses inline answer text that shares a block with its heading", () => {
    const result = run(
      `<main><ul><li><h3>Persistent sessions</h3><span class="block">${ANSWER}</span></li></ul></main>`,
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
  });

  // A hidden subtree is not rendered, so the matcher never searches it.
  it("takes no answer span from a hidden dialog", () => {
    const result = run(
      `<main><div hidden role="dialog"><h2>Keyboard shortcuts</h2><div><p>Open the command palette</p><p>and search every page.</p></div></div></main>`,
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("does not let a hidden copy make a visible span ambiguous", () => {
    const result = run(`${SIMPLE}<div hidden><p>${ANSWER}</p></div>`);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // A declared FAQ answer behind a display:none accordion is on the page but
  // not rendered, so a fragment cannot land on it. Say so, not "block".
  it("reports a FAQ answer in an unrendered accordion with the hidden reason", () => {
    const result = run(
      `<main><h2>FAQ</h2><h3><button>Do prices change?</button></h3><section style="display: none;"><p>${ANSWER}</p></section></main>`,
      faqJsonLd(ANSWER),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("does not render");
    expect(result.message).not.toContain("block boundary");
  });

  // until-found content is revealed by find-in-page and by text fragments.
  it("addresses an answer inside a hidden=until-found accordion", () => {
    const result = run(
      `<main><h2>FAQ</h2><div hidden="until-found"><p>${ANSWER}</p></div></main>`,
      faqJsonLd(ANSWER),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // aria-hidden removes text from the accessibility tree, not from the screen.
  it("still searches aria-hidden text, which is rendered", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><p aria-hidden="true">${ANSWER}</p></main>`,
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // A card title and its description are two blocks, and the description is
  // the sentence. Joining them builds text no single block holds.
  it("does not join a card title onto its description", () => {
    const cards = [
      ["Session support", "Stay signed in across every sandbox you open."],
      ["Fast search", "Find any record from a single shortcut."],
    ]
      .map(
        ([t, d]) =>
          `<div class="card"><p class="title">${t}</p><p>${d}</p></div>`,
      )
      .join("");
    const result = run(
      `<main><h2>Features</h2><div class="grid">${cards}</div></main>`,
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // True positive: a sentence split across sibling blocks inside a wrapper is
  // still an answer, and still unaddressable.
  it("still fails a sentence split across three sibling blocks in a wrapper", () => {
    const result = run(
      `<main><h2>What is resoling?</h2><div class="answer"><p>Resoling replaces the outsole</p><p>and midsole</p><p>of a welted boot.</p></div></main>`,
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("block boundary");
  });
});
