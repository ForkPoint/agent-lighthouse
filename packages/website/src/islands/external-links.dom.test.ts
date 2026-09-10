// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mountExternalLinks } from "./external-links";

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("external links", () => {
  it("opens external HTTP links safely and preserves existing descriptions", () => {
    document.body.innerHTML =
      '<a href="https://example.org/proof" rel="nofollow" aria-describedby="proof">Proof</a>';
    cleanup = mountExternalLinks();
    const link = document.querySelector("a")!;
    expect(link.target).toBe("_blank");
    expect([...link.relList]).toEqual(["nofollow", "noopener", "noreferrer"]);
    expect(link.getAttribute("aria-describedby")).toBe(
      "proof external-link-hint",
    );
    expect(link.title).toBe("Opens in a new tab");
  });
  it("leaves internal, fragment, email and download links alone", () => {
    document.body.innerHTML =
      '<a href="/docs/">Docs</a><a href="#history">History</a><a href="mailto:a@example.org">Email</a><a href="blob:local" download>Report</a>';
    cleanup = mountExternalLinks();
    for (const link of document.querySelectorAll("a"))
      expect(link.hasAttribute("target")).toBe(false);
  });
  it("handles links added by tools and restores internal navigation after an href change", async () => {
    document.body.innerHTML = "";
    cleanup = mountExternalLinks();
    const link = document.createElement("a");
    link.href = "https://example.org";
    document.body.append(link);
    await settle();
    expect(link.target).toBe("_blank");
    link.href = "/docs/";
    await settle();
    expect(link.hasAttribute("target")).toBe(false);
    expect(link.hasAttribute("aria-describedby")).toBe(false);
    expect(link.hasAttribute("title")).toBe(false);
  });
});
