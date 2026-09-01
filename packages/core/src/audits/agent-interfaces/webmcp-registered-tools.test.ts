import { describe, it, expect } from "vitest";
import { WebmcpRegisteredToolsAudit } from "./webmcp-registered-tools";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

const page = (body: string, url = "https://example.com/") =>
  mockPageContext(url, `<html lang="en"><body>${body}</body></html>`);

const script = (js: string) => `<script>${js}</script>`;

describe("WebmcpRegisteredToolsAudit", () => {
  const audit = new WebmcpRegisteredToolsAudit();

  it("returns na on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe("imperative registration detection", () => {
    it("passes on a registerTool call and names the tool", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            script(`navigator.modelContext.registerTool({
              name: "search_products",
              description: "Search the catalog",
              inputSchema: { type: "object" },
            });`),
          ),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("search_products");
    });

    it("reads tools out of a provideContext call", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            script(`navigator.modelContext.provideContext({
              tools: [
                { name: 'add_to_cart', description: 'Add an item' },
                { name: 'checkout', description: 'Check out' },
              ],
            });`),
          ),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("add_to_cart");
      expect(result.found).toContain("checkout");
    });

    it("accepts a bare string first argument to registerTool", () => {
      const result = audit.audit(
        mockCheckContext([
          page(script(`navigator.modelContext.registerTool("get_status", fn)`)),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("get_status");
    });

    it("deduplicates a tool registered on more than one page", () => {
      const js = script(
        'navigator.modelContext.registerTool({ name: "search" });',
      );
      const result = audit.audit(
        mockCheckContext([page(js), page(js, "https://example.com/shop")]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("1 tool");
    });

    it("warns when the API is referenced but no tool name is observable", () => {
      const result = audit.audit(
        mockCheckContext([
          page(script("if (navigator.modelContext) { init(); }")),
        ]),
      );
      expect(result.status).toBe("warn");
      expect(result.message).toContain("navigator.modelContext");
    });

    it("ignores a script that never touches navigator.modelContext", () => {
      const result = audit.audit(
        mockCheckContext([
          page(script('window.registerTool({ name: "not_webmcp" });')),
        ]),
      );
      expect(result.status).toBe("na");
    });

    it("does not read external script bodies it never fetched", () => {
      const result = audit.audit(
        mockCheckContext([page('<script src="/bundle.js"></script>')]),
      );
      expect(result.status).toBe("na");
      expect(result.message).toContain("cannot execute");
    });
  });

  describe("non-double-counting with webmcp-declarative-forms", () => {
    it("defers to the declarative audit when only declarative forms exist", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            '<form toolname="search" tooldescription="Search"><input name="q"></form>',
          ),
        ]),
      );
      expect(result.status).toBe("na");
      expect(result.message).toContain("webmcp-declarative-forms");
    });

    it("still reports imperative tools when declarative forms are also present", () => {
      const result = audit.audit(
        mockCheckContext([
          page(
            '<form toolname="search" tooldescription="Search"><input name="q"></form>' +
              script(
                'navigator.modelContext.registerTool({ name: "checkout" });',
              ),
          ),
        ]),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("checkout");
    });
  });

  describe("the invented manifest is gone", () => {
    // The whole point of the redeem: /.well-known/webmcp is a private,
    // vendor-versioned format with no spec and no consumer. A site that
    // publishes one must not be credited, and a site that does not must not
    // be failed.
    it("does not pass on a /.well-known/webmcp manifest", () => {
      const result = audit.audit(
        mockCheckContext([page("<p>store</p>")], {
          "/.well-known/webmcp": mockFetchResult(
            JSON.stringify({ tools: [{ name: "searchProducts" }] }),
            200,
            "application/json",
          ),
        }),
      );
      expect(result.status).toBe("na");
    });

    it("never fails a site for the absence of the manifest", () => {
      const result = audit.audit(
        mockCheckContext([page("<p>store</p>")], {
          "/.well-known/webmcp": mockFetchResult("", 404),
        }),
      );
      expect(result.status).not.toBe("fail");
    });

    it("mentions neither the well-known path nor webmcp.link in its guidance", () => {
      const meta = WebmcpRegisteredToolsAudit.meta;
      const copy = JSON.stringify(meta).toLowerCase();
      expect(copy).not.toContain(".well-known/webmcp");
      expect(copy).not.toContain("webmcp.link");
    });
  });

  describe("meta contract", () => {
    const meta = WebmcpRegisteredToolsAudit.meta;

    it("is grade B, experimental, weight 0, informative", () => {
      expect(meta.id).toBe("agent-interfaces/webmcp-registered-tools");
      expect(meta.evidenceGrade).toBe("B");
      expect(meta.tier).toBe("experimental");
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe("informative");
    });

    it("drops the high priority it carried as a hard fail", () => {
      expect(meta.defaultPriority).toBe("low");
    });
  });
});
