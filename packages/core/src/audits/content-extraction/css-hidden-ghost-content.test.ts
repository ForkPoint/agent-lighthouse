import { describe, it, expect, vi } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { CssHiddenGhostContentAudit } from "./css-hidden-ghost-content";
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions } from "../../fetcher";
import { CheckStatus } from "../../types";

// isSafeUrl performs a real DNS lookup before a linked stylesheet is fetched.
// Stub it with an offline stand-in that still blocks loopback and private
// ranges.
vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

/** 400 words of prose, well past both the share and the absolute threshold. */
const BULK =
  "the quarterly figures showed a modest improvement across every region ".repeat(
    40,
  );
const VISIBLE =
  "our flagship product ships in three colours and two sizes today ".repeat(10);

function run(body: string, head = "", sheets: Record<string, string> = {}) {
  const audit = new CssHiddenGhostContentAudit();
  const html = `<html><head>${head}</head><body>${body}</body></html>`;
  const ctx = mockCheckContext([
    mockPageContext("https://example.test/", html),
  ]);
  ctx.fetch = async (o: FetchOptions) => {
    const sheet = sheets[o.url];
    return sheet === undefined
      ? mockFetchResult("", 404)
      : mockFetchResult(sheet, 200, "text/css");
  };
  return audit.audit(ctx);
}

const SHEET_LINK = '<link rel="stylesheet" href="/s.css">';
const sheet = (css: string) => ({ "https://example.test/s.css": css });

it.each([
  ["none", "block", CheckStatus.Fail],
  ["block", "none", CheckStatus.Pass],
])(
  "resolves a later inline display:%s over a linked display:%s",
  async (inline, linked, status) => {
    const result = await run(
      `<main>${VISIBLE}</main><div class="ghost">${BULK}</div>`,
      `${SHEET_LINK}<style>.ghost { display: ${inline} }</style>`,
      sheet(`.ghost { display: ${linked} }`),
    );
    expect(result.status).toBe(status);
  },
);

describe("CssHiddenGhostContentAudit", () => {
  const audit = new CssHiddenGhostContentAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the page has no body text", async () => {
    const result = await run("<div></div>");
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes a page with no stylesheets and no inline hidden text", async () => {
    const result = await run(`<main><p>${VISIBLE}</p></main>`);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The selector is the evidence: no cascade is resolved, so a human has to be
  // able to check the match the scanner made.
  it("fails on a class-hidden block, naming the selector and the token estimate", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(".ghost");
    expect(result.found).toMatch(/\d+ est\. tokens/);
  });

  it("treats visibility:hidden the same way", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { visibility: hidden }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("treats content-visibility:hidden the same way", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { content-visibility: hidden }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  // The sr-only idiom is legitimate assistive text, not a payload, as long as
  // it stays short.
  it("excludes the 1px clip idiom when the text is under 120 characters", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><span class="sr-only">Skip to main content</span>`,
      SHEET_LINK,
      sheet(
        ".sr-only { position: absolute; clip: rect(0,0,0,0); width: 1px; height: 1px }",
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("counts a clip-idiom block that is far too long to be assistive text", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><span class="sr-only">${BULK}</span>`,
      SHEET_LINK,
      sheet(
        ".sr-only { position: absolute; clip: rect(0,0,0,0); width: 1px; height: 1px }",
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  // Hiding text from a printer is not hiding it from a reader.
  it("ignores a rule inside @media print", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet("@media print { .ghost { display: none } }"),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Within one block the last display declaration wins.
  it("does not count a block whose later declaration shows it again", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none; position: relative; display: block }"),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Across rules, a later block for the identical selector overrides.
  it("does not count a selector a later rule shows again", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none } .ghost { display: block !important }"),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("splits a selector list, so a later rule shows only its own member", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div><div class="aside">${BULK}</div>`,
      SHEET_LINK,
      sheet(".aside, .ghost { display: none } .ghost { display: block }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(".aside, .ghost");
    // Only the .aside copy is counted: half the hidden text, not all of it.
    const single = await run(
      `<main><p>${VISIBLE}</p></main><div class="aside">${BULK}</div>`,
      SHEET_LINK,
      sheet(".aside { display: none }"),
    );
    expect(single.found).toMatch(/^\d+ est\. tokens/);
    expect(result.found?.match(/^(\d+) est\. tokens/)?.[1]).toBe(
      single.found?.match(/^(\d+) est\. tokens/)?.[1],
    );
  });

  // True positives that must survive.
  it("lets an earlier !important beat a later plain declaration", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none !important } .ghost { display: block }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("still counts a collapsed panel that a different selector opens", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="faq-answer">${BULK}</div>`,
      SHEET_LINK,
      sheet(
        ".faq-answer { display: none } .faq-answer.open { display: block }",
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("does not let a media-query override cancel a base display:none", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(
        ".ghost { display: none } @media (min-width: 1024px) { .ghost { display: block } }",
      ),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("still counts a block whose last display declaration is none", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: block; color: red; display: none }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  // Readability already drops these, so counting them would report a cost no
  // extractor actually pays.
  it("excludes a node that already carries an inline hidden marker", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost" style="display:none">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Readability reads the resolved inline style, so an overridden or invalid
  // declaration decides nothing.
  it.each([
    ["display:none;display:block", CheckStatus.Fail],
    ["display:block;display:none", CheckStatus.Pass],
    ["display:none;display:nonee", CheckStatus.Pass],
  ])("resolves the inline marker %s", async (style, status) => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost" style="${style}">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.status).toBe(status);
  });

  it("lets a var() display value override an earlier display:none", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none; display: var(--layout, block) }"),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("drops an invalid stylesheet display value", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none; display: nonee }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("reports near-duplicate hidden text as duplication, not novel content", async () => {
    const result = await run(
      `<main><p>${BULK}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("duplicat");
  });

  it("calls novel hidden content novel rather than duplication", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.message).not.toContain("duplicat");
  });

  it("warns on a small class-hidden block below both thresholds", async () => {
    const result = await run(
      `<main><p>${BULK}</p><p>${BULK}</p></main><div class="ghost">a short hidden aside about shipping times and returns</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("reports a cross-origin stylesheet it did not fetch", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main>`,
      '<link rel="stylesheet" href="https://cdn.test/s.css">',
    );
    expect(result.found).toContain("1 cross-origin stylesheet not fetched");
  });

  it("reports the page the ghost content is on", async () => {
    const result = await run(
      `<main><p>${VISIBLE}</p></main><div class="ghost">${BULK}</div>`,
      SHEET_LINK,
      sheet(".ghost { display: none }"),
    );
    expect(result.pageUrl).toBe("https://example.test/");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new CssHiddenGhostContentAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      CssHiddenGhostContentAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === CssHiddenGhostContentAudit.meta.id,
      )?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
