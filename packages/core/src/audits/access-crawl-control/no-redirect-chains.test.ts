import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { NoRedirectChainsAudit } from "./no-redirect-chains";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";

describe("NoRedirectChainsAudit", () => {
  const audit = new NoRedirectChainsAudit();

  /**
   * A page reached from `url` at `finalUrl`. A redirected page gets a chain of
   * `hops` hops (two by default, the shortest chain) through `/step-N` URLs.
   */
  function page(url: string, finalUrl: string, index = 0, hops = 2) {
    const p = mockPageContext(url, "<html><body>Hi</body></html>", index);
    p.fetchResult.url = url;
    p.fetchResult.finalUrl = finalUrl;
    if (url !== finalUrl) {
      const stops = [
        url,
        ...Array.from(
          { length: hops - 1 },
          (_, i) => new URL(`/step-${i}`, url).href,
        ),
        finalUrl,
      ];
      p.fetchResult.redirectChain = stops.slice(1).map((to, i) => ({
        status: 301,
        from: stops[i]!,
        to,
      }));
    }
    return p;
  }

  it("passes when no pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/", "https://example.com/"),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("without a redirect chain");
  });

  // Google documents harm from long chains only; a single same-site hop is
  // the routine http-to-https or apex-to-www normalisation, not a chain.
  it("passes when every page resolves in one same-site hop", () => {
    const ctx = mockCheckContext([
      page("http://example.com/", "https://example.com/", 0, 1),
      page("https://example.com/a", "https://www.example.com/a", 1, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("passes a same-site hop whose result carries no chain", () => {
    const p = mockPageContext("http://example.com/", "<html></html>");
    p.fetchResult.url = "http://example.com/";
    p.fetchResult.finalUrl = "https://example.com/";
    delete p.fetchResult.redirectChain;
    expect(audit.audit(mockCheckContext([p])).status).toBe(CheckStatus.Pass);
  });

  it("fails when every page needs two same-site hops", () => {
    const ctx = mockCheckContext([
      page("http://example.com/", "https://www.example.com/", 0, 2),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("1/1");
  });

  it("does not count one-hop pages toward the chain share", () => {
    const ctx = mockCheckContext([
      page("http://example.com/", "https://example.com/", 0, 1),
      page("http://example.com/a", "https://example.com/a", 1, 1),
      page("http://example.com/b", "https://www.example.com/b", 2, 3),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("1/3");
    expect(result.found).toContain("http://example.com/b");
  });

  it("still fails a single hop that lands on another site", () => {
    const ctx = mockCheckContext([
      page("https://example.com/", "https://parked.example.test/", 0, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("parked.example.test");
  });

  it("fails when a majority of pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/old", "https://example.com/new"),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("involve redirect chains");
  });

  it("warns when a minority of pages are redirected", () => {
    const ctx = mockCheckContext([
      page("https://example.com/", "https://example.com/"),
      page("https://example.com/a", "https://example.com/a", 1),
      page("https://example.com/old", "https://example.com/new", 2),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("involve redirect chains");
  });

  // Absent artifact, absent verdict: with no page there is no hop to judge.
  it("is not applicable when no pages were scanned", () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No pages were scanned");
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('shows "+N more" suffix in fail path when more than 5 pages are redirected', () => {
    // 6 pages all redirected → redirected.length (6) > ctx.pages.length/2 (3) → fail with +more
    const redirectedPages = Array.from({ length: 6 }, (_, i) =>
      page(`https://example.com/old${i}`, `https://example.com/new${i}`, i),
    );
    const ctx = mockCheckContext(redirectedPages);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
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
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("+1 more");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoRedirectChainsAudit();
    const reached = instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

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
    ).toBe(CheckStatus.NotApplicable);
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
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("1/1");
    expect(result.found).toContain("parking.brandsale.test");
  });

  // `requires` deliberately omits `rendered-body`: a hop is recorded by the
  // response, and a shell resolves in as many hops as anything else.
  it("still judges a page that served no readable text", async () => {
    const result = new NoRedirectChainsAudit().audit(shellSiteContext());
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
  });
});
