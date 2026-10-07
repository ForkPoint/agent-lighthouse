import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { MainElementAudit } from "./main-element";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("MainElementAudit", () => {
  const audit = new MainElementAudit();

  it("passes when all pages have a <main> element", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><main><p>Content</p></main></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1/1");
  });

  it("warns when the homepage has <main> but not all pages do", () => {
    const home = mockPageContext(
      "https://example.com",
      "<html><body><main>Home</main></body></html>",
    );
    const other = mockPageContext(
      "https://example.com/x",
      "<html><body><div>No main</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe("warn");
    expect(result.found).toContain("1/2");
  });

  it("fails when the homepage lacks a <main> element", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><div>No main</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("0/1");
  });

  it("declines an empty page sample", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("na");
    expect(result.found).toBe("No pages scanned");
  });

  it("warns on partial coverage regardless of page order and names every missing page", () => {
    const good = mockPageContext(
      "https://example.com/good",
      "<main>Content</main>",
    );
    const missingA = mockPageContext("https://example.com/a", "<p>No main</p>");
    const missingB = mockPageContext("https://example.com/b", "<p>No main</p>");
    const orders = [
      [good, missingB, missingA],
      [missingA, good, missingB],
      [missingB, missingA, good],
    ];
    const results = orders.map((pages) => {
      const before = [...pages];
      const result = audit.audit(mockCheckContext(pages));
      expect(pages).toEqual(before);
      return result;
    });
    expect(results.map((result) => result.status)).toEqual([
      "warn",
      "warn",
      "warn",
    ]);
    for (const result of results) {
      expect(result.found).toContain("1/3");
      expect(result.found).toContain(missingA.url);
      expect(result.found).toContain(missingB.url);
      expect(result.pageUrl).toBe(missingA.url);
    }
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new MainElementAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      MainElementAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === MainElementAudit.meta.id)?.status,
    ).toBe("na");
  });
});
