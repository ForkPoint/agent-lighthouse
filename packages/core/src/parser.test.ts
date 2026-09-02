import {
  parseHtml,
  extractJsonLd,
  flattenJsonLd,
  topLevelJsonLd,
  allJsonLdNodes,
  extractMarkdownLinks,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  extractHeadings,
  extractImages,
  extractForms,
  extractInternalLinks,
  extractNavLinks,
  extractScripts,
  extractStylesheetUrls,
  getMainContentText,
  getRenderedText,
  getWordCount,
  detectPageType,
} from "./parser";

// ---------------------------------------------------------------------------
// parseHtml
// ---------------------------------------------------------------------------

describe("parseHtml", () => {
  it("returns a CheerioAPI that can query elements", () => {
    const $ = parseHtml('<html><body><p class="intro">Hello</p></body></html>');
    expect($("p.intro").text()).toBe("Hello");
  });
});

// ---------------------------------------------------------------------------
// extractJsonLd
// ---------------------------------------------------------------------------

describe("extractJsonLd", () => {
  it("extracts valid JSON-LD from script tags", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const result = extractJsonLd($);
    expect(result).toEqual([{ "@type": "Organization", name: "Acme" }]);
  });

  it("returns empty array when no JSON-LD is present", () => {
    const $ = parseHtml("<html><head></head><body></body></html>");
    expect(extractJsonLd($)).toEqual([]);
  });

  it("skips invalid JSON without throwing", () => {
    const html = `<html><head>
      <script type="application/ld+json">{invalid json!}</script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    expect(() => extractJsonLd($)).not.toThrow();
    expect(extractJsonLd($)).toEqual([]);
  });

  it("handles multiple JSON-LD blocks", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
      <script type="application/ld+json">{"@type":"WebSite","url":"https://acme.com"}</script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const result = extractJsonLd($);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "Organization", name: "Acme" });
    expect(result[1]).toEqual({ "@type": "WebSite", url: "https://acme.com" });
  });

  it("collects valid blocks and skips invalid ones", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Good"}</script>
      <script type="application/ld+json">NOT JSON</script>
      <script type="application/ld+json">{"@type":"AlsoGood"}</script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const result = extractJsonLd($);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "Good" });
    expect(result[1]).toEqual({ "@type": "AlsoGood" });
  });
});

// ---------------------------------------------------------------------------
// extractMetaTags
// ---------------------------------------------------------------------------

describe("extractMetaTags", () => {
  it("extracts name-based meta tags", () => {
    const html = `<html><head>
      <meta name="description" content="A great page">
      <meta name="author" content="Alice">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const meta = extractMetaTags($);
    expect(meta["description"]).toBe("A great page");
    expect(meta["author"]).toBe("Alice");
  });

  it("extracts property-based meta tags (Open Graph)", () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Title">
      <meta property="og:description" content="OG Desc">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const meta = extractMetaTags($);
    expect(meta["og:title"]).toBe("OG Title");
    expect(meta["og:description"]).toBe("OG Desc");
  });

  it("extracts http-equiv meta tags", () => {
    const html = `<html><head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const meta = extractMetaTags($);
    expect(meta["content-type"]).toBe("text/html; charset=utf-8");
  });

  it("returns empty object for no meta tags", () => {
    const $ = parseHtml("<html><head></head><body></body></html>");
    expect(extractMetaTags($)).toEqual({});
  });

  it("lowercases meta tag names", () => {
    const html = `<html><head>
      <meta name="Description" content="test">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const meta = extractMetaTags($);
    expect(meta["description"]).toBe("test");
    expect(meta["Description"]).toBeUndefined();
  });

  it("ignores meta tags without content", () => {
    const html = `<html><head>
      <meta name="viewport">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    expect(extractMetaTags($)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// extractHeadLinks
// ---------------------------------------------------------------------------

describe("extractHeadLinks", () => {
  it("extracts link elements with rel, type, href, title", () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const links = extractHeadLinks($);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rel: "alternate",
      type: "application/rss+xml",
      href: "/feed.xml",
      title: "RSS Feed",
    });
  });

  it("defaults missing attributes to empty string", () => {
    const html = `<html><head><link rel="alternate" href="/feed.xml"></head><body></body></html>`;
    const $ = parseHtml(html);
    const links = extractHeadLinks($);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rel: "alternate",
      type: "",
      href: "/feed.xml",
      title: "",
    });
  });

  it("returns empty array when no links exist", () => {
    const $ = parseHtml("<html><head></head><body></body></html>");
    expect(extractHeadLinks($)).toEqual([]);
  });

  it("skips stylesheet and preload links from results", () => {
    const html = `<html>
      <head><link rel="canonical" href="/page"><link rel="stylesheet" href="/style.css"><link rel="preload" href="/font.woff2"></head>
      <body><link rel="alternate" type="text/markdown" href="/page.md"></body>
    </html>`;
    const $ = parseHtml(html);
    const links = extractHeadLinks($);
    // canonical + body alternate = 2 (stylesheet and preload are filtered out)
    expect(links).toHaveLength(2);
    expect(links[0].href).toBe("/page");
    expect(links[1].href).toBe("/page.md");
  });
});

// ---------------------------------------------------------------------------
// extractHeadings
// ---------------------------------------------------------------------------

describe("extractHeadings", () => {
  it("returns headings with correct levels and text", () => {
    const html = `<html><body>
      <h1>Title</h1>
      <h2>Subtitle</h2>
    </body></html>`;
    const $ = parseHtml(html);
    const headings = extractHeadings($);
    expect(headings).toEqual([
      { level: 1, text: "Title" },
      { level: 2, text: "Subtitle" },
    ]);
  });

  it("returns headings in document order", () => {
    const html = `<html><body>
      <h3>Third</h3>
      <h1>First</h1>
      <h2>Second</h2>
    </body></html>`;
    const $ = parseHtml(html);
    const headings = extractHeadings($);
    expect(headings[0]).toEqual({ level: 3, text: "Third" });
    expect(headings[1]).toEqual({ level: 1, text: "First" });
    expect(headings[2]).toEqual({ level: 2, text: "Second" });
  });

  it("handles all h1-h6 levels", () => {
    const html = `<html><body>
      <h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>
    </body></html>`;
    const $ = parseHtml(html);
    const headings = extractHeadings($);
    expect(headings).toHaveLength(6);
    headings.forEach((h, i) => {
      expect(h.level).toBe(i + 1);
      expect(h.text).toBe(`H${i + 1}`);
    });
  });

  it("trims whitespace from heading text", () => {
    const html = `<html><body><h1>  Spaced Out  </h1></body></html>`;
    const $ = parseHtml(html);
    const headings = extractHeadings($);
    expect(headings[0].text).toBe("Spaced Out");
  });

  it("returns empty array when no headings exist", () => {
    const $ = parseHtml("<html><body><p>No headings here</p></body></html>");
    expect(extractHeadings($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractImages
// ---------------------------------------------------------------------------

describe("extractImages", () => {
  it("returns src, alt, width, height, loading, role", () => {
    const html = `<html><body>
      <img src="/logo.png" alt="Logo" width="200" height="100" loading="lazy" role="img">
    </body></html>`;
    const $ = parseHtml(html);
    const images = extractImages($);
    expect(images).toHaveLength(1);
    expect(images[0]).toEqual({
      src: "/logo.png",
      alt: "Logo",
      hasAlt: true,
      width: "200",
      height: "100",
      loading: "lazy",
      role: "img",
    });
  });

  it("handles missing optional attributes as undefined", () => {
    const html = `<html><body><img src="/photo.jpg" alt="Photo"></body></html>`;
    const $ = parseHtml(html);
    const images = extractImages($);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe("/photo.jpg");
    expect(images[0].alt).toBe("Photo");
    expect(images[0].width).toBeUndefined();
    expect(images[0].height).toBeUndefined();
    expect(images[0].loading).toBeUndefined();
    expect(images[0].role).toBeUndefined();
  });

  it("defaults src and alt to empty string when missing", () => {
    const html = `<html><body><img></body></html>`;
    const $ = parseHtml(html);
    const images = extractImages($);
    expect(images[0].src).toBe("");
    expect(images[0].alt).toBe("");
    expect(images[0].hasAlt).toBe(false);
  });

  it('distinguishes a present empty alt="" from a missing alt attribute', () => {
    const html = `<html><body><img src="/a.png" alt=""><img src="/b.png"></body></html>`;
    const $ = parseHtml(html);
    const images = extractImages($);
    expect(images[0].alt).toBe("");
    expect(images[0].hasAlt).toBe(true);
    expect(images[1].alt).toBe("");
    expect(images[1].hasAlt).toBe(false);
  });

  it("extracts multiple images", () => {
    const html = `<html><body>
      <img src="/a.png" alt="A">
      <img src="/b.png" alt="B">
      <img src="/c.png" alt="C">
    </body></html>`;
    const $ = parseHtml(html);
    expect(extractImages($)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// extractForms
// ---------------------------------------------------------------------------

describe("extractForms", () => {
  it("extracts form action and method", () => {
    const html = `<html><body>
      <form action="/submit" method="POST">
        <input name="email" type="email">
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms).toHaveLength(1);
    expect(forms[0].action).toBe("/submit");
    expect(forms[0].method).toBe("POST");
  });

  it("extracts inputs with name, type, required", () => {
    const html = `<html><body>
      <form action="/register" method="POST">
        <input name="name" type="text" required>
        <input name="age" type="number">
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs).toHaveLength(2);
    expect(forms[0].inputs[0]).toMatchObject({
      name: "name",
      type: "text",
      required: true,
    });
    expect(forms[0].inputs[1]).toMatchObject({
      name: "age",
      type: "number",
      required: false,
    });
  });

  it("resolves labels via for/id matching", () => {
    const html = `<html><body>
      <form action="/login" method="POST">
        <label for="email-field">Email Address</label>
        <input id="email-field" name="email" type="email">
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs[0].label).toBe("Email Address");
  });

  it("sets label to undefined when no matching label exists", () => {
    const html = `<html><body>
      <form action="/search">
        <input name="q" type="text">
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs[0].label).toBeUndefined();
  });

  it("defaults method to GET if missing", () => {
    const html = `<html><body>
      <form action="/search">
        <input name="q" type="text">
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].method).toBe("GET");
  });

  it("defaults action to empty string if missing", () => {
    const html = `<html><body><form><input name="x"></form></body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].action).toBe("");
  });

  it("extracts select and textarea elements", () => {
    const html = `<html><body>
      <form action="/form" method="POST">
        <select name="country"><option>US</option></select>
        <textarea name="bio"></textarea>
      </form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs).toHaveLength(2);
    expect(forms[0].inputs[0]).toMatchObject({
      name: "country",
      type: "select",
    });
    expect(forms[0].inputs[1]).toMatchObject({ name: "bio", type: "textarea" });
  });

  it("defaults input type to text when not specified", () => {
    const html = `<html><body>
      <form action="/f"><input name="x"></form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs[0].type).toBe("text");
  });
});

// ---------------------------------------------------------------------------
// extractInternalLinks
// ---------------------------------------------------------------------------

describe("extractInternalLinks", () => {
  const domain = "example.com";

  it("extracts same-domain links", () => {
    const html = `<html><body>
      <a href="https://example.com/about">About</a>
      <a href="https://example.com/contact">Contact</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toContain("https://example.com/about");
    expect(links).toContain("https://example.com/contact");
  });

  it("ignores external links", () => {
    const html = `<html><body>
      <a href="https://example.com/page">Internal</a>
      <a href="https://other.com/page">External</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toHaveLength(1);
    expect(links[0]).toBe("https://example.com/page");
  });

  it("deduplicates links", () => {
    const html = `<html><body>
      <a href="https://example.com/page">Link 1</a>
      <a href="https://example.com/page">Link 2</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toHaveLength(1);
  });

  it("handles relative URLs by resolving against the domain", () => {
    const html = `<html><body>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toContain("https://example.com/about");
    expect(links).toContain("https://example.com/contact");
  });

  it("includes subdomain links", () => {
    const html = `<html><body>
      <a href="https://blog.example.com/post">Blog</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toContain("https://blog.example.com/post");
  });

  it("returns empty array when no links match", () => {
    const html = `<html><body>
      <a href="https://other.com">External</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toEqual([]);
  });

  it("ignores anchors without href", () => {
    const html = `<html><body><a>No href</a></body></html>`;
    const $ = parseHtml(html);
    const links = extractInternalLinks($, domain);
    expect(links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractNavLinks
// ---------------------------------------------------------------------------

describe("extractNavLinks", () => {
  it("only extracts links within <nav> elements", () => {
    const html = `<html><body>
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
      <a href="/footer-link">Footer</a>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractNavLinks($);
    expect(links).toEqual(["/home", "/about"]);
  });

  it("returns empty array when no <nav> exists", () => {
    const html = `<html><body><a href="/link">Link</a></body></html>`;
    const $ = parseHtml(html);
    expect(extractNavLinks($)).toEqual([]);
  });

  it("extracts links from multiple <nav> elements", () => {
    const html = `<html><body>
      <nav><a href="/a">A</a></nav>
      <nav><a href="/b">B</a></nav>
    </body></html>`;
    const $ = parseHtml(html);
    const links = extractNavLinks($);
    expect(links).toEqual(["/a", "/b"]);
  });

  it("ignores nav anchors without href", () => {
    const html = `<html><body><nav><a>No link</a></nav></body></html>`;
    const $ = parseHtml(html);
    expect(extractNavLinks($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractScripts
// ---------------------------------------------------------------------------

describe("extractScripts", () => {
  it("detects async, defer, module attributes", () => {
    const html = `<html><head>
      <script src="/app.js" async></script>
      <script src="/vendor.js" defer></script>
      <script src="/esm.js" type="module"></script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const scripts = extractScripts($);
    expect(scripts).toHaveLength(3);
    expect(scripts[0]).toMatchObject({
      src: "/app.js",
      async: true,
      defer: false,
      isModule: false,
    });
    expect(scripts[1]).toMatchObject({
      src: "/vendor.js",
      async: false,
      defer: true,
      isModule: false,
    });
    expect(scripts[2]).toMatchObject({
      src: "/esm.js",
      async: false,
      defer: false,
      isModule: true,
      type: "module",
    });
  });

  it("identifies inline vs external scripts", () => {
    const html = `<html><head>
      <script src="/external.js"></script>
      <script>console.log("inline")</script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const scripts = extractScripts($);
    expect(scripts[0].inline).toBe(false);
    expect(scripts[0].src).toBe("/external.js");
    expect(scripts[1].inline).toBe(true);
    expect(scripts[1].src).toBeUndefined();
  });

  it("returns empty array when no scripts exist", () => {
    const $ = parseHtml("<html><head></head><body></body></html>");
    expect(extractScripts($)).toEqual([]);
  });

  it("defaults async and defer to false when absent", () => {
    const html = `<html><head><script src="/plain.js"></script></head><body></body></html>`;
    const $ = parseHtml(html);
    const scripts = extractScripts($);
    expect(scripts[0].async).toBe(false);
    expect(scripts[0].defer).toBe(false);
  });

  it("detects noModule attribute", () => {
    const html = `<html><head>
      <script src="/polyfills.js" nomodule></script>
      <script src="/app.js" async></script>
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const scripts = extractScripts($);
    expect(scripts[0]).toMatchObject({
      src: "/polyfills.js",
      noModule: true,
      async: false,
    });
    expect(scripts[1]).toMatchObject({
      src: "/app.js",
      noModule: false,
      async: true,
    });
  });
});

// ---------------------------------------------------------------------------
// extractStylesheetUrls
// ---------------------------------------------------------------------------

describe("extractStylesheetUrls", () => {
  it("extracts href from link[rel=stylesheet]", () => {
    const html = `<html><head>
      <link rel="stylesheet" href="/styles.css">
      <link rel="stylesheet" href="/theme.css">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const urls = extractStylesheetUrls($);
    expect(urls).toEqual(["/styles.css", "/theme.css"]);
  });

  it("ignores non-stylesheet links", () => {
    const html = `<html><head>
      <link rel="icon" href="/favicon.ico">
      <link rel="stylesheet" href="/styles.css">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const urls = extractStylesheetUrls($);
    expect(urls).toEqual(["/styles.css"]);
  });

  it("returns empty array when no stylesheets exist", () => {
    const $ = parseHtml("<html><head></head><body></body></html>");
    expect(extractStylesheetUrls($)).toEqual([]);
  });

  it("ignores stylesheet links without href", () => {
    const html = `<html><head><link rel="stylesheet"></head><body></body></html>`;
    const $ = parseHtml(html);
    expect(extractStylesheetUrls($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMainContentText
// ---------------------------------------------------------------------------

describe("getMainContentText", () => {
  it("returns text from <main> if present", () => {
    const html = `<html><body>
      <header>Header</header>
      <main><p>Main content here</p></main>
      <footer>Footer</footer>
    </body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("Main content here");
  });

  it("falls back to <body> text when no <main> exists", () => {
    const html = `<html><body><p>Body content</p></body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("Body content");
  });

  it("trims whitespace", () => {
    const html = `<html><body><main>   padded   </main></body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("padded");
  });
});

// ---------------------------------------------------------------------------
// getWordCount
// ---------------------------------------------------------------------------

describe("getWordCount", () => {
  it("counts words correctly", () => {
    const html = `<html><body><main><p>Hello beautiful world</p></main></body></html>`;
    const $ = parseHtml(html);
    expect(getWordCount($)).toBe(3);
  });

  it("handles multiple whitespace characters", () => {
    const html = `<html><body><main><p>Hello    world\t\tfoo\nbar</p></main></body></html>`;
    const $ = parseHtml(html);
    expect(getWordCount($)).toBe(4);
  });

  it("returns 0 for empty content", () => {
    const html = `<html><body><main></main></body></html>`;
    const $ = parseHtml(html);
    expect(getWordCount($)).toBe(0);
  });

  it("returns 0 for whitespace-only content", () => {
    const html = `<html><body><main>    \t\n   </main></body></html>`;
    const $ = parseHtml(html);
    expect(getWordCount($)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractJsonLd — control-character retry
// ---------------------------------------------------------------------------

describe("extractJsonLd — control-character retry", () => {
  it("recovers JSON-LD that contains raw control characters in string values", () => {
    // The literal newline inside the "name" value makes strict JSON.parse throw;
    // the retry strips control chars and parses successfully.
    const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Line1
Line2"}</script></head><body></body></html>`;
    const $ = parseHtml(html);
    const result = extractJsonLd($);
    expect(result).toEqual([{ "@type": "Product", name: "Line1 Line2" }]);
  });

  it("ignores empty <script> tags", () => {
    const html = `<html><head><script type="application/ld+json"></script></head><body></body></html>`;
    const $ = parseHtml(html);
    expect(extractJsonLd($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMainContentText — non-content node removal
// ---------------------------------------------------------------------------

describe("getMainContentText — node removal", () => {
  it("drops script/style/noscript/template content", () => {
    const html = `<html><body><main>
      <p>Visible text</p>
      <script>var x = 1;</script>
      <style>.a{color:red}</style>
      <noscript>No JS fallback</noscript>
      <template>Template content</template>
    </main></body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("Visible text");
  });
});

// ---------------------------------------------------------------------------
// getMainContentText / getRenderedText — real-world <main> shapes
// ---------------------------------------------------------------------------

describe("getMainContentText / getRenderedText — real-world <main> shapes", () => {
  // velasca.com: a single empty <main>, with all 194 words of copy sitting
  // elsewhere in the <body>.
  it("falls back to the body when the only <main> holds no text", () => {
    const words = Array.from({ length: 194 }, (_, i) => `word${i}`).join(" ");
    const html = `<html><body>
      <main></main>
      <div class="section"><p>${words}</p></div>
    </body></html>`;
    const $ = parseHtml(html);

    const mainText = getMainContentText($);
    expect(mainText).toContain("word0");
    expect(mainText).toContain("word193");
    expect(getWordCount($)).toBe(194);

    const rendered = getRenderedText($);
    expect(rendered).toContain("word0");
    expect(rendered.split(/\s+/).filter(Boolean).length).toBe(194);
  });

  // hiutdenim.co.uk: four <main> elements, the first holding 49 characters.
  it("picks the <main> holding the most text, not the first", () => {
    const tiny = "a".repeat(49);
    const real = Array.from({ length: 120 }, (_, i) => `real${i}`).join(" ");
    const html = `<html><body>
      <main>${tiny}</main>
      <main></main>
      <main>${real}</main>
      <main>short tail</main>
    </body></html>`;
    const $ = parseHtml(html);

    const mainText = getMainContentText($);
    expect(mainText).toBe(real);
    expect(mainText).not.toContain("aaa");
    expect(getWordCount($)).toBe(120);
  });

  it("ignores a <main> inside a <template>: inert markup never wins", () => {
    const inert = `${"X".repeat(500)} template main content`;
    const html = `<html><body>
      <main>short real content</main>
      <template><main>${inert}</main></template>
    </body></html>`;
    const $ = parseHtml(html);

    expect(getMainContentText($)).toBe("short real content");
    expect(getRenderedText($)).toBe("short real content");
  });

  it("keeps single-<main> behaviour: chrome outside <main> stays excluded", () => {
    const html = `<html><body>
      <header>Header chrome</header>
      <nav>Nav chrome</nav>
      <main><p>The real article body</p></main>
      <footer>Footer chrome</footer>
    </body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("The real article body");
  });

  it("getRenderedText drops script/style/noscript/template but keeps header, nav and footer", () => {
    const html = `<html><body>
      <header>Header chrome</header>
      <nav>Nav chrome</nav>
      <main><p>The real article body</p></main>
      <footer>Footer chrome</footer>
      <script>var x = 1;</script>
      <style>.a{color:red}</style>
      <noscript>No JS fallback</noscript>
      <template>Template content</template>
    </body></html>`;
    const $ = parseHtml(html);
    const rendered = getRenderedText($);

    expect(rendered).toBe(
      "Header chrome Nav chrome The real article body Footer chrome",
    );
    expect(rendered).not.toContain("var x");
    expect(rendered).not.toContain("color:red");
    expect(rendered).not.toContain("No JS fallback");
    expect(rendered).not.toContain("Template content");
  });

  it("returns the body text from both functions when no <main> exists", () => {
    const html = `<html><body><p>Plain body copy</p></body></html>`;
    const $ = parseHtml(html);
    expect(getMainContentText($)).toBe("Plain body copy");
    expect(getRenderedText($)).toBe("Plain body copy");
  });
});

// ---------------------------------------------------------------------------
// flattenJsonLd
// ---------------------------------------------------------------------------

describe("flattenJsonLd", () => {
  it("flattens nested objects and arrays, skipping primitives", () => {
    const flat = flattenJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: "P",
        offers: { "@type": "Offer", price: 1 },
        reviews: [{ "@type": "Review", author: "A" }],
        tags: ["x", "y"],
        count: 5,
      },
    ]);
    const types = flat.map((n) => (n as Record<string, unknown>)["@type"]);
    expect(types).toEqual(["Product", "Offer", "Review"]);
  });

  it("propagates @context to nested nodes that lack one", () => {
    const flat = flattenJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "Outer",
        inner: { "@type": "Inner" },
      },
    ]);
    const inner = flat.find(
      (n) => (n as Record<string, unknown>)["@type"] === "Inner",
    );
    expect((inner as Record<string, unknown>)["@context"]).toBe(
      "https://schema.org",
    );
  });

  it("does not overwrite a nested node that already has its own @context", () => {
    const flat = flattenJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "Outer",
        inner: { "@context": "http://example.org", "@type": "Inner" },
      },
    ]);
    const inner = flat.find(
      (n) => (n as Record<string, unknown>)["@type"] === "Inner",
    );
    expect((inner as Record<string, unknown>)["@context"]).toBe(
      "http://example.org",
    );
  });

  it("leaves @context undefined when there is none to inherit", () => {
    const flat = flattenJsonLd([{ "@type": "NoCtx" }]);
    expect((flat[0] as Record<string, unknown>)["@context"]).toBeUndefined();
  });

  it("handles a top-level array block", () => {
    const flat = flattenJsonLd([[{ "@type": "A" }] as unknown as object]);
    expect(flat).toHaveLength(1);
    expect((flat[0] as Record<string, unknown>)["@type"]).toBe("A");
  });

  it("walks @graph property values", () => {
    const flat = flattenJsonLd([{ "@graph": [{ "@type": "G" }] }]);
    const types = flat.map((n) => (n as Record<string, unknown>)["@type"]);
    expect(types).toContain("G");
  });

  it("ignores null and primitive blocks", () => {
    const flat = flattenJsonLd([
      null as unknown as object,
      "str" as unknown as object,
      42 as unknown as object,
      { "@type": "Y" },
    ]);
    expect(flat).toHaveLength(1);
    expect((flat[0] as Record<string, unknown>)["@type"]).toBe("Y");
  });
});

// ---------------------------------------------------------------------------
// topLevelJsonLd / allJsonLdNodes
// ---------------------------------------------------------------------------

describe("topLevelJsonLd", () => {
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "X",
    publisher: { "@type": "Organization", name: "Acme" },
  };
  it("does not hoist nested property objects to the top level", () => {
    const tops = topLevelJsonLd([article]);
    expect(tops).toHaveLength(1);
    expect((tops[0] as { "@type": string })["@type"]).toBe("Article");
  });
  it("expands @graph members as top-level entities", () => {
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "S" },
        { "@type": "Organization", name: "Acme" },
      ],
    };
    const types = topLevelJsonLd([graph])
      .map((o) => (o as { "@type": string })["@type"])
      .sort();
    expect(types).toEqual(["Organization", "WebSite"]);
  });
  it("expands top-level arrays", () => {
    const tops = topLevelJsonLd([
      [{ "@type": "FAQPage" }, { "@type": "WebSite" }] as unknown as object,
    ]);
    expect(tops).toHaveLength(2);
  });
  it("propagates @context onto @graph members that lack one", () => {
    const graph = {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "WebSite" }],
    };
    const tops = topLevelJsonLd([graph]);
    expect((tops[0] as Record<string, unknown>)["@context"]).toBe(
      "https://schema.org",
    );
  });
  it("ignores null and primitive blocks", () => {
    const tops = topLevelJsonLd([
      null as unknown as object,
      "str" as unknown as object,
      42 as unknown as object,
      { "@type": "WebPage" },
    ]);
    expect(tops).toHaveLength(1);
    expect((tops[0] as Record<string, unknown>)["@type"]).toBe("WebPage");
  });
});

