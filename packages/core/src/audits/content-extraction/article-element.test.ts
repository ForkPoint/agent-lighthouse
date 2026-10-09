import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { ArticleElementAudit } from "./article-element";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("ArticleElementAudit", () => {
  const audit = new ArticleElementAudit();

  it("passes when all pages use <article>", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><article><h2>Post</h2><p>Body</p></article></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
  });

  it("warns when the homepage uses <article> but a secondary page does not", () => {
    const home = mockPageContext(
      "https://example.com",
      "<html><body><article>Post</article></body></html>",
    );
    const other = mockPageContext(
      "https://example.com/x",
      "<html><body><div>No article</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([home, other]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("1/2");
  });

  it("fails when no page uses <article>", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><div>No article</div></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("0/1");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ArticleElementAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      ArticleElementAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === ArticleElementAudit.meta.id)
        ?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
