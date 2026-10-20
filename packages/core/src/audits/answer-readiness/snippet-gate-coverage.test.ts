import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { SnippetGateCoverageAudit } from "./snippet-gate-coverage";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { CheckStatus } from "#core/types";

/** Filler prose so a small data-nosnippet subtree stays under the 20% floor. */
const FILLER =
  "<p>Resoling keeps a welted boot in service for many more seasons of wet winter walking.</p>".repeat(
    12,
  );
const LONG_ANSWER =
  "Resoling replaces the outsole and midsole of a welted boot while keeping the original upper, which is why a resoleable boot outlasts a cemented boot by several seasons.";

function run(body: string, head = "", headers: Record<string, string> = {}) {
  const audit = new SnippetGateCoverageAudit();
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  const page = mockPageContext("https://example.test/guide", html);
  Object.assign(page.fetchResult.headers, headers);
  return audit.audit(mockCheckContext([page]));
}

const FAQ_JSONLD = `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is resoling?",
      acceptedAnswer: { "@type": "Answer", text: LONG_ANSWER },
    },
  ],
})}</script>`;

describe("SnippetGateCoverageAudit", () => {
  const audit = new SnippetGateCoverageAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes a page with no snippet directive and no data-nosnippet", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Google names nosnippet as one of the controls that removes a page from
  // AI surfaces while leaving it visible to humans.
  it('fails on <meta name="robots" content="nosnippet">', () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="nosnippet">',
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("nosnippet");
  });

  it("resolves a per-bot header against a page meta, most restrictive winning", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="max-snippet:200">',
      { "x-robots-tag": "googlebot: max-snippet:0" },
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("googlebot");
    expect(result.message).toContain("max-snippet:0");
    expect(result.found).toContain("max-snippet:200");
  });

  // Google documents only googlebot and googlebot-news as robots meta names;
  // Google-Extended is a robots.txt product token. OpenAI, Anthropic and
  // Perplexity document robots.txt only. Such tags are listed, not evaluated.
  it.each([
    [
      '<meta name="google-extended" content="nosnippet">',
      {},
      "google-extended meta google-extended nosnippet",
    ],
    [
      '<meta name="GPTBot" content="nosnippet">',
      {},
      "gptbot meta gptbot nosnippet",
    ],
    [
      "",
      { "x-robots-tag": "gptbot: nosnippet" },
      "X-Robots-Tag gptbot nosnippet",
    ],
    [
      "",
      { "x-robots-tag": "claudebot: max-snippet:0, noindex" },
      "X-Robots-Tag claudebot max-snippet:0; X-Robots-Tag claudebot noindex",
    ],
  ])(
    "does not evaluate a directive under an undocumented name (%s %o)",
    (head, headers, listed) => {
      const result = run(
        `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
        head,
        headers,
      );
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toBe(
        "Snippets are permitted for every AI-relevant crawler, and no answer span is suppressed.",
      );
      expect(result.found).toBe(
        `0 snippet finding(s); no snippet directives; not evaluated, outside the documented robots names: ${listed}; data-nosnippet 0.0% of main content`,
      );
    },
  );

  // Apple: "Apple will not use data tagged nosnippet as additional context ...
  // when AI models are used to generate output", with name="applebot".
  it("evaluates a nosnippet addressed to the documented applebot name", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="applebot" content="nosnippet">',
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "Applebot is told not to snippet the page by applebot meta nosnippet: Apple documents that it then generates no description or web answer and does not use the content as context for AI-generated output.",
    );
  });

  // Apple documents noindex only for Spotlight and Siri Suggestions, and does
  // not list max-snippet, so neither gates Applebot here.
  it.each(["noindex", "max-snippet:0"])(
    "does not gate on applebot %s",
    (token) => {
      const result = run(
        `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
        `<meta name="applebot" content="${token}">`,
      );
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toBe(
        "Snippets are permitted for every AI-relevant crawler, and no answer span is suppressed.",
      );
    },
  );

  it("does not read the time half of a comma-split unavailable_after as a bot", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      "",
      {
        "x-robots-tag":
          "unavailable_after: 25 Jun 2010, 15:00:00 PST, nosnippet",
      },
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toBe(
      "Snippets are blocked for every crawler, googlebot, bingbot by X-Robots-Tag nosnippet, so the page is not eligible to be shown with a snippet.",
    );
  });

  // The documented generic rule after an undocumented prefix stays with that
  // prefix: Google's own example is `otherbot: noindex, nofollow`.
  it("carries an undocumented header prefix across the directives after it", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      "",
      { "x-robots-tag": "gptbot: noindex, nosnippet" },
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toBe(
      "Snippets are permitted for every AI-relevant crawler, and no answer span is suppressed.",
    );
    expect(result.found).toBe(
      "0 snippet finding(s); no snippet directives; not evaluated, outside the documented robots names: X-Robots-Tag gptbot noindex; X-Robots-Tag gptbot nosnippet; data-nosnippet 0.0% of main content",
    );
  });

  // Regression pin for the fetcher fix: repeated field lines arrive combined
  // with ", " (RFC 9110 §5.3), so both must still be parsed.
  it("sees every directive when two X-Robots-Tag lines were combined", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      "",
      { "x-robots-tag": "googlebot: max-snippet:0, noarchive" },
    );
    expect(result.found).toContain("max-snippet:0");
    expect(result.found).toContain("noarchive");
  });

  it("fails when data-nosnippet covers over 20% of the main content", () => {
    const suppressed =
      "<p data-nosnippet>Suppressed pricing and availability detail. </p>".repeat(
        8,
      );
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${suppressed}</main>`,
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("20%");
  });

  it("fails and names the span when data-nosnippet holds the first sentence after an h2", () => {
    const result = run(
      `<main><h1>Boots</h1>${FILLER}<h2>What is resoling?</h2>
       <p data-nosnippet>Resoling replaces the outsole.</p>${FILLER}</main>`,
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Resoling replaces the outsole.");
  });

  it("fails when max-snippet is shorter than the primary answer span and shows the cut", () => {
    const answer = `${LONG_ANSWER} ${LONG_ANSWER}`;
    const result = run(
      `<main><h1>Resoling</h1><p>${answer}</p>${FILLER}</main>`,
      '<meta name="robots" content="max-snippet:50">',
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("max-snippet:50");
    expect(result.message).toContain("…");
  });

  // Marking up answers and then forbidding snippets is one mistake, not two.
  it("reports FAQPage markup plus nosnippet as a single combined finding", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      `<meta name="robots" content="nosnippet">${FAQ_JSONLD}`,
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("1 snippet finding");
    expect(result.message).toContain("FAQPage");
  });

  it("warns on a harmless data-nosnippet subtree well under the coverage floor", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}<p data-nosnippet>Prices vary.</p></main>`,
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("reports the page the directives are on", () => {
    const result = run(
      `<main><h1>Resoling</h1><p>${LONG_ANSWER}</p>${FILLER}</main>`,
      '<meta name="robots" content="nosnippet">',
    );
    expect(result.pageUrl).toBe("https://example.test/guide");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new SnippetGateCoverageAudit();
    const reached = instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      SnippetGateCoverageAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === SnippetGateCoverageAudit.meta.id)
        ?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
