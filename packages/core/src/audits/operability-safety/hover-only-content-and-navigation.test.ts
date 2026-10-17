import { describe, it, expect } from "vitest";
import { HoverOnlyContentAndNavigationAudit } from "./hover-only-content-and-navigation";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  ScoreDisplayMode,
} from "#core/types";

/** A homepage carrying `body`, with an optional inline stylesheet. */
function page(body: string, css = ""): CheckContext {
  const style = css ? `<style>${css}</style>` : "";
  return mockCheckContext([
    mockPageContext(
      "https://example.com/",
      `<html><head>${style}</head><body>${body}</body></html>`,
    ),
  ]);
}

/** A menu whose submenu holds two destinations found nowhere else. */
const MENU = (triggerAttrs = "") => `
  <nav class="nav"><ul><li>
    <a href="/products" ${triggerAttrs}>Products</a>
    <ul class="submenu" id="sub">
      <li><a href="/products/mugs">Mugs</a></li>
      <li><a href="/products/plates">Plates</a></li>
    </ul>
  </li></ul></nav>`;

const HOVER_CSS =
  ".submenu { display: none } .nav li:hover .submenu { display: block }";

describe("HoverOnlyContentAndNavigationAudit", () => {
  const audit = new HoverOnlyContentAndNavigationAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("fails a submenu revealed only by :hover and names every lost destination", async () => {
    const result = await audit.audit(page(MENU(), HOVER_CSS));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("/products/mugs");
    expect(result.found).toContain("/products/plates");
  });

  it("passes once a :focus-within rule reveals the same submenu", async () => {
    const result = await audit.audit(
      page(
        MENU(),
        `${HOVER_CSS} .nav li:focus-within .submenu { display: block }`,
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // aria-expanded plus aria-controls means a JS toggle exists; CSS is not the
  // only path to the submenu, so the audit must not guess that it is.
  it("passes when the trigger carries aria-expanded and aria-controls", async () => {
    const result = await audit.audit(
      page(MENU('aria-expanded="false" aria-controls="sub"'), HOVER_CSS),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reports title-only information apart from the navigation findings", async () => {
    const result = await audit.audit(
      page('<span title="Ships in 3 business days">Delivery</span>'),
    );
    expect(result.details?.["titleOnly"]).toBe(1);
    expect(result.details?.["hoverMenus"]).toBe(0);
    expect(result.found).toContain("title");
  });

  // Issue #125: both titles repeat what the link already says, one through
  // its accessible name and one in another letter case.
  it.each([
    ['<a href="/app" title="App" aria-label="App">ACME APP</a>', "aria-label"],
    ['<a href="/stores" title="Stores">STORES</a>', "letter case"],
    ['<a href="/a" title="Veste  Ski">Veste de Ski</a>', "content words"],
    [
      '<a href="/b" title="Sale">\n  <img src="/s.png" alt="Sale"></a>',
      "image alt",
    ],
    [
      '<span id="l">Free returns</span><a href="/r" title="free returns" aria-labelledby="l">?</a>',
      "aria-labelledby",
    ],
  ])("does not count a title that repeats the %s name (%s)", async (html) => {
    const result = await audit.audit(page(html));
    expect(result.details?.["titleOnly"]).toBe(0);
    expect(result.status).not.toBe(CheckStatus.Warn);
  });

  it.each([
    ['<a href="/h" title="Sale Men">Men</a>', "a word the text lacks"],
    ['<a href="/i" title="Info">i</a>', "a different short label"],
    ['<a href="/x" title="OK"></a>', "the only name, with no content word"],
    ['<span title="Ships in 3 days">Delivery</span>', "information"],
  ])("counts a title that adds %s (%s)", async (html) => {
    const result = await audit.audit(page(html));
    expect(result.details?.["titleOnly"]).toBe(1);
  });

  it("reports a tooltip container no aria-describedby points at", async () => {
    const result = await audit.audit(
      page(
        '<button>Help</button><div class="tooltip">Use the 12-digit code.</div>',
      ),
    );
    expect(result.details?.["hoverCards"]).toBe(1);
  });

  it("says the CSS was partial when a stylesheet is cross-origin", async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        `<html><head><style>${HOVER_CSS}</style><link rel="stylesheet" href="https://cdn.example.net/a.css"></head><body>${MENU()}</body></html>`,
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.found).toContain("cross-origin");
  });

  it("is notApplicable when the page has no hover rule and no hover-only content", async () => {
    const result = await audit.audit(
      page('<nav><a href="/products">Products</a></nav>'),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // The snapshot-diff tier needs a live browser. The audit must not claim it.
  it("does not promise the headless snapshot-diff tier", () => {
    const { meta } = HoverOnlyContentAndNavigationAudit;
    expect(meta.description).not.toContain("snapshot");
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Binary);
  });
});
