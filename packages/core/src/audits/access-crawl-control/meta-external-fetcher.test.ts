import { describe, it, expect } from "vitest";
import { MetaExternalFetcherAudit } from "./meta-external-fetcher";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

describe("MetaExternalFetcherAudit", () => {
  const audit = new MetaExternalFetcherAudit();

  it("passes when Meta-ExternalFetcher is explicitly allowed in robots.txt", () => {
    const robots = "User-agent: Meta-ExternalFetcher\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("explicitly allowed");
  });

  it("warns when Meta-ExternalFetcher is allowed only via wildcard (not explicit)", () => {
    const robots = "User-agent: *\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("allowed by default");
  });

  it("fails when Meta-ExternalFetcher is blocked via Disallow: /", () => {
    const robots = "User-agent: Meta-ExternalFetcher\nDisallow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("blocked by robots.txt");
  });

  it("warns when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("robots.txt not found");
  });

  it("warns when robots.txt returns non-200", () => {
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.found).toContain("No robots.txt found");
  });
});
