import { describe, it, expect } from "vitest";
import { AgentGovernanceAudit } from "./agent-governance";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

describe("AgentGovernanceAudit", () => {
  const audit = new AgentGovernanceAudit();

  it("passes when both categories have >= 2 explicit groups", () => {
    const robots = [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: CCBot",
      "Disallow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: Claude-User",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("2 training crawler(s)");
    expect(result.details?.trainingAgents).toEqual(["GPTBot", "CCBot"]);
    expect(result.details?.realtimeAgents).toEqual([
      "ChatGPT-User",
      "Claude-User",
    ]);
  });

  // The details survived inside the raw AuditResult but used to be stripped by
  // schema validation, so no report ever saw them.
  it("exposes the agent lists as structured details on the CheckResult", () => {
    const robots = [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: CCBot",
      "Disallow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: Claude-User",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const check = audit.toCheckResult(audit.audit(ctx));
    expect(check.details?.trainingAgents).toEqual(["GPTBot", "CCBot"]);
    expect(check.details?.hasCatchAll).toBe(true);
  });

  it("passes when the two categories are explicitly treated differently", () => {
    const robots = [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: ChatGPT-User",
      "Allow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("different policies");
  });

  it("warns when only training crawlers are explicitly named", () => {
    const robots = [
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("Only training crawlers");
    expect(result.details?.trainingAgents).toEqual(["GPTBot"]);
    expect(result.details?.realtimeAgents).toEqual([]);
  });

  // RFC 9309 §2.2.1: a crawler falls back to `*` only when no group matches its
  // own token, so an open catch-all already grants every named agent the same
  // full access that writing the groups out would. Nothing to separate, and no
  // vendor rewards the groups being present, so this is `na` rather than a
  // failure the site owner is asked to fix.
  it("is not applicable when an open catch-all already allows every agent", () => {
    const robots = "User-agent: *\nAllow: /\nDisallow: /api/";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.details?.hasCatchAll).toBe(true);
  });

  // The one case the evidence does support: the fallback carries a blanket
  // block onto the live retrieval agents too, which is the outcome a site
  // blocking dataset crawlers usually does not intend.
  it("fails when a blanket catch-all block shuts out the live agents as well", () => {
    const robots = "User-agent: *\nDisallow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("live conversational agents");
  });

  // A blanket block with a named exception is exactly the differentiation the
  // audit exists to reward, so it must not be caught by the blanket-block arm.
  it("does not fail a blanket block that carves out a named live agent", () => {
    const robots =
      "User-agent: *\nDisallow: /\n\nUser-agent: ChatGPT-User\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).not.toBe("fail");
  });

  it("is not applicable when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("No robots.txt found");
  });

  it("is not applicable when robots.txt returns non-200", () => {
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
  });
});
