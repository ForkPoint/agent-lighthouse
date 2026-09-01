import { describe, it, expect } from "vitest";
import { excerptSegments, resultHref, searchShortcut } from "./search";

// `target` is widened off `KeyboardEvent` before it is re-added: intersecting
// with `{ target?: unknown }` does not loosen the `EventTarget | null` already
// there, and `astro check` rejects the stand-in targets below without this.
const event = (
  over: Omit<Partial<KeyboardEvent>, "target"> & { target?: unknown },
) =>
  ({
    key: "/",
    metaKey: false,
    ctrlKey: false,
    target: { tagName: "BODY" },
    ...over,
  }) as unknown as KeyboardEvent;

describe("searchShortcut", () => {
  it("opens on slash outside an input", () => {
    expect(searchShortcut(event({}))).toBe(true);
  });

  it("ignores slash typed into an input", () => {
    expect(searchShortcut(event({ target: { tagName: "INPUT" } }))).toBe(false);
  });

  it("opens on cmd-k and ctrl-k", () => {
    expect(searchShortcut(event({ key: "k", metaKey: true }))).toBe(true);
    expect(searchShortcut(event({ key: "k", ctrlKey: true }))).toBe(true);
  });

  it("ignores every other key", () => {
    expect(searchShortcut(event({ key: "a" }))).toBe(false);
  });
});

describe("searchShortcut, on the cases the brief does not name", () => {
  it("opens from inside a field on the chord, where a slash would not", () => {
    expect(
      searchShortcut(
        event({ key: "k", metaKey: true, target: { tagName: "INPUT" } }),
      ),
    ).toBe(true);
    expect(searchShortcut(event({ target: { tagName: "TEXTAREA" } }))).toBe(
      false,
    );
  });

  it("leaves a contenteditable alone", () => {
    expect(
      searchShortcut(
        event({ target: { tagName: "DIV", isContentEditable: true } }),
      ),
    ).toBe(false);
    expect(
      searchShortcut(
        event({ target: { tagName: "DIV", isContentEditable: false } }),
      ),
    ).toBe(true);
  });

  it("ignores a slash the reader is combining with a modifier", () => {
    // `⌘/` and `Ctrl+/` belong to the browser and to comment shortcuts.
    expect(searchShortcut(event({ metaKey: true }))).toBe(false);
    expect(searchShortcut(event({ ctrlKey: true }))).toBe(false);
  });

  it("accepts the chord with either case of k, as a held shift produces", () => {
    expect(searchShortcut(event({ key: "K", metaKey: true }))).toBe(true);
  });
});

describe("excerptSegments", () => {
  it("splits an excerpt into its plain and marked runs", () => {
    expect(excerptSegments("the <mark>llms.txt</mark> file")).toEqual([
      { text: "the ", mark: false },
      { text: "llms.txt", mark: true },
      { text: " file", mark: false },
    ]);
  });

  it("keeps every mark, not just the first", () => {
    const segments = excerptSegments("<mark>a</mark> and <mark>b</mark>");
    expect(
      segments.filter((segment) => segment.mark).map((segment) => segment.text),
    ).toEqual(["a", "b"]);
  });

  it("returns one plain run for an excerpt with no match in it", () => {
    expect(excerptSegments("nothing marked here")).toEqual([
      { text: "nothing marked here", mark: false },
    ]);
  });

  it("drops every tag but the marks, so no markup can survive into the DOM", () => {
    // Whatever the excerpt carries, the caller only ever gets text to put in a
    // text node — there is no path from this string to parsed markup.
    const segments = excerptSegments(
      "a <img src=x onerror=alert(1)> <mark>b<script>evil()</script></mark>",
    );

    expect(segments.some((segment) => segment.text.includes("<"))).toBe(false);
    expect(segments).toEqual([
      { text: "a  ", mark: false },
      { text: "bevil()", mark: true },
    ]);
  });

  it("decodes the references Pagefind escapes its text with", () => {
    expect(
      excerptSegments(
        "&lt;head&gt; &amp; &quot;body&quot; &#39;x&#39; &#x2014;",
      ),
    ).toEqual([{ text: "<head> & \"body\" 'x' —", mark: false }]);
  });

  it("leaves an unknown reference exactly as it found it", () => {
    expect(excerptSegments("R&amp;D &notareference; &#999999999;")).toEqual([
      { text: "R&D &notareference; &#999999999;", mark: false },
    ]);
  });

  it("emits nothing for an empty excerpt rather than an empty segment", () => {
    expect(excerptSegments("")).toEqual([]);
    expect(excerptSegments("<mark></mark>")).toEqual([]);
  });
});

describe("resultHref", () => {
  it("puts Pagefind’s site-absolute url under the base path", () => {
    // Pagefind records paths relative to `dist/`, which has no base path in it.
    expect(
      resultHref("/audits/agentic-commerce/offer-truth-consistency/"),
    ).toBe(
      "/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/",
    );
  });

  it("does not prefix a url that is already based", () => {
    expect(resultHref("/agent-lighthouse/docs/quickstart/")).toBe(
      "/agent-lighthouse/docs/quickstart/",
    );
  });
});
