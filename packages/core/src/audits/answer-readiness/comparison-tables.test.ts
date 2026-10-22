import { describe, it, expect } from "vitest";
import { ComparisonTablesAudit } from "./comparison-tables";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("ComparisonTablesAudit", () => {
  const audit = new ComparisonTablesAudit();
  it("returns not applicable on an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("ordinary prose", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Contact our team.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("plain table not comparison", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><table><tr><th>Time</th><th>Event</th></tr><tr><td>9</td><td>Meet</td></tr></table></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("prose comparison", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><h1>A versus B</h1><p>A is faster. B costs less.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
  it("marked comparison", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><h1>A versus B</h1><table><tr><th>A</th><th>B</th></tr><tr><td>10</td><td>20</td></tr></table></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
  it("layout table", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><main><h1>A versus B</h1><table role="presentation"><tr><td>A</td><td>B</td></tr></table></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
  it("hidden comparison", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><h1 hidden>A versus B</h1><p>Contact</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("ComparisonTablesAudit site chrome", () => {
  const audit = new ComparisonTablesAudit();
  it("reads a comparison heading in an article header", () => {
    const page = mockPageContext(
      "https://example.com/blog/a-vs-b",
      '<html><body><main><article><header class="entry-header"><h1>A vs B</h1></header><p>A is faster.</p></article></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
});

describe("ComparisonTablesAudit hidden text", () => {
  const audit = new ComparisonTablesAudit();
  it("ignores hidden comparison text inside a visible heading", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      '<html><body><main><h1>Our news <span style="display:none">A versus B</span></h1><p>Body.</p></main></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("review regressions", () => {
  it("recognizes punctuation after comparison", () => {
    const page = mockPageContext(
      "https://example.com/page",
      "<html><body><h1>Plan comparison, explained</h1></body></html>",
    );
    expect(
      new ComparisonTablesAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.Fail);
  });
});

describe("ComparisonTablesAudit intent wording", () => {
  const audit = new ComparisonTablesAudit();
  const status = (heading: string) =>
    audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/page",
          `<html><body><main><h2>${heading}</h2><p>Body.</p></main></body></html>`,
          1,
        ),
      ]),
    ).status;

  it.each(["Setting up VS Code", "Compare-at price $50", "Compare"])(
    "does not read %j as comparison intent",
    (heading) => {
      expect(status(heading)).toBe(CheckStatus.NotApplicable);
    },
  );

  it.each(["A vs. B", "Plan comparison, explained", "Compare plans"])(
    "reads %j as comparison intent",
    (heading) => {
      expect(status(heading)).toBe(CheckStatus.Fail);
    },
  );
});

describe("ComparisonTablesAudit review follow-ups", () => {
  const audit = new ComparisonTablesAudit();
  const status = (body: string) =>
    audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/page",
          `<html><body>${body}</body></html>`,
          1,
        ),
      ]),
    ).status;

  it("ignores a comparison heading in a sidebar", () => {
    expect(
      status(
        "<aside><h3>Comparison guides</h3></aside><main><h1>Contact</h1><p>Body.</p></main>",
      ),
    ).toBe(CheckStatus.NotApplicable);
  });
  it("ignores a comparison heading in a complementary region", () => {
    expect(
      status(
        '<div role="complementary"><h3>Compare plans</h3></div><main><h1>Contact</h1></main>',
      ),
    ).toBe(CheckStatus.NotApplicable);
  });
  it.each(["How X compares to Y", "Compared with Postgres"])(
    "reads %j as comparison intent",
    (heading) => {
      expect(status(`<main><h2>${heading}</h2><p>Body.</p></main>`)).toBe(
        CheckStatus.Fail,
      );
    },
  );
  it("reads a heading split by a line break", () => {
    expect(status("<main><h2>iPhone vs<br>Pixel</h2><p>Body.</p></main>")).toBe(
      CheckStatus.Fail,
    );
  });
});
