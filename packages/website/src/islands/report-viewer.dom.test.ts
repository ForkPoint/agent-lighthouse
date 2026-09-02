// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountReportViewer, MAX_REPORT_BYTES } from "./report-viewer";

/**
 * The interaction layer, against a fixture that mirrors what `pages/index.astro`
 * renders: a drop target wrapping a real file input, a live status line, and a
 * hidden output panel.
 *
 * The file is the whole threat model here — it is chosen by the visitor and can
 * hold anything — so most of these are about what a hostile or broken file
 * does to the page. jsdom is confined to this file; `summarize` is pure and is
 * tested without a DOM in `report-viewer.test.ts`.
 */
const fixture = `
  <section>
    <div id="report-dropzone" class="border-dashed border-border-subtle">
      <label for="report-file">Report JSON</label>
      <input id="report-file" type="file" accept="application/json,.json" />
    </div>
    <p id="report-status" aria-live="polite"></p>
    <div id="report-output" hidden></div>
  </section>
`;

const el = <T extends HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector) as T;

const status = () => el("#report-status").textContent ?? "";
const output = () => el("#report-output");

/** A `File` the input will hand back, since jsdom has no file picker. */
function jsonFile(body: string, name = "agent-lighthouse-report.json"): File {
  return new File([body], name, { type: "application/json" });
}

/** Choose a file, the way a keyboard user does: through the input itself. */
async function choose(file: File): Promise<void> {
  const input = el<HTMLInputElement>("#report-file");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  // One tick for `File.text()` and one for the `readReport` continuation.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Drop a file on the zone. jsdom has no `DataTransfer`, so this stands in. */
async function drop(file: File): Promise<Event> {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
  el("#report-dropzone").dispatchEvent(event);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return event;
}

const REPORT = {
  url: "https://example.com/",
  overallScore: 74,
  scoreTier: "partially-ready",
  categories: [{ name: "AI Discovery", score: 91, checks: [{ id: "a" }] }],
  pagesScanned: [{ url: "https://example.com/", pageType: "home" }],
  durationMs: 4200,
};

beforeEach(() => {
  document.body.innerHTML = fixture;
  mountReportViewer();
});

describe("mountReportViewer", () => {
  it("renders a chosen report and announces what it is showing", async () => {
    await choose(jsonFile(JSON.stringify(REPORT)));

    expect(output().hidden).toBe(false);
    expect(output().textContent).toContain("https://example.com/");
    expect(output().textContent).toContain("74/100");
    expect(output().textContent).toContain("AI Discovery");
    expect(output().textContent).toContain("91/100");
    expect(output().textContent).toContain("1 audit evaluated");
    expect(output().textContent).toContain("1 page scanned in 4.2s");
    expect(status()).toContain("scored 74 out of 100");
  });

  it("accepts the same file dropped on the zone", async () => {
    const event = await drop(jsonFile(JSON.stringify(REPORT)));

    expect(
      event.defaultPrevented,
      "the browser would navigate away otherwise",
    ).toBe(true);
    expect(output().hidden).toBe(false);
    expect(output().textContent).toContain("74/100");
  });

  it("never lets report text become markup", async () => {
    await choose(
      jsonFile(
        JSON.stringify({
          overallScore: 80,
          url: '<img src=x onerror="alert(1)">',
          categories: [{ name: "<script>alert(1)</script>", score: 10 }],
        }),
      ),
    );

    expect(
      output().querySelector("img"),
      "the report opened an element",
    ).toBeNull();
    expect(output().querySelector("script")).toBeNull();
    // The word is in the serialized markup, but only inside an escaped text
    // node — `&lt;img …&gt;` — never as a tag or an attribute. Asserting the
    // escaped form is the assertion that matters; asserting the substring is
    // absent would pass just as well for a page that dropped the value entirely.
    expect(output().innerHTML).toContain(
      '&lt;img src=x onerror="alert(1)"&gt;',
    );
    expect(output().innerHTML).not.toMatch(/<[a-z]+[^>]*\bonerror=/i);
    // Present, but as characters: the values are shown to the reader verbatim.
    expect(output().textContent).toContain('<img src=x onerror="alert(1)">');
    expect(output().textContent).toContain("<script>alert(1)</script>");
  });

  it("explains a file that is not JSON instead of failing silently", async () => {
    await choose(jsonFile("<html>not a report</html>", "report.html"));

    expect(status()).toContain("not valid JSON");
    expect(output().hidden).toBe(true);
  });

  it("explains JSON that is not a report", async () => {
    await choose(jsonFile('{"hello":"world"}'));

    expect(status()).toContain("overallScore");
    expect(output().hidden).toBe(true);
  });

  it("explains an empty file", async () => {
    await choose(jsonFile(""));

    expect(status()).toContain("not valid JSON");
    expect(output().hidden).toBe(true);
  });

  it("refuses a file far too large to be a report, without reading it", async () => {
    const huge = jsonFile("{}");
    Object.defineProperty(huge, "size", { value: MAX_REPORT_BYTES + 1 });
    await choose(huge);

    expect(status()).toMatch(/MB/);
    expect(output().hidden).toBe(true);
  });

  it("clears a rendered report when the next file is bad", async () => {
    await choose(jsonFile(JSON.stringify(REPORT)));
    expect(output().textContent).toContain("74/100");

    await choose(jsonFile("nonsense"));
    expect(output().hidden).toBe(true);
    expect(output().textContent).toBe("");
  });

  it("says so when a report carries no categories", async () => {
    await choose(jsonFile('{"overallScore":100}'));

    expect(output().hidden).toBe(false);
    expect(output().textContent).toContain("no category scores");
  });

  it("never hides the live region, so an announcement cannot be lost", async () => {
    const region = el("#report-status");
    // `display:none` takes the region out of the accessibility tree; a message
    // written in the same block that reveals it is the announcement WAI warns
    // is missed, because assistive tech was not observing the region yet.
    expect(region.hidden).toBe(false);

    await choose(jsonFile(JSON.stringify(REPORT)));
    expect(region.hidden).toBe(false);

    await choose(jsonFile("nonsense"));
    expect(region.hidden).toBe(false);
    expect(region.textContent).toContain("not valid JSON");
  });

  it("swaps the border colour while a file is over the zone", () => {
    const zone = el("#report-dropzone");
    const over = new Event("dragover", { bubbles: true, cancelable: true });
    zone.dispatchEvent(over);

    expect(
      over.defaultPrevented,
      "the browser would open the file instead",
    ).toBe(true);
    // One border colour at a time: with both classes present, which one paints
    // would come down to the order Tailwind emitted them in.
    expect(zone.classList.contains("border-brand")).toBe(true);
    expect(zone.classList.contains("border-border-subtle")).toBe(false);

    zone.dispatchEvent(new Event("dragleave"));
    expect(zone.classList.contains("border-brand")).toBe(false);
    expect(zone.classList.contains("border-border-subtle")).toBe(true);
  });

  it("does nothing at all on a page without the panel", () => {
    document.body.innerHTML = "<p>No viewer here.</p>";
    expect(() => mountReportViewer()).not.toThrow();
  });
});
