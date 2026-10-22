import { describe, it, expect } from "vitest";
import { UniqueDataAudit } from "./unique-data";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("UniqueDataAudit", () => {
  const audit = new UniqueDataAudit();
  it("returns not applicable on an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("no statistics", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Contact our team.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("one contextual statistic", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Our survey found that 73% of respondents agreed.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("prices only", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Prices: $20, \u00a330 and 49,99 \u20ac.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("discount only", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Save 30%, 40% or 50% today.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("versions only", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Version 2.0 and size 9.5.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("hidden statistic", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p hidden>Our survey found that 73% of respondents agreed.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("footer statistic", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><footer><p>Our survey found that 73% of respondents agreed.</p></footer></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

it("does not turn research costs into statistics", () => {
  const p = mockPageContext(
    "https://example.com/",
    "<main><p>The survey costs $2,500, £3,000 or 4.500,00 €.</p></main>",
  );
  expect(new UniqueDataAudit().audit(mockCheckContext([p])).status).toBe(
    CheckStatus.NotApplicable,
  );
});
it("reads comma-decimal percentages in explicit research context", () => {
  const p = mockPageContext(
    "https://example.com/",
    "<main><p>The study measured 12,5 % of participants.</p></main>",
  );
  const result = new UniqueDataAudit().audit(mockCheckContext([p]));
  expect(result.status).toBe(CheckStatus.Pass);
  expect(result.found).toContain("12,5 %");
});

describe("UniqueDataAudit durations", () => {
  const audit = new UniqueDataAudit();
  it("does not count a response time as a statistic", () => {
    const page = mockPageContext(
      "https://example.com/support",
      "<html><body><main><p>Our research team replies within 24 hours.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("UniqueDataAudit hidden text", () => {
  const audit = new UniqueDataAudit();
  it("ignores an inline-hidden statistic", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      '<html><body><main><p>Our survey <span style="visibility:hidden">found 73% agreed</span>.</p></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("UniqueDataAudit marketing claims", () => {
  const audit = new UniqueDataAudit();
  it.each([
    "100% satisfaction guaranteed, backed by research.",
    "Our research shows shoppers love 30% off sales.",
    "Made from 100% organic cotton, tested in our research lab.",
  ])("does not count %j as a statistic", (text) => {
    const page = mockPageContext(
      "https://example.com/about",
      `<html><body><main><p>${text}</p></main></body></html>`,
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("still counts a measured percentage", () => {
    const page = mockPageContext(
      "https://example.com/report",
      "<html><body><main><p>Our survey found 73% of respondents agreed.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
});

describe("UniqueDataAudit plural context words", () => {
  const audit = new UniqueDataAudit();
  it.each([
    "Studies show 40% of buyers agreed.",
    "Our surveys found 73% of participants agreed.",
    "Independent benchmarks put throughput at 1,200 requests.",
    "Researchers measured a 12% drop.",
  ])("counts %j", (text) => {
    const page = mockPageContext(
      "https://example.com/report",
      `<html><body><main><p>${text}</p></main></body></html>`,
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
});
