import { describe, it, expect } from "vitest";
import { BreadcrumbSchemaAudit } from "./breadcrumb-schema";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("BreadcrumbSchemaAudit", () => {
  const audit = new BreadcrumbSchemaAudit();
  it("returns not applicable on an empty sample", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("no hierarchy despite deep URL", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      "<html><body><main><p>Contact our team.</p></main></body></html>",
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("visible trail without schema", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Current</li></ol></nav></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Fail);
  });
  it("single breadcrumb link", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><nav aria-label="Breadcrumb"><a href="/">Home</a></nav></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("hidden trail", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><nav hidden aria-label="Breadcrumb"><a href="/">Home</a><span aria-current="page">Current</span></nav></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
  it("existing markup", () => {
    const page = mockPageContext(
      "https://example.com/deep/content/page",
      '<html><body><script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://example.com/"},{"@type":"ListItem","position":2,"name":"Current"}]}</script></body></html>',
      1,
    );
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });
});

describe("breadcrumb representations", () => {
  const node = {
    "@type": ["BreadcrumbList", "ItemList"],
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://example.com/",
      },
      { "@type": "ListItem", position: 2, name: "Here" },
    ],
  };
  it.each([node, [node], { "@graph": [node] }])(
    "reads structured data regardless of URL depth: %j",
    (data) => {
      const p = mockPageContext(
        "https://example.com/",
        `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
      );
      expect(
        new BreadcrumbSchemaAudit().audit(mockCheckContext([p])).status,
      ).toBe(CheckStatus.Pass);
    },
  );
  it("reads gathered microdata as well as JSON-LD", () => {
    const p = mockPageContext("https://example.com/flat", "<p>Page</p>");
    p.structuredData = [node];
    expect(
      new BreadcrumbSchemaAudit().audit(mockCheckContext([p])).status,
    ).toBe(CheckStatus.Pass);
  });
});

describe("review regressions", () => {
  it("ignores page wrapper breadcrumb classes", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="site has-breadcrumbs"><nav><ul><li><a href="/">Home</a></li><li><a href="/shop">Shop</a></li></ul></nav></div></body></html>',
    );
    expect(
      new BreadcrumbSchemaAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.NotApplicable);
  });
  it("ignores disabled breadcrumb wrappers", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="breadcrumbs-disabled"><nav><ul><li><a href="/">Home</a></li><li>Shop</li></ul></nav></div></body></html>',
    );
    expect(
      new BreadcrumbSchemaAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.NotApplicable);
  });
  // A hinted list with two items and a link is a trail by this audit's
  // definition; an inner hinted fragment that is not a trail does not hide it.
  it("counts a hinted list beside a hinted fragment", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="breadcrumbs"><ul><li><a href="/shop">Shop</a></li><li>Menu</li></ul><div class="breadcrumb"><a href="/">Home</a></div></div></body></html>',
    );
    expect(
      new BreadcrumbSchemaAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.Fail);
  });
  it("keeps real nested trails", () => {
    const page = mockPageContext(
      "https://example.com/page",
      '<html><body><div class="breadcrumbs"><nav aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li>Here</li></ol></nav></div></body></html>',
    );
    expect(
      new BreadcrumbSchemaAudit().audit(mockCheckContext([page])).status,
    ).toBe(CheckStatus.Fail);
  });
});

describe("BreadcrumbSchemaAudit trail shapes", () => {
  const TRAIL =
    '<li><a href="/">Home</a></li><li><a href="/c">Cat</a></li><li aria-current="page">Here</li>';
  const audit = new BreadcrumbSchemaAudit();
  const status = (body: string) =>
    audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/c/item",
          `<html><body>${body}<main><p>Body.</p></main></body></html>`,
          1,
        ),
      ]),
    ).status;

  it.each([
    [
      "a hinted wrapper around a plain nav",
      '<div class="breadcrumbs"><nav><ol>%T</ol></nav></div>',
    ],
    [
      "hinted link wrappers inside a hinted list",
      '<ol class="breadcrumbs"><li><div class="breadcrumbs__link"><a href="/">Home</a></div></li><li><div class="breadcrumbs__link"><a href="/c">Cat</a></div></li></ol>',
    ],
    [
      "a mobile back link beside the trail",
      '<div class="breadcrumbs"><div class="breadcrumbs-mobile"><a href="/c">Back</a></div><ol>%T</ol></div>',
    ],
    [
      "a hidden hinted child",
      '<nav class="breadcrumb"><div class="breadcrumb-mobile" hidden></div><ol>%T</ol></nav>',
    ],
    [
      "a navigation role inside a hinted container",
      '<div class="breadcrumb-container"><div role="navigation"><ol>%T</ol></div></div>',
    ],
  ])("finds the trail in %s", (_, body) => {
    expect(status(body.replace("%T", TRAIL))).toBe(CheckStatus.Fail);
  });

  it.each([
    [
      "a disabled-state wrapper",
      '<div class="layout breadcrumbs-disabled"><div class="menu"><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul></div></div>',
    ],
    [
      "a disabled-state menu",
      '<ul class="menu breadcrumbs-disabled"><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>',
    ],
    [
      "a has-breadcrumbs page wrapper",
      '<div class="site has-breadcrumbs"><ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul></div>',
    ],
  ])("ignores %s", (_, body) => {
    expect(status(body)).toBe(CheckStatus.NotApplicable);
  });
});
