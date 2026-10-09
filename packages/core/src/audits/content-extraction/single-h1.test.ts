import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { SingleH1Audit } from "./single-h1";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("SingleH1Audit", () => {
  const audit = new SingleH1Audit();

  it("passes when the homepage has exactly one <h1>", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><h1>Primary Title</h1><h2>Section</h2></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1 pages with exactly one <h1>");
  });

  it("fails when the homepage has multiple <h1> elements", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><h1>One</h1><h1>Two</h1></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("2 <h1> element(s)");
  });

  it("fails when the homepage has zero <h1> elements", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><h2>No h1</h2></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("0 <h1>");
  });

  it("declines when there are no pages to evaluate", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No pages available");
  });

  it("judges all pages in either order and reports each affected URL", () => {
    const good = mockPageContext("https://example.com/good", "<h1>Title</h1>");
    const missing = mockPageContext("https://example.com/a", "<p>No h1</p>");
    const multiple = mockPageContext(
      "https://example.com/b",
      "<h1>One</h1><h1>Two</h1>",
    );
    const orders = [
      [good, multiple, missing],
      [missing, good, multiple],
      [multiple, missing, good],
    ];
    const results = orders.map((pages) => {
      const before = [...pages];
      const result = audit.audit(mockCheckContext(pages));
      expect(pages).toEqual(before);
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.found).toContain("1/3 pages with exactly one <h1>");
      expect(result.found).toContain(`${missing.url}: 0 <h1>`);
      expect(result.found).toContain(`${multiple.url}: 2 <h1>`);
      expect(result.pageUrl).toBe(missing.url);
      expect(result.message).not.toMatch(/homepage/i);
      expect(result.expected).not.toMatch(/homepage/i);
      return result;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new SingleH1Audit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      SingleH1Audit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === SingleH1Audit.meta.id)?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
