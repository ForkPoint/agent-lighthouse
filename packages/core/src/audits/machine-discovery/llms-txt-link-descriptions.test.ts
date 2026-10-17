import { describe, it, expect } from "vitest";
import { LlmsTxtLinkDescriptionsAudit } from "./llms-txt-link-descriptions";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("LlmsTxtLinkDescriptionsAudit", () => {
  const audit = new LlmsTxtLinkDescriptionsAudit();

  it("passes when all links include descriptions", () => {
    const body =
      "# Site\n\n## Pages\n" +
      "- [Home](https://example.com/): Main landing page\n" +
      "- [About](https://example.com/about): Company information";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("include descriptions");
  });

  it("warns when only some links have descriptions", () => {
    const body =
      "# Site\n\n## Pages\n" +
      "- [Home](https://example.com/): Main landing page\n" +
      "- [About](https://example.com/about)";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("1/2 links have descriptions");
  });

  it("fails when fewer than half the links have descriptions", () => {
    const body =
      "# Site\n\n## Pages\n" +
      "- [A](https://example.com/a): Described page\n" +
      "- [B](https://example.com/b)\n" +
      "- [C](https://example.com/c)";
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("1/3 links have descriptions");
  });

  it("warns when llms.txt has no markdown links", () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult("# Site\n\n> Summary only, no links.", 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("no markdown links");
  });

  it("is not applicable when llms.txt is missing", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No llms.txt");
  });

  it("is not applicable when /llms.txt redirects to the homepage", () => {
    const home = mockFetchResult(
      '<!DOCTYPE html>\n<html lang="fr"><body><a href="/a">A</a></body></html>',
      200,
      "text/html",
    );
    home.url = "https://example.com/llms.txt";
    home.finalUrl = "https://example.com/";
    const result = audit.audit(mockCheckContext([], { "/llms.txt": home }));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toBe(
      "HTTP 200 with an HTML page, redirected to https://example.com/, not the file",
    );
  });
});
