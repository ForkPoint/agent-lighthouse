import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { inPageChrome, inReaderContent } from "./page-chrome";

function chrome(html: string): boolean {
  const $ = cheerio.load(html);
  return inPageChrome($, $("#t")[0]!);
}

describe("inPageChrome", () => {
  it.each([
    ["a page header", '<header><span id="t">x</span></header>'],
    ["a page footer", '<footer><span id="t">x</span></footer>'],
    ["navigation", '<nav><span id="t">x</span></nav>'],
    ["a banner role", '<div role="banner"><span id="t">x</span></div>'],
    ["the header element itself", '<header id="t">x</header>'],
    [
      "an article inside a page header",
      '<header><article><span id="t">x</span></article></header>',
    ],
    [
      "navigation inside an article",
      '<article><nav><span id="t">x</span></nav></article>',
    ],
  ])("counts %s as chrome", (_, html) => {
    expect(chrome(html)).toBe(true);
  });

  it.each([
    [
      "an article header",
      '<article><header><time id="t">x</time></header></article>',
    ],
    [
      "an article footer",
      '<article><footer><a id="t">x</a></footer></article>',
    ],
    ["a header inside main", '<main><header><h1 id="t">x</h1></header></main>'],
    ["a section header", '<section><header id="t">x</header></section>'],
    ["body content", '<main><p id="t">x</p></main>'],
  ])("treats %s as content", (_, html) => {
    expect(chrome(html)).toBe(false);
  });
});

it.each(["main", "article", "complementary", "region"])(
  "keeps headers inside role=%s as content",
  (role) => {
    const $ = cheerio.load(
      `<div role="${role}"><header><h1>Content</h1></header></div>`,
    );
    expect(inPageChrome($, $("h1")[0]!)).toBe(false);
  },
);

describe("inReaderContent", () => {
  const content = (html: string): boolean => {
    const $ = cheerio.load(html);
    return inReaderContent($, $("#t")[0]!);
  };
  it.each([
    ["main content", '<main><p id="t">x</p></main>'],
    [
      "an article footer",
      '<article><footer><a id="t">x</a></footer></article>',
    ],
  ])("counts %s", (_, html) => {
    expect(content(html)).toBe(true);
  });
  it.each([
    ["an aside", '<aside><p id="t">x</p></aside>'],
    ["a complementary role", '<div role="complementary"><p id="t">x</p></div>'],
    ["the page footer", '<footer><p id="t">x</p></footer>'],
    ["navigation", '<nav><a id="t">x</a></nav>'],
    ["hidden text", '<main><p id="t" hidden>x</p></main>'],
    [
      "an inline-hidden ancestor",
      '<main><div style="display:none"><p id="t">x</p></div></main>',
    ],
  ])("excludes %s", (_, html) => {
    expect(content(html)).toBe(false);
  });
});
