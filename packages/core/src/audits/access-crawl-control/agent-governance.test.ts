import { describe, it, expect } from "vitest";
import { AgentGovernanceAudit } from "./agent-governance";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

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
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("2 training crawler(s)");
    expect(result.details?.["trainingAgents"]).toEqual(["GPTBot", "CCBot"]);
    expect(result.details?.["realtimeAgents"]).toEqual([
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
    expect(check.details?.["trainingAgents"]).toEqual(["GPTBot", "CCBot"]);
    expect(check.details?.["hasCatchAll"]).toBe(true);
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
    expect(result.status).toBe(CheckStatus.Pass);
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
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("Only training crawlers");
    expect(result.details?.["trainingAgents"]).toEqual(["GPTBot"]);
    expect(result.details?.["realtimeAgents"]).toEqual([]);
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
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.details?.["hasCatchAll"]).toBe(true);
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
    expect(result.status).toBe(CheckStatus.Fail);
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
    expect(result.status).not.toBe(CheckStatus.Fail);
  });

  it("is not applicable when robots.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No robots.txt found");
  });

  it("is not applicable when robots.txt returns non-200", () => {
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });
  // The crawler tables follow the vendors' crawler pages (verified 2026-10-19).
  it("counts ClaudeBot as a training crawler and ignores the legacy anthropic-ai token", () => {
    const robots = [
      "User-agent: anthropic-ai",
      "Disallow: /",
      "",
      "User-agent: ClaudeBot",
      "Disallow: /",
      "",
      "User-agent: Perplexity-User",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["trainingAgents"]).toEqual(["ClaudeBot"]);
    expect(result.details?.["realtimeAgents"]).toEqual(["Perplexity-User"]);
  });

  it("counts PerplexityBot as a live agent, not a training crawler", () => {
    const robots = "User-agent: PerplexityBot\nDisallow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.details?.["trainingAgents"]).toEqual([]);
    expect(result.details?.["realtimeAgents"]).toEqual(["PerplexityBot"]);
  });

  it("does not count Bravebot, which Brave says sends no user agent of its own", () => {
    const robots =
      "User-agent: Bravebot\nDisallow: /\n\nUser-agent: *\nAllow: /";
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.details?.["realtimeAgents"]).toEqual([]);
  });

  it("does not count Bytespider or cohere-ai, which no operator documents", () => {
    const robots = [
      "User-agent: Bytespider",
      "Disallow: /",
      "",
      "User-agent: cohere-ai",
      "Disallow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.details?.["trainingAgents"]).toEqual([]);
  });

  it("does not say a category is unnamed when both are named too thinly", () => {
    const robots = [
      "User-agent: GPTBot",
      "Allow: /",
      "",
      "User-agent: OAI-SearchBot",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).not.toContain("no rules for");
    expect(result.message).toBe(
      "robots.txt names both training crawlers and live conversational agents under the same policy, but only 1 training crawler and 1 live conversational agent, too few to separate the two.",
    );
  });

  // Three training crawlers clear the bar on their own; only the live side is thin.
  it("names only the thin side when the other has enough", () => {
    const robots = [
      "User-agent: GPTBot",
      "User-agent: CCBot",
      "User-agent: ClaudeBot",
      "User-agent: ChatGPT-User",
      "Allow: /",
    ].join("\n");
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toBe(
      "robots.txt names both training crawlers and live conversational agents under the same policy, but only 1 live conversational agent, too few to separate the two.",
    );
  });
});
