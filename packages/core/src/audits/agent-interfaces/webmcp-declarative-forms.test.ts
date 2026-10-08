import { describe, it, expect } from "vitest";
import { WebmcpDeclarativeFormsAudit } from "./webmcp-declarative-forms";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { CheckPriority, CheckStatus } from "../../types";

const page = (body: string, url = "https://example.com/", index = 0) =>
  mockPageContext(url, `<html><body>${body}</body></html>`, index);

describe("WebmcpDeclarativeFormsAudit", () => {
  const audit = new WebmcpDeclarativeFormsAudit();

  it("passes when every form carries toolname and tooldescription", () => {
    const ctx = mockCheckContext([
      page(`
        <form toolname="search_products" tooldescription="Search the product catalog" action="/search">
          <input type="text" name="q" toolparamdescription="Search keywords" />
        </form>
        <form toolname="add_to_cart" tooldescription="Add a product to the cart" action="/cart/add" method="POST">
          <input type="number" name="quantity" toolparamdescription="How many to add" />
        </form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("search_products");
    expect(result.message).toContain("add_to_cart");
  });

  // ── toolname is what registers the tool (WPT getTools-declarative-schema) ──

  it("does not count a form with tooldescription but no toolname", () => {
    const ctx = mockCheckContext([
      page(
        '<form tooldescription="Search products" action="/search"><input name="q" /></form>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("toolname");
  });

  it("does not let a nameless form ride along with a named one to a full pass", () => {
    const ctx = mockCheckContext([
      page(`
        <form toolname="search_products" tooldescription="Search products" action="/search"><input name="q" /></form>
        <form tooldescription="Description only" action="/other"><input name="d" /></form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1/2");
  });

  it("ignores an empty toolname", () => {
    const ctx = mockCheckContext([
      page(
        '<form toolname="" tooldescription="Search" action="/search"><input name="q" /></form>',
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  it("warns when a named tool has no tooldescription for an agent to select on", () => {
    const ctx = mockCheckContext([
      page(
        '<form toolname="search_products" action="/search"><input name="q" /></form>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("tooldescription");
  });

  it("warns when only some forms are exposed as tools", () => {
    const ctx = mockCheckContext([
      page(`
        <form toolname="search_products" tooldescription="Search products" action="/search"><input name="q" /></form>
        <form action="/newsletter" method="POST"><input type="email" name="email" /></form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1/2");
  });

  // Absent artifact, absent verdict: WebMCP is an origin trial, and a site
  // that registers tools imperatively carries no declarative attribute.
  it("is not applicable when forms exist but none carries WebMCP markup", () => {
    const ctx = mockCheckContext([
      page(`
        <form action="/search"><input name="q" /></form>
        <form action="/contact" method="POST"><input type="email" name="email" /></form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("0/2");
  });

  // True positive: a parameter description with no toolname registers nothing.
  it("still fails a form whose only WebMCP markup is toolparamdescription", () => {
    const ctx = mockCheckContext([
      page(
        '<form action="/search"><input name="q" toolparamdescription="Keywords" /></form>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("toolname");
  });

  it("still fails a form whose only WebMCP markup is toolautosubmit", () => {
    const ctx = mockCheckContext([
      page('<form action="/search" toolautosubmit><input name="q" /></form>'),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  // ── a page with no forms has nothing to annotate ──

  it("is not applicable when no page has a form", () => {
    const ctx = mockCheckContext([page("<p>No forms here</p>")]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("counts forms across every crawled page", () => {
    const ctx = mockCheckContext([
      page(
        '<form toolname="search_products" tooldescription="Search" action="/search"><input name="q" /></form>',
      ),
      page(
        '<form action="/contact" method="POST"><input name="email" /></form>',
        "https://example.com/contact",
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1/2");
  });

  it("reports toolparamdescription coverage without gating on it", () => {
    const ctx = mockCheckContext([
      page(`
        <form toolname="search_products" tooldescription="Search products" action="/search">
          <input name="q" />
        </form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("toolparamdescription");
  });

  // ── meta corrections named by the redemption dossier ──

  it("points at the live Chrome declarative-API docs, not the dead webmcp.link", () => {
    const docsUrl = WebmcpDeclarativeFormsAudit.meta.guidance?.docsUrl ?? "";
    expect(docsUrl).toBe(
      "https://developer.chrome.com/docs/ai/webmcp/declarative-api",
    );
  });

  it('does not default to high priority given Baseline "limited" status', () => {
    expect(WebmcpDeclarativeFormsAudit.meta.defaultPriority).not.toBe(
      CheckPriority.High,
    );
  });

  it("names the four spec attributes in its guidance", () => {
    const code = WebmcpDeclarativeFormsAudit.meta.guidance?.code ?? "";
    for (const attr of [
      "toolname",
      "tooldescription",
      "toolparamdescription",
      "toolautosubmit",
    ]) {
      expect(code).toContain(attr);
    }
  });
});
