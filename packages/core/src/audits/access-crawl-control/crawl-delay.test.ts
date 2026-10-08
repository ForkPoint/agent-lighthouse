import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { CrawlDelayAudit } from "./crawl-delay";
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("CrawlDelayAudit", () => {
  const audit = new CrawlDelayAudit();

  it("passes when no Crawl-delay directives are present", () => {
    const robots = "User-agent: *\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("No Crawl-delay directives");
  });

  it("passes when Crawl-delay is reasonable (<= 10s)", () => {
    const robots = "User-agent: *\nCrawl-delay: 5\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("reasonable");
    expect(result.message).toContain("5s");
  });

  it("fails when Crawl-delay is excessive (> 10s)", () => {
    const robots = "User-agent: *\nCrawl-delay: 30\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Excessive Crawl-delay");
    expect(result.message).toContain("30s");
  });

  it("warns when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("No robots.txt found");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new CrawlDelayAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      CrawlDelayAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === CrawlDelayAudit.meta.id)?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
