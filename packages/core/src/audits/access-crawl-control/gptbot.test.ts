import { describe, it, expect } from "vitest";
import { GptbotAudit } from "./gptbot";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

const robots = (body: string) =>
  mockCheckContext([], { "/robots.txt": mockFetchResult(body, 200) });

describe("GptbotAudit", () => {
  const audit = new GptbotAudit();

  it("passes when GPTBot has its own group that permits /", () => {
    const result = audit.audit(robots("User-agent: GPTBot\nAllow: /"));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("its own robots.txt group");
  });

  // RFC 9309 §2.2.1: a bot with no group of its own obeys the catch-all, so
  // an open catch-all grants the same access a named group would.
  it("passes when GPTBot is allowed through the catch-all group", () => {
    const result = audit.audit(robots("User-agent: *\nAllow: /"));
    expect(result.status).toBe("pass");
    expect(result.score).toBe(1);
    expect(result.message).toContain("catch-all group applies");
  });

  it("passes when no group applies to GPTBot", () => {
    const result = audit.audit(robots("User-agent: SomeOtherBot\nDisallow: /"));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("No group in robots.txt applies");
  });

  it("follows its own group over a blocking catch-all", () => {
    const result = audit.audit(
      robots("User-agent: GPTBot\nAllow: /\n\nUser-agent: *\nDisallow: /"),
    );
    expect(result.status).toBe("pass");
  });

  it("fails when GPTBot is blocked by its own group", () => {
    const result = audit.audit(robots("User-agent: GPTBot\nDisallow: /"));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("blocked by robots.txt");
    expect(result.found).toContain("Its own group");
  });

  it("fails when its own group blocks GPTBot under an open catch-all", () => {
    const result = audit.audit(
      robots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /"),
    );
    expect(result.status).toBe("fail");
  });

  it("fails when a catch-all block reaches GPTBot", () => {
    const result = audit.audit(robots("User-agent: *\nDisallow: /"));
    expect(result.status).toBe("fail");
    expect(result.found).toContain("catch-all group disallows /");
  });

  it("warns in the fail remedy that a named group drops catch-all rules", () => {
    const result = audit.audit(robots("User-agent: *\nDisallow: /"));
    expect(result.remediation).toContain("replaces the catch-all");
    expect(GptbotAudit.meta.guidance?.fix).toContain("replaces the catch-all");
    expect(GptbotAudit.meta.description).toContain(
      "A named group is not required",
    );
  });

  it("is not applicable when robots.txt is missing", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.found).toContain("No robots.txt found");
  });

  it("is not applicable when robots.txt returns non-200", () => {
    const result = audit.audit(
      mockCheckContext([], { "/robots.txt": mockFetchResult("", 404) }),
    );
    expect(result.status).toBe("na");
    expect(result.found).toContain("No robots.txt found");
  });

  it("is not applicable when /robots.txt serves an HTML error page", () => {
    const result = audit.audit(robots("<html><body>Not found</body></html>"));
    expect(result.status).toBe("na");
  });
});
