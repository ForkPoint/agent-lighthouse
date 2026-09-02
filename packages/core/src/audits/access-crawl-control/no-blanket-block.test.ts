import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { NoBlanketBlockAudit } from "./no-blanket-block";
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

describe("NoBlanketBlockAudit", () => {
  const audit = new NoBlanketBlockAudit();

  it("passes when wildcard does not blanket-block", () => {
    const robots = "User-agent: *\nAllow: /\nDisallow: /api/";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("No blanket Disallow");
  });

  it("passes when wildcard has Disallow: / countered by Allow: /", () => {
    const robots = "User-agent: *\nDisallow: /\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("fails when wildcard has blanket Disallow: /", () => {
    const robots = "User-agent: *\nDisallow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("blocks all crawlers");
  });

  it("warns when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("No robots.txt found");
  });

  it("warns when robots.txt returns non-200", () => {
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult("", 500),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoBlanketBlockAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      NoBlanketBlockAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === NoBlanketBlockAudit.meta.id)
        ?.status,
    ).toBe("na");
  });
});
