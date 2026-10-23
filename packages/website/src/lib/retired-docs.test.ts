import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_SECTIONS } from "./markdown-slice";
import {
  isRetiredDocDir,
  RETIRED_DOCS,
  retiredDocRedirects,
} from "./retired-docs";

describe("retired documentation pages", () => {
  const live = new Set(DOC_SECTIONS.map((section) => section.slug));

  it("sends each retired page to a page the site still publishes", () => {
    for (const [from, to] of Object.entries(RETIRED_DOCS)) {
      expect(live.has(to), `${from} -> ${to}`).toBe(true);
      expect(live.has(from), `${from} is published again`).toBe(false);
    }
  });

  it("keeps the published benchmark link working", () => {
    expect(retiredDocRedirects("/agent-lighthouse")).toMatchObject({
      "/docs/benchmark/": "/agent-lighthouse/docs/quickstart/",
    });
  });

  it("adds the base path once, with or without a trailing slash", () => {
    expect(retiredDocRedirects("/x/")["/docs/benchmark/"]).toBe(
      "/x/docs/quickstart/",
    );
  });
});

describe("isRetiredDocDir", () => {
  it("matches only a retired page's own folder", () => {
    expect(isRetiredDocDir("docs/benchmark")).toBe(true);
    expect(isRetiredDocDir("docs/quickstart")).toBe(false);
    expect(isRetiredDocDir("docs/benchmark/extra")).toBe(false);
    expect(isRetiredDocDir("audits/benchmark")).toBe(false);
  });
});

const DIST = resolve(__dirname, "../../dist");

describe.skipIf(!existsSync(resolve(DIST, "docs")))("built redirects", () => {
  it("emits a redirect page for each retired page", () => {
    for (const [from, to] of Object.entries(RETIRED_DOCS)) {
      const html = readFileSync(
        resolve(DIST, "docs", from, "index.html"),
        "utf8",
      );
      expect(html).toContain(
        `http-equiv="refresh" content="0;url=/agent-lighthouse/docs/${to}/"`,
      );
      expect(html).toContain('<meta name="robots" content="noindex">');
    }
  });
});
