import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { HeaderFooterAudit } from "./header-footer";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("HeaderFooterAudit", () => {
  const audit = new HeaderFooterAudit();

  it("passes when all pages have both <header> and <footer>", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><header>Nav</header><main>x</main><footer>Legal</footer></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  it("warns when one page has both but another page is missing one", () => {
    const home = mockPageContext(
      "https://example.com",
      "<html><body><header>H</header><footer>F</footer></body></html>",
    );
    const other = mockPageContext(
      "https://example.com/x",
      "<html><body><header>H only</header></body></html>",
    );
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("footer on 1/2");
  });

  it("fails when no page has both landmarks", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><div>Nothing</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Header found on 0/1");
  });

  it("declines an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe("na");
  });

  it("reports each missing landmark with stable evidence in every page order", () => {
    const complete = mockPageContext(
      "https://example.com/z-good",
      "<header>Header</header><footer>Footer</footer>",
    );
    const noFooter = mockPageContext(
      "https://example.com/a-no-footer",
      "<header>Header</header>",
    );
    const noHeader = mockPageContext(
      "https://example.com/b-no-header",
      "<footer>Footer</footer>",
    );
    const neither = mockPageContext(
      "https://example.com/c-neither",
      "<p>Body</p>",
    );
    const orders = [
      [complete, noFooter, noHeader, neither],
      [neither, noHeader, noFooter, complete],
      [noFooter, complete, neither, noHeader],
    ];
    const results = orders.map((pages) => {
      const original = [...pages];
      const result = audit.audit(mockCheckContext(pages));
      expect(pages).toEqual(original);
      return result;
    });
    expect(results.map((result) => result.status)).toEqual([
      "warn",
      "warn",
      "warn",
    ]);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0]!.pageUrl).toBe(noFooter.url);
    expect(results[0]!.found).toContain("1/4 pages with both landmarks");
    expect(results[0]!.found).toContain(`${noFooter.url}: missing <footer>`);
    expect(results[0]!.found).toContain(`${noHeader.url}: missing <header>`);
    expect(results[0]!.found).toContain(
      `${neither.url}: missing <header> and <footer>`,
    );
    expect(results[0]!.found).not.toContain(complete.url);
  });

  it("does not combine a header on one page with a footer on another", () => {
    const header = mockPageContext(
      "https://example.com/a",
      "<header>H</header>",
    );
    const footer = mockPageContext(
      "https://example.com/b",
      "<footer>F</footer>",
    );
    const forward = audit.audit(mockCheckContext([header, footer]));
    const reverse = audit.audit(mockCheckContext([footer, header]));
    expect(forward.status).toBe("fail");
    expect(forward.found).toContain("0/2 pages with both landmarks");
    expect(forward.found).toContain(header.url);
    expect(forward.found).toContain(footer.url);
    expect(reverse).toEqual(forward);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new HeaderFooterAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      HeaderFooterAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === HeaderFooterAudit.meta.id)
        ?.status,
    ).toBe("na");
  });
});
