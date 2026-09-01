import { describe, it, expect } from "vitest";
import { MetaExternalAgentAudit } from "./meta-external-agent";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

const robotsCtx = (body: string, status = 200) =>
  mockCheckContext([], { "/robots.txt": mockFetchResult(body, status) });

describe("MetaExternalAgentAudit", () => {
  const audit = new MetaExternalAgentAudit();

  it("passes when Meta-ExternalAgent has its own allowing group", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Meta-ExternalAgent\nAllow: /"),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["namedGroup"]).toBe(true);
  });

  // The narrowing. RFC 9309 §2.2.1 makes an open catch-all grant a named
  // crawler the same access a named group would, so the old warn scored a
  // configuration the standard the audit cites treats as fully permissive.
  it("passes when only the catch-all group allows, with no group naming the token", () => {
    const result = audit.audit(robotsCtx("User-agent: *\nAllow: /"));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("RFC 9309");
    expect(result.details?.["namedGroup"]).toBe(false);
    expect(result.details?.["hasCatchAll"]).toBe(true);
  });

  it("passes when no group in robots.txt applies to the token at all", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Googlebot\nDisallow: /private"),
    );
    expect(result.status).toBe("pass");
    expect(result.found).toContain("No group applies");
  });

  it("passes a Sitemap-only robots.txt: no rule restricts the crawl", () => {
    const result = audit.audit(
      robotsCtx("Sitemap: https://example.com/sitemap.xml"),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["hasCatchAll"]).toBe(false);
  });

  it("matches the product token regardless of a version suffix", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Meta-ExternalAgent/1.0\nDisallow: /"),
    );
    expect(result.status).toBe("fail");
    expect(result.details?.["namedGroup"]).toBe(true);
  });

  it("fails when the token has its own disallowing group", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Meta-ExternalAgent\nDisallow: /"),
    );
    expect(result.status).toBe("fail");
    expect(result.found).toContain("Its own group disallows");
  });

  it("fails when a blanket catch-all block carries onto the token", () => {
    const result = audit.audit(robotsCtx("User-agent: *\nDisallow: /"));
    expect(result.status).toBe("fail");
    expect(result.details?.["namedGroup"]).toBe(false);
  });

  it("passes a named allow that overrides a blanket catch-all block", () => {
    const result = audit.audit(
      robotsCtx(
        "User-agent: *\nDisallow: /\n\nUser-agent: Meta-ExternalAgent\nAllow: /",
      ),
    );
    expect(result.status).toBe("pass");
  });

  // Meta documents meta-externalfetcher as a separate token that "may bypass
  // robots.txt rules", and the dossier's counter-evidence says audits must not
  // conflate the two. A shorthand or sibling group is therefore no match here.
  // Revisit only if evidence appears that Meta honours prefix groups.
  it("does not attribute a Meta-External shorthand group to this token", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Meta-External\nDisallow: /"),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["namedGroup"]).toBe(false);
  });

  it("does not attribute a Meta-ExternalFetcher group to this token", () => {
    const result = audit.audit(
      robotsCtx("User-agent: Meta-ExternalFetcher\nDisallow: /"),
    );
    expect(result.status).toBe("pass");
  });

  it("reports na when robots.txt is missing", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.found).toContain("No robots.txt found");
  });

  it("reports na when robots.txt returns non-200", () => {
    expect(audit.audit(robotsCtx("", 404)).status).toBe("na");
  });

  it("reports na for an HTML soft 404 served at /robots.txt", () => {
    const result = audit.audit(
      robotsCtx("<!doctype html><html><body>Not found</body></html>"),
    );
    expect(result.status).toBe("na");
    expect(result.found).toContain("no user-agent groups");
  });

  it("keeps the grade-A scored registration", () => {
    const { meta } = MetaExternalAgentAudit;
    expect(meta.evidenceGrade).toBe("A");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(1);
    expect(meta.scoreDisplayMode).toBe("ternary");
  });
});
