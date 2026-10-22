import { describe, it, expect } from "vitest";
import { ExternalCitationsAudit } from "./external-citations";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("ExternalCitationsAudit", () => {
  const audit = new ExternalCitationsAudit();
  it("returns not applicable on an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("no references", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Contact our team.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("one reference", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><p>See <a href="https://research.example/study">the study</a>.</p></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("footer links", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><footer><a href="https://social.example/a">Social</a><a href="https://social.example/b">Social</a></footer></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("hidden reference", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><a hidden href="https://research.example/study">Study</a></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("internal links", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><a href="/internal">Internal</a><a href="https://shop.example.com">Shop</a></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("invalid protocols", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><a href="mailto:a@other.com">Email</a><a href="http://[broken">Broken</a></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

it("deduplicates the same reference without a quota", () => {
  const p = mockPageContext(
    "https://example.com/",
    '<main><a href="https://research.example/study#one">One</a><a href="https://research.example/study#two">Two</a></main>',
  );
  const result = new ExternalCitationsAudit().audit(mockCheckContext([p]));
  expect(result.status).toBe(CheckStatus.Pass);
  expect(result.message).toContain("1 distinct");
});

describe("ExternalCitationsAudit site chrome", () => {
  const audit = new ExternalCitationsAudit();
  it("counts sources in an article footer", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      '<html><body><main><article><p>Body.</p><footer><a href="https://research.example/study">Source</a></footer></article></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
});

describe("review regressions", () => {
  it("ignores article sharing endpoints", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><article><footer><a href="https://twitter.com/intent/tweet?url=x">Share</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a></footer></article></body></html>',
    );
    expect(
      new ExternalCitationsAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.NotApplicable);
  });
  it("keeps social content links", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><article><a href="https://twitter.com/example/status/123">Source post</a></article></body></html>',
    );
    expect(
      new ExternalCitationsAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.Pass);
  });
});

describe("ExternalCitationsAudit share actions", () => {
  const audit = new ExternalCitationsAudit();
  it.each([
    "https://www.pinterest.com/pin/create/button/?url=x",
    "https://www.reddit.com/submit?url=x",
    "https://wa.me/?text=x",
    "https://api.whatsapp.com/send?text=x",
    "https://t.me/share/url?url=x",
    "https://twitter.com/share?url=x",
  ])("does not count %s as a content link", (href) => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Body <a href="${href}">Share</a></p></main></body></html>`,
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
