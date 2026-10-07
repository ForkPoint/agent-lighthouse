import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { LanguageAttributeAudit } from "./language-attribute";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("LanguageAttributeAudit", () => {
  const audit = new LanguageAttributeAudit();

  it("passes when <html lang> is set", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        '<html lang="en"><head></head><body></body></html>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain('lang="en"');
  });

  it("fails when <html> has no lang attribute", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        "<html><head></head><body></body></html>",
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No lang attribute");
  });

  it("declines when there are no pages", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("na");
  });

  it("passes pages with different declared languages", () => {
    const pages = [
      mockPageContext(
        "https://example.com/en",
        '<html lang="en"><body>English</body></html>',
      ),
      mockPageContext(
        "https://example.com/bg",
        '<html lang="bg"><body>Български</body></html>',
      ),
    ];
    const forward = audit.audit(mockCheckContext(pages));
    expect(forward.status).toBe("pass");
    expect(forward.found).toContain("2/2");
    expect(audit.audit(mockCheckContext([...pages].reverse()))).toEqual(
      forward,
    );
  });

  it("reports all missing or blank declarations in any page order", () => {
    const good = mockPageContext(
      "https://example.com/z",
      '<html lang="en"><body>Good</body></html>',
    );
    const missing = mockPageContext(
      "https://example.com/a",
      "<html><body>No declaration</body></html>",
    );
    const blank = mockPageContext(
      "https://example.com/b",
      '<html lang="  "><body>Blank declaration</body></html>',
    );
    const orders = [
      [good, missing, blank],
      [blank, good, missing],
      [missing, blank, good],
    ];
    const results = orders.map((pages) => {
      const original = [...pages];
      const result = audit.audit(mockCheckContext(pages));
      expect(pages).toEqual(original);
      return result;
    });
    expect(results.map((result) => result.status)).toEqual([
      "fail",
      "fail",
      "fail",
    ]);
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(results[0]!.found).toContain("1/3");
    expect(results[0]!.found).toContain(missing.url);
    expect(results[0]!.found).toContain(blank.url);
    expect(results[0]!.found).not.toContain(good.url);
    expect(results[0]!.pageUrl).toBe(missing.url);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new LanguageAttributeAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      LanguageAttributeAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === LanguageAttributeAudit.meta.id)
        ?.status,
    ).toBe("na");
  });

  // `requires` deliberately omits `rendered-body`: `<html lang>` is served
  // before any body renders.
  it("still judges a page that served no readable text", async () => {
    const result = await new LanguageAttributeAudit().audit(shellSiteContext());
    expect(result.status).not.toBe("na");
  });
});
