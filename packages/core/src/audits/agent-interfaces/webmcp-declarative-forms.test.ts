import { describe, it, expect } from "vitest";
import { WebmcpDeclarativeFormsAudit } from "./webmcp-declarative-forms";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

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
    expect(result.status).toBe("pass");
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
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("warn");
    expect(result.found).toContain("1/2");
  });

  it("ignores an empty toolname", () => {
    const ctx = mockCheckContext([
      page(
        '<form toolname="" tooldescription="Search" action="/search"><input name="q" /></form>',
      ),
    ]);
    expect(audit.audit(ctx).status).toBe("fail");
  });

  it("warns when a named tool has no tooldescription for an agent to select on", () => {
    const ctx = mockCheckContext([
      page(
        '<form toolname="search_products" action="/search"><input name="q" /></form>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
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
    expect(result.status).toBe("warn");
    expect(result.found).toContain("1/2");
  });

  it("fails when a site has forms but exposes none of them", () => {
    const ctx = mockCheckContext([
      page(`
        <form action="/search"><input name="q" /></form>
        <form action="/contact" method="POST"><input type="email" name="email" /></form>
      `),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("0/2");
  });

  // ── a page with no forms has nothing to annotate ──

  it("is not applicable when no page has a form", () => {
    const ctx = mockCheckContext([page("<p>No forms here</p>")]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
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
    expect(result.status).toBe("warn");
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
    expect(result.status).toBe("pass");
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
    expect(WebmcpDeclarativeFormsAudit.meta.defaultPriority).not.toBe("high");
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
