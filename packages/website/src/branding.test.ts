import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const dist = resolve("packages/website/dist");
const built = existsSync(resolve(dist, "index.html"));

describe.skipIf(!built)("published branding", () => {
  it("uses approved light and dark header logos and links the brand page", () => {
    const html = readFileSync(resolve(dist, "index.html"), "utf8");
    for (const name of ["light", "dark"]) {
      expect(html).toContain(
        `/agent-lighthouse/brand/kit/svg/rectangle-${name}-transparent.svg`,
      );
    }
    expect(html).toContain('href="/agent-lighthouse/branding/"');
    expect(html).toContain("/agent-lighthouse/brand/kit/icons/favicon.svg");
    expect(html).toContain("/agent-lighthouse/brand/kit/icons/icon-180.png");
    expect(html).not.toContain('href="/agent-lighthouse/og-image.svg"');
  });

  it("publishes the kit and every local image or download linked from its page", () => {
    const html = readFileSync(resolve(dist, "branding/index.html"), "utf8");
    expect(html).toContain("Download the brand kit");
    const paths = [
      ...html.matchAll(/(?:src|href)="\/agent-lighthouse\/(brand\/[^"]+)"/g),
    ];
    expect(paths.length).toBeGreaterThan(10);
    for (const [, path] of paths)
      expect(existsSync(resolve(dist, path!)), path).toBe(true);
  });
});

it("uses the white-background README logo regardless of the browser theme", () => {
  const readme = readFileSync("README.md", "utf8");
  const document = new JSDOM(readme).window.document;
  const logo = document.querySelector("h1 img");

  expect(logo?.getAttribute("src")).toBe(
    "packages/website/public/brand/kit/svg/rectangle-light.svg",
  );
  expect(logo?.getAttribute("alt")).toBe("Agent Lighthouse");
  expect(document.querySelector("picture, source")).toBeNull();
});
