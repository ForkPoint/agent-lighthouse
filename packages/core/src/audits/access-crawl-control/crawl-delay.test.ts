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
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";

describe("CrawlDelayAudit", () => {
  const audit = new CrawlDelayAudit();

  // Absent artifact, absent verdict: a robots.txt without the directive has
  // nothing for this audit to judge, and must not read as a pass.
  it("is not applicable when no Crawl-delay directive is present", () => {
    const robots = "User-agent: *\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("no Crawl-delay");
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

  // Google, Amazonbot and Applebot document that they ignore Crawl-delay, so a
  // large value addressed only to them costs the site nothing.
  it("is not applicable when only ignoring crawlers carry a Crawl-delay", () => {
    const robots = [
      "User-agent: Googlebot",
      "Crawl-delay: 30",
      "",
      "User-agent: Amazonbot",
      "Crawl-delay: 60",
      "",
      "User-agent: Applebot",
      "Crawl-delay: 20",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("ignore");
  });

  it("judges only groups for crawlers that honour the directive", () => {
    const robots = [
      "User-agent: Googlebot",
      "Crawl-delay: 30",
      "",
      "User-agent: ClaudeBot",
      "Crawl-delay: 2",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("ClaudeBot: 2s");
    expect(result.message).not.toContain("Googlebot");
  });

  // Google's crawler tokens start with "Google" (Googlebot-Image, GoogleOther,
  // Google-Extended) or end with "-Google" (AdsBot-Google, Storebot-Google).
  // A token that merely contains the word is another crawler.
  it.each([
    "AdsBot-Google",
    "Storebot-Google",
    "GoogleOther",
    "Google-Extended",
  ])("does not judge the Google crawler token %s", (token) => {
    const robots = [`User-agent: ${token}`, "Crawl-delay: 30"].join("\n");
    const result = audit.audit(
      mockCheckContext([], { "/robots.txt": mockFetchResult(robots, 200) }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it.each(["notgoogle", "MyGoogleScraper"])(
    "judges %s, a token that only contains the word google",
    (token) => {
      const robots = [`User-agent: ${token}`, "Crawl-delay: 30"].join("\n");
      const result = audit.audit(
        mockCheckContext([], { "/robots.txt": mockFetchResult(robots, 200) }),
      );
      expect(result.status).toBe(CheckStatus.Fail);
    },
  );

  it("states no unsourced indexing-delay claim", () => {
    const robots = "User-agent: *\nCrawl-delay: 30";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(JSON.stringify(result)).not.toMatch(/days or weeks/);
    expect(JSON.stringify(CrawlDelayAudit.meta)).not.toMatch(/days or weeks/);
  });

  // A missing robots.txt is not a defect for this audit: Crawl-delay is not
  // part of RFC 9309, so there is no value to judge.
  it("is not applicable when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No robots.txt found");
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    // A Crawl-delay gives the reached audit something to judge.
    rootFiles["/robots.txt"] = mockFetchResult(
      "User-agent: *\nCrawl-delay: 5\nAllow: /\n",
      200,
      "text/plain",
    );
    const instance = new CrawlDelayAudit();
    const reached = instance.audit(mockCheckContext(pages, rootFiles));
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
