import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { NoRedirectChainsAudit } from "./no-redirect-chains";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("NoRedirectChainsAudit", () => {
  const audit = new NoRedirectChainsAudit();

  function page(url: string, finalUrl: string, index = 0) {
    const p = mockPageContext(url, "<html><body>Hi</body></html>", index);
    p.fetchResult.url = url;
    p.fetchResult.finalUrl = finalUrl;
    return p;
  }

  it("passes when no pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/", "https://example.com/"),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("resolve without redirects");
  });

  it("fails when a majority of pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/old", "https://example.com/new"),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("involve redirects");
  });

  it("warns when a minority of pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/", "https://example.com/"),
      page("https://example.com/a", "https://example.com/a", 1),
      page("https://example.com/old", "https://example.com/new", 2),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("involve redirects");
  });

  it("fails when no pages were scanned", () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it('shows "+N more" suffix in fail path when more than 5 pages are redirected', () => {
    // 6 pages all redirected → redirected.length (6) > ctx.pages.length/2 (3) → fail with +more
    const redirectedPages = Array.from({ length: 6 }, (_, i) =>
      page(`https://example.com/old${i}`, `https://example.com/new${i}`, i),
    );
    const ctx = mockCheckContext(redirectedPages);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("+1 more");
  });

  it('shows "+N more" suffix in warn path when more than 5 pages are redirected (minority)', () => {
    // 12 pages total: 6 redirected, 6 not → 6 ≤ 6 (not strictly greater than half) → warn with +more
    const nonRedirected = Array.from({ length: 6 }, (_, i) =>
      page(`https://example.com/a${i}`, `https://example.com/a${i}`, i),
    );
    const redirectedPages = Array.from({ length: 6 }, (_, i) =>
      page(`https://example.com/old${i}`, `https://example.com/new${i}`, i + 6),
    );
    const ctx = mockCheckContext([...nonRedirected, ...redirectedPages]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.found).toContain("+1 more");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoRedirectChainsAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      NoRedirectChainsAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === NoRedirectChainsAudit.meta.id)
        ?.status,
    ).toBe("na");
  });
  // This direct call pins the audit's local redirect branch. The runner does
  // not publish this finding from an unread scan; it emits an `na` stub instead.
  it("reports the cross-origin hop when its local branch is called directly", () => {
    const parked = "<html><body><p>Parked.</p></body></html>";
    const page = mockPageContext("https://example.com/", parked);
    page.fetchResult.finalUrl = "https://parking.brandsale.test/example.com";

    const result = new NoRedirectChainsAudit().audit(
      unreachedSiteContext([page]),
    );
    expect(result.status).toBe("fail");
    expect(result.message).toContain("1/1");
    expect(result.found).toContain("parking.brandsale.test");
  });

  // `requires` deliberately omits `rendered-body`: a hop is recorded by the
  // response, and a shell resolves in as many hops as anything else.
  it("still judges a page that served no readable text", async () => {
    const result = await new NoRedirectChainsAudit().audit(shellSiteContext());
    expect(result.status).not.toBe("na");
  });
});
