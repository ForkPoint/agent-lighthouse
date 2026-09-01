// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  mountBadgeGenerator,
  badgeMarkdown,
  BADGE_BANDS,
} from "./badge-generator";

/**
 * The interaction layer, against a fixture that mirrors what `pages/index.astro`
 * renders: the two fields, the preview slot, the snippet the build already
 * filled in, and the Copy button that ships hidden.
 *
 * jsdom is confined to this file — the bands and the markdown are pure and are
 * tested without a DOM in `badge-generator.test.ts`.
 */
const fixture = () => `
  <div>
    <label for="badge-score">Score</label>
    <input id="badge-score" type="number" min="0" max="100" value="87" />
    <label for="badge-url">Scanned URL</label>
    <input id="badge-url" type="url" value="https://example.com" />
    <div id="badge-preview"></div>
    <button type="button" id="badge-copy" hidden>Copy</button>
    <p id="badge-copy-status" aria-live="polite"></p>
    <pre id="badge-markdown"></pre>
  </div>
`;

const el = <T extends HTMLElement>(selector: string): T =>
  document.querySelector<T>(selector) as T;

const type = (selector: string, value: string) => {
  const input = el<HTMLInputElement>(selector);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

beforeEach(() => {
  document.body.innerHTML = fixture();
  // The snippet is written as text, which is what Astro emits for
  // `<pre>{badgeMarkdown(…)}</pre>`: it escapes the expression, so the
  // `<!-- Scanned: … -->` line reaches the page as characters. Putting the same
  // string through `innerHTML` here would instead hand it to the HTML parser,
  // which would swallow that line into a comment node — a difference that would
  // make this fixture test something the site never renders.
  el("#badge-markdown").textContent = badgeMarkdown(87, "https://example.com");
});

describe("mountBadgeGenerator", () => {
  it("renders the preview the build could not, and leaves the snippet as it was", () => {
    const before = el("#badge-markdown").textContent;
    mountBadgeGenerator();

    // The server already wrote a correct snippet, so mounting must not change
    // what a reader had in front of them a moment ago.
    expect(el("#badge-markdown").textContent).toBe(before);
    const image = el<HTMLImageElement>("#badge-preview img");
    expect(image.src).toContain("Agent%20Lighthouse-87%2F100-4f46e5");
    expect(image.alt).toBe("Agent Lighthouse 87/100 badge");
  });

  it("follows the score across every band", () => {
    mountBadgeGenerator();
    for (const band of BADGE_BANDS) {
      type("#badge-score", String(band.min));
      expect(el("#badge-markdown").textContent).toContain(
        `${band.min}%2F100-${band.color}`,
      );
    }
  });

  it("holds a typed score to 0–100 instead of putting it in a URL", () => {
    mountBadgeGenerator();

    type("#badge-score", "10000");
    expect(el("#badge-markdown").textContent).toContain("-100%2F100-22c55e");

    type("#badge-score", "-40");
    expect(el("#badge-markdown").textContent).toContain("-0%2F100-ef4444");

    type("#badge-score", "");
    expect(el("#badge-markdown").textContent).toContain("-0%2F100-ef4444");
  });

  it("writes the typed URL as text, never as markup", () => {
    mountBadgeGenerator();
    type("#badge-url", '"><img src=x onerror=alert(1)>');

    const snippet = el("#badge-markdown");
    expect(snippet.querySelector("img")).toBeNull();
    // Angle brackets are dropped so the URL cannot close the comment it sits in;
    // what is left is text in a text node, so nothing parses it as markup.
    expect(snippet.textContent).toContain('"img src=x onerror=alert(1)');
    expect(snippet.innerHTML).not.toContain("<img");
    // The badge itself never carries the URL, so the preview cannot be steered.
    expect(el<HTMLImageElement>("#badge-preview img").src).toMatch(
      /^https:\/\/img\.shields\.io\/badge\/Agent%20Lighthouse-\d+%2F100-[0-9a-f]{6}$/,
    );
  });

  it("reveals the Copy button only once it is wired up", () => {
    expect(el<HTMLButtonElement>("#badge-copy").hidden).toBe(true);
    mountBadgeGenerator();
    expect(el<HTMLButtonElement>("#badge-copy").hidden).toBe(false);
  });

  it("says so rather than throwing when the clipboard is unavailable", () => {
    mountBadgeGenerator();
    // jsdom exposes no `navigator.clipboard`, which is also what a browser does
    // outside a secure context.
    expect(navigator.clipboard).toBeUndefined();
    expect(() => el<HTMLButtonElement>("#badge-copy").click()).not.toThrow();
  });

  it("does nothing at all on a page without the panel", () => {
    document.body.innerHTML = "<p>No generator here.</p>";
    expect(() => mountBadgeGenerator()).not.toThrow();
  });
});
