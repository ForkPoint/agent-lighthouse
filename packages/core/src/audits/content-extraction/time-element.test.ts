import * as visibility from "#core/dom-visibility";
import { describe, it, expect, vi } from "vitest";
import { TimeElementAudit } from "./time-element";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("TimeElementAudit", () => {
  const audit = new TimeElementAudit();
  it("returns not applicable on an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("no date obligation", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Contact our team.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("plain date", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Published January 15, 2025</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
  it("marked date", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><time datetime="2025-01-15">January 15, 2025</time></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("machine readable time text", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><time>2025-01-15</time></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("empty attribute", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><time datetime="">January 15, 2025</time></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
  it("hidden date", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p hidden>January 15, 2025</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("footer date", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><footer><time datetime="2025-01-15">January 15, 2025</time></footer></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("plain time missing machine form", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><time>Tomorrow morning</time></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
});

describe("TimeElementAudit site chrome", () => {
  const audit = new TimeElementAudit();
  it("counts a post date in an article header", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      '<html><body><header><p>Site banner</p></header><main><article><header class="entry-header"><h1>Post</h1><time class="entry-date" datetime="2025-01-15">January 15, 2025</time></header><p>Body.</p></article></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("ignores a date in the page footer", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      "<html><body><main><p>Body.</p></main><footer><p>Updated January 15, 2025</p></footer></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("TimeElementAudit hidden text", () => {
  const audit = new TimeElementAudit();
  it("ignores an inline-hidden date inside a visible paragraph", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      '<html><body><main><p>Hello <span style="display:none">January 15, 2025</span></p></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("review regressions", () => {
  it("recognizes date 12/31/2025", () => {
    const page = mockPageContext(
      "https://example.com/page",
      "<html><body><p>12/31/2025</p></body></html>",
    );
    expect(new TimeElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
  it("recognizes date 15 Jan 2025", () => {
    const page = mockPageContext(
      "https://example.com/page",
      "<html><body><p>15 Jan 2025</p></body></html>",
    );
    expect(new TimeElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
  it("recognizes date Sept. 3, 2025", () => {
    const page = mockPageContext(
      "https://example.com/page",
      "<html><body><p>Sept. 3, 2025</p></body></html>",
    );
    expect(new TimeElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Fail,
    );
  });
});

it("stops reading candidates once the page has time markup", () => {
  const page = mockPageContext(
    "https://example.com/page",
    '<main><time datetime="2025-01-15">January 15, 2025</time>' +
      "<p>January 15, 2025</p>".repeat(1000) +
      "</main>",
  );
  const spy = vi.spyOn(visibility, "readerText");
  try {
    expect(new TimeElementAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Pass,
    );
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
