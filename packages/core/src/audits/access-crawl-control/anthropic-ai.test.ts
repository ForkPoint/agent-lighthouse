import { describe, it, expect } from "vitest";
import { AnthropicAudit } from "./anthropic-ai";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

const ctxFor = (robots?: string, status = 200) =>
  mockCheckContext(
    [],
    robots === undefined
      ? {}
      : { "/robots.txt": mockFetchResult(robots, status) },
  );

describe("AnthropicAudit (ClaudeBot)", () => {
  const audit = new AnthropicAudit();

  describe("the scored signal is ClaudeBot alone", () => {
    it("passes when ClaudeBot is allowed by its own group", () => {
      const result = audit.audit(ctxFor("User-agent: ClaudeBot\nAllow: /"));
      expect(result.status).toBe("pass");
      expect(result.score).toBe(1);
      expect(result.message).toContain("its own robots.txt group");
      expect(result.details?.namedGroup).toBe(true);
    });

    it("passes on a versioned product token, which RFC 9309 matching accepts", () => {
      const result = audit.audit(ctxFor("User-agent: ClaudeBot/1.0\nAllow: /"));
      expect(result.status).toBe("pass");
      expect(result.details?.namedGroup).toBe(true);
    });

    it("fails when ClaudeBot is disallowed by its own group", () => {
      const result = audit.audit(
        ctxFor("User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /"),
      );
      expect(result.status).toBe("fail");
      expect(result.score).toBe(0);
      expect(result.found).toContain("Its own group disallows /");
      expect(result.priority).toBe("medium");
    });

    it("fails when a blanket catch-all block reaches ClaudeBot", () => {
      const result = audit.audit(ctxFor("User-agent: *\nDisallow: /"));
      expect(result.status).toBe("fail");
      expect(result.found).toContain("The catch-all group disallows /");
    });
  });

  describe("the legacy anthropic-ai token never moves the result", () => {
    // The shipped defect: `isAnthropicAllowed` returned `a || b` when both
    // tokens were explicit, so this file scored 1.0 while Anthropic's only
    // documented training crawler was fully blocked.
    it("fails when anthropic-ai is allowed but ClaudeBot is blocked", () => {
      const result = audit.audit(
        ctxFor(
          "User-agent: anthropic-ai\nAllow: /\n\nUser-agent: ClaudeBot\nDisallow: /",
        ),
      );
      expect(result.status).toBe("fail");
      expect(result.score).toBe(0);
    });

    // The inverse defect: a stale 2023-era legacy line used to produce a
    // high-priority failure on a site ClaudeBot crawls freely.
    it("passes when only anthropic-ai is blocked and nothing restricts ClaudeBot", () => {
      const result = audit.audit(
        ctxFor(
          "User-agent: anthropic-ai\nDisallow: /\n\nUser-agent: *\nAllow: /",
        ),
      );
      expect(result.status).toBe("pass");
      expect(result.score).toBe(1);
    });

    it("reports a legacy group as a non-scoring note on found", () => {
      const result = audit.audit(
        ctxFor("User-agent: anthropic-ai\nAllow: /\n\nUser-agent: *\nAllow: /"),
      );
      expect(result.status).toBe("pass");
      expect(result.found).toContain("legacy anthropic-ai group present");
      expect(result.found).toContain(
        "not a documented Anthropic access control",
      );
      expect(result.details?.legacyTokens).toEqual(["anthropic-ai"]);
    });

    it("recognises Claude-Web as legacy too, and matches tokens case-insensitively", () => {
      const result = audit.audit(
        ctxFor(
          "User-Agent: ANTHROPIC-AI\nAllow: /\n\nuser-agent: claude-web\nAllow: /",
        ),
      );
      expect(result.status).toBe("pass");
      expect(result.details?.legacyTokens).toEqual([
        "anthropic-ai",
        "Claude-Web",
      ]);
    });

    it("carries no legacy note when no legacy group is present", () => {
      const result = audit.audit(ctxFor("User-agent: ClaudeBot\nAllow: /"));
      expect(result.found).not.toContain("legacy");
      expect(result.details?.legacyTokens).toEqual([]);
    });
  });

  describe("access state, not the shape of the file", () => {
    it("passes when only the catch-all allows, with no group naming ClaudeBot", () => {
      const result = audit.audit(ctxFor("User-agent: *\nAllow: /"));
      expect(result.status).toBe("pass");
      expect(result.score).toBe(1);
      expect(result.message).toContain("catch-all");
      expect(result.details?.namedGroup).toBe(false);
      expect(result.details?.hasCatchAll).toBe(true);
    });

    it("passes when no group in the file applies to ClaudeBot at all", () => {
      const result = audit.audit(ctxFor("User-agent: GPTBot\nDisallow: /"));
      expect(result.status).toBe("pass");
      expect(result.found).toContain("No group applies to ClaudeBot");
      expect(result.details?.hasCatchAll).toBe(false);
    });

    it("passes on a Sitemap-only file, which restricts nothing", () => {
      const result = audit.audit(
        ctxFor("Sitemap: https://example.com/sitemap.xml"),
      );
      expect(result.status).toBe("pass");
    });
  });

  describe("an unreadable robots.txt is not applicable", () => {
    it("returns na when robots.txt is missing", () => {
      const result = audit.audit(ctxFor(undefined));
      expect(result.status).toBe("na");
      expect(result.score).toBe(0);
      expect(result.found).toBe("No robots.txt found");
    });

    it("returns na on a non-200 response", () => {
      const result = audit.audit(ctxFor("User-agent: *\nAllow: /", 500));
      expect(result.status).toBe("na");
    });

    it("returns na on an empty body", () => {
      const result = audit.audit(ctxFor(""));
      expect(result.status).toBe("na");
    });

    it("returns na on an HTML error page served at /robots.txt", () => {
      const result = audit.audit(ctxFor("<html><body>Not found</body></html>"));
      expect(result.status).toBe("na");
      expect(result.found).toContain("no user-agent groups");
    });
  });

  describe("titles read true on every status this audit returns", () => {
    it("uses meta.title for pass and na, and failureTitle only for fail", () => {
      const pass = audit.toCheckResult(
        audit.audit(ctxFor("User-agent: ClaudeBot\nAllow: /")),
      );
      const na = audit.toCheckResult(audit.audit(ctxFor(undefined)));
      const fail = audit.toCheckResult(
        audit.audit(ctxFor("User-agent: ClaudeBot\nDisallow: /")),
      );
      expect(pass.title).toBe("ClaudeBot crawl access");
      expect(na.title).toBe("ClaudeBot crawl access");
      expect(fail.title).toBe("ClaudeBot disallowed by robots.txt");
    });

    it("offers the ClaudeBot snippet as the fix, not the legacy token", () => {
      const fail = audit.toCheckResult(
        audit.audit(ctxFor("User-agent: ClaudeBot\nDisallow: /")),
      );
      expect(fail.details?.code).toBe("User-agent: ClaudeBot\nAllow: /");
      expect(fail.fix).not.toContain("add a named `User-agent: anthropic-ai`");
    });
  });
});