describe("allJsonLdNodes", () => {
  it("still walks nested objects for deep searches", () => {
    const article = {
      "@type": "Article",
      publisher: { "@type": "Organization" },
    };
    const types = allJsonLdNodes([article]).map(
      (o) => (o as { "@type"?: string })["@type"],
    );
    expect(types).toContain("Organization");
  });

  it("does not descend into an object-valued @context", () => {
    // zapier.com serves `"@context": { "@vocab": "https://schema.org/" }`.
    // Inheriting that object into the child and then walking it stamped the
    // context with itself and recursed until the stack ran out, which took
    // two audits down with an "Audit error".
    const org = {
      "@context": { "@vocab": "https://schema.org/" },
      "@type": "Organization",
      founder: { "@type": "Person", name: "x" },
    };
    const nodes = allJsonLdNodes([org]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((o) => (o as { "@type"?: string })["@type"])).toEqual([
      "Organization",
      "Person",
    ]);
    expect((nodes[1] as Record<string, unknown>)["@context"]).toBe(
      org["@context"],
    );
  });
});

// ---------------------------------------------------------------------------
// extractMarkdownLinks
// ---------------------------------------------------------------------------

describe("extractMarkdownLinks", () => {
  const body = `# Links

Check the [Docs](https://a.com/docs): API reference here.
See [Docs](https://a.com/docs) again.
[Relative](/local) and [Ftp](ftp://a.com/file).

- **Privacy**: https://a.com/privacy — Our privacy policy
* https://a.com/star
+ https://a.com/plus.
1. https://a.com/one
- plain text with no link
`;

  it("extracts inline links with an optional trailing description", () => {
    const links = extractMarkdownLinks(body);
    const docs = links.find((l) => l.url === "https://a.com/docs");
    expect(docs).toEqual({
      url: "https://a.com/docs",
      label: "Docs",
      description: "API reference here.",
    });
  });

  it("deduplicates repeated URLs", () => {
    const links = extractMarkdownLinks(body);
    expect(links.filter((l) => l.url === "https://a.com/docs")).toHaveLength(1);
  });

  it("skips non-http(s) links", () => {
    const links = extractMarkdownLinks(body);
    expect(links.some((l) => l.url.includes("/local"))).toBe(false);
    expect(links.some((l) => l.url.startsWith("ftp:"))).toBe(false);
  });

  it("extracts bare-URL bullet items with label and description", () => {
    const links = extractMarkdownLinks(body);
    const privacy = links.find((l) => l.url === "https://a.com/privacy");
    expect(privacy).toEqual({
      url: "https://a.com/privacy",
      label: "Privacy",
      description: "Our privacy policy",
    });
  });

  it("supports *, + and numbered bullets and strips trailing punctuation", () => {
    const links = extractMarkdownLinks(body);
    const urls = links.map((l) => l.url);
    expect(urls).toContain("https://a.com/star");
    expect(urls).toContain("https://a.com/plus"); // trailing '.' stripped
    expect(urls).toContain("https://a.com/one");
  });

  it("returns an empty array when there are no links", () => {
    expect(extractMarkdownLinks("just some prose, nothing here")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractMicrodata
// ---------------------------------------------------------------------------

describe("extractMicrodata", () => {
  it("parses an item with typed properties, value rules, repeats and nesting", () => {
    const html = `<html><body>
      <div itemscope itemtype="https://schema.org/Product">
        <span itemprop="name">Widget</span>
        <meta itemprop="sku" content="ABC">
        <a itemprop="url" href="/p/1">link</a>
        <img itemprop="image" src="/i.png">
        <area itemprop="map" href="/area">
        <video itemprop="clip" src="/v.mp4"></video>
        <object itemprop="model" data="/m.obj"></object>
        <data itemprop="pid" value="42">42</data>
        <meter itemprop="rank" value="5"></meter>
        <time itemprop="released" datetime="2020-01-01">Jan</time>
        <time itemprop="updated">Feb</time>
        <span itemprop="override" content="OVR">ignored</span>
        <span itemprop="cat">A</span>
        <span itemprop="cat">B</span>
        <span itemprop="">empty-name</span>
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <span itemprop="price">9.99</span>
        </div>
      </div>
    </body></html>`;
    const $ = parseHtml(html);
    const items = extractMicrodata($) as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    const p = items[0]!;
    expect(p["@type"]).toBe("Product");
    expect(p["@context"]).toBe("https://schema.org");
    expect(p["name"]).toBe("Widget");
    expect(p["sku"]).toBe("ABC");
    expect(p["url"]).toBe("/p/1");
    expect(p["image"]).toBe("/i.png");
    expect(p["map"]).toBe("/area");
    expect(p["clip"]).toBe("/v.mp4");
    expect(p["model"]).toBe("/m.obj");
    expect(p["pid"]).toBe("42");
    expect(p["rank"]).toBe("5");
    expect(p["released"]).toBe("2020-01-01");
    expect(p["updated"]).toBe("Feb");
    expect(p["override"]).toBe("OVR");
    expect(p["cat"]).toEqual(["A", "B"]);
    // Nested item captured as an object; its price not hoisted to the parent.
    expect(p["price"]).toBeUndefined();
    const offer = p["offers"] as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer["price"]).toBe("9.99");
  });

  it("emits no @type for an itemscope without itemtype", () => {
    const html = `<html><body><div itemscope><span itemprop="n">x</span></div></body></html>`;
    const $ = parseHtml(html);
    const items = extractMicrodata($) as Record<string, unknown>[];
    expect(items[0]!["@type"]).toBeUndefined();
    expect(items[0]!["n"]).toBe("x");
  });

  it("parses multi-term itemtypes into an array", () => {
    const html = `<html><body>
      <div itemscope itemtype="https://schema.org/Product https://schema.org/Thing"></div>
    </body></html>`;
    const $ = parseHtml(html);
    const items = extractMicrodata($) as Record<string, unknown>[];
    expect(items[0]!["@type"]).toEqual(["Product", "Thing"]);
  });

  it("returns an empty array when there is no microdata", () => {
    const $ = parseHtml("<html><body><p>no microdata</p></body></html>");
    expect(extractMicrodata($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractRdfa
// ---------------------------------------------------------------------------

describe("extractRdfa", () => {
  it("parses typeof/property items with prefixed names and nesting", () => {
    const html = `<html><body>
      <div typeof="Product">
        <span property="schema:name">RName</span>
        <a property="url" href="/r">l</a>
        <span property="">skip-empty</span>
        <div property="offers" typeof="Offer">
          <span property="price">5</span>
        </div>
      </div>
    </body></html>`;
    const $ = parseHtml(html);
    const items = extractRdfa($) as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    const p = items[0]!;
    expect(p["@context"]).toBe("https://schema.org");
    expect(p["@type"]).toBe("Product");
    expect(p["name"]).toBe("RName");
    expect(p["url"]).toBe("/r");
    expect(p["price"]).toBeUndefined();
    const offer = p["offers"] as Record<string, unknown>;
    expect(offer["@type"]).toBe("Offer");
    expect(offer["price"]).toBe("5");
  });

  it("emits no @type for a typeof without a value", () => {
    const html = `<html><body><div typeof=""><span property="x">v</span></div></body></html>`;
    const $ = parseHtml(html);
    const items = extractRdfa($) as Record<string, unknown>[];
    expect(items[0]!["@type"]).toBeUndefined();
    expect(items[0]!["x"]).toBe("v");
  });

  it("returns an empty array when there is no RDFa", () => {
    const $ = parseHtml("<html><body><p>no rdfa</p></body></html>");
    expect(extractRdfa($)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// detectPageType
// ---------------------------------------------------------------------------

describe("detectPageType", () => {
  const $empty = parseHtml("<html><body></body></html>");

  it("detects the homepage (first page at root path)", () => {
    expect(detectPageType("https://x.com/", $empty, [], {}, true)).toBe(
      "homepage",
    );
  });

  it("does not treat a non-root first page as the homepage", () => {
    // Exercises the right operand of the homepage path check.
    expect(detectPageType("https://x.com/shop", $empty, [], {}, true)).toBe(
      "category",
    );
  });

  it("does not treat the root as homepage when it is not the first page", () => {
    expect(detectPageType("https://x.com/", $empty, [], {}, false)).toBe(
      "content",
    );
  });

  it("detects a product page from JSON-LD", () => {
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [{ "@type": "Product" }],
        {},
        false,
      ),
    ).toBe("product");
  });

  it("detects a product page from og:type", () => {
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [],
        { "og:type": "product" },
        false,
      ),
    ).toBe("product");
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [],
        { "og:type": "product.item" },
        false,
      ),
    ).toBe("product");
  });

  it("detects a product page from URL patterns", () => {
    expect(
      detectPageType(
        "https://x.com/products/widget/abc",
        $empty,
        [],
        {},
        false,
      ),
    ).toBe("product");
    expect(
      detectPageType("https://x.com/product-xyz123", $empty, [], {}, false),
    ).toBe("product");
  });

  it("detects a product page from add-to-cart + price HTML signals", () => {
    const $ = parseHtml(
      '<html><body><button class="add-to-cart">x</button><span class="price">$1</span></body></html>',
    );
    expect(detectPageType("https://x.com/thing", $, [], {}, false)).toBe(
      "product",
    );
  });

  it("detects a category page from JSON-LD", () => {
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [{ "@type": "CollectionPage" }],
        {},
        false,
      ),
    ).toBe("category");
  });

  it("detects a category page from URL patterns", () => {
    expect(
      detectPageType("https://x.com/category/shoes", $empty, [], {}, false),
    ).toBe("category");
    expect(detectPageType("https://x.com/men", $empty, [], {}, false)).toBe(
      "category",
    );
  });

  it("detects a category page from a product-card grid", () => {
    const $ = parseHtml(
      '<html><body><div class="product-card">1</div><div class="product-card">2</div><div class="product-card">3</div></body></html>',
    );
    expect(detectPageType("https://x.com/listing", $, [], {}, false)).toBe(
      "category",
    );
  });

  it("detects a category page from pagination + filter signals", () => {
    const $ = parseHtml(
      '<html><body><nav class="pagination"></nav><div class="filter"></div></body></html>',
    );
    expect(detectPageType("https://x.com/list-page", $, [], {}, false)).toBe(
      "category",
    );
  });

  it("falls back to content when nothing matches", () => {
    const $ = parseHtml("<html><body><p>just words</p></body></html>");
    expect(detectPageType("https://x.com/random-page", $, [], {}, false)).toBe(
      "content",
    );
  });

  it("matches JSON-LD types nested in @graph and as arrays", () => {
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [{ "@graph": [{ "@type": "Product" }] }],
        {},
        false,
      ),
    ).toBe("product");
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [{ "@type": ["Thing", "Product"] }],
        {},
        false,
      ),
    ).toBe("product");
    expect(
      detectPageType(
        "https://x.com/foo",
        $empty,
        [{ "@graph": [{ "@type": ["X", "CollectionPage"] }] }],
        {},
        false,
      ),
    ).toBe("category");
  });

  it("ignores non-object @graph members and unmatched types", () => {
    expect(
      detectPageType(
        "https://x.com/random",
        $empty,
        [
          { "@graph": ["primitive", null, { "@type": "WebPage" }] },
          { "@type": "WebSite" },
        ],
        {},
        false,
      ),
    ).toBe("content");
  });
});

// ---------------------------------------------------------------------------
// Value-rule and attribute-absent edge branches
// ---------------------------------------------------------------------------

describe("parser — value-rule and attribute-absent branches", () => {
  it("microdata: property value fallbacks when source attributes are absent", () => {
    const html = `<html><body>
      <div itemscope itemtype="https://schema.org/Thing">
        <meta itemprop="m1" content="">
        <meta itemprop="m2">
        <a itemprop="link"></a>
        <img itemprop="img">
        <object itemprop="obj"></object>
        <data itemprop="d"></data>
        <span itemprop="rep">1</span>
        <span itemprop="rep">2</span>
        <span itemprop="rep">3</span>
      </div>
    </body></html>`;
    const $ = parseHtml(html);
    const item = (extractMicrodata($) as Record<string, unknown>[])[0]!;
    expect(item["m1"]).toBe("");
    expect(item["m2"]).toBe("");
    expect(item["link"]).toBe("");
    expect(item["img"]).toBe("");
    expect(item["obj"]).toBe("");
    expect(item["d"]).toBe("");
    // Third repeat pushes onto the existing array.
    expect(item["rep"]).toEqual(["1", "2", "3"]);
  });

  it("microdata: an itemtype made only of separators falls back to the raw term", () => {
    const $ = parseHtml(
      '<html><body><div itemscope itemtype=":::"></div></body></html>',
    );
    const item = (extractMicrodata($) as Record<string, unknown>[])[0]!;
    expect(item["@type"]).toBe(":::");
  });

  it("rdfa: property names that are blank or prefix-only", () => {
    const html = `<html><body>
      <div typeof="Thing">
        <span property="   ">blank</span>
        <span property=":">colon</span>
      </div>
    </body></html>`;
    const $ = parseHtml(html);
    const item = (extractRdfa($) as Record<string, unknown>[])[0]!;
    // Blank name is dropped; ":" resolves to a ":" key via the term fallback.
    expect(item[":"]).toBe("colon");
  });

  it("extractHeadLinks: handles links missing rel and href attributes", () => {
    const html = `<html><head>
      <link href="/no-rel.css">
      <link rel="canonical">
    </head><body></body></html>`;
    const $ = parseHtml(html);
    const links = extractHeadLinks($);
    // The rel-less link is skipped; canonical with no href kept with href ''.
    expect(links).toEqual([
      { rel: "canonical", type: "", href: "", title: "" },
    ]);
  });

  it("extractForms: input with an id but no matching label, and without a name", () => {
    const html = `<html><body>
      <form action="/f"><input id="orphan" type="text"></form>
    </body></html>`;
    const $ = parseHtml(html);
    const forms = extractForms($);
    expect(forms[0].inputs[0].label).toBeUndefined();
    expect(forms[0].inputs[0].name).toBe("");
  });

  it("extractInternalLinks: skips anchors whose href attribute is empty", () => {
    const html = `<html><body><a href="">empty</a><a href="/ok">ok</a></body></html>`;
    const $ = parseHtml(html);
    expect(extractInternalLinks($, "example.com")).toEqual([
      "https://example.com/ok",
    ]);
  });

  it("extractNavLinks: skips nav anchors whose href attribute is empty", () => {
    const html = `<html><body><nav><a href="">empty</a><a href="/ok">ok</a></nav></body></html>`;
    const $ = parseHtml(html);
    expect(extractNavLinks($)).toEqual(["/ok"]);
  });
});
