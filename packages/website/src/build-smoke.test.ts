import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { auditList } from "./lib/registry";
import { withBase } from "./lib/routes";

const DIST = resolve(__dirname, "../dist");
const built = existsSync(DIST);

// The suite skips when `dist` is absent, so `pnpm test` on a fresh clone stays
// green. CI builds the whole workspace before it tests, so it runs there.
describe.skipIf(!built)("built site", () => {
  it("emits one page per audit", () => {
    const pages = readdirSync(resolve(DIST, "audits"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => readdirSync(resolve(DIST, "audits", entry.name)));
    expect(pages.length).toBe(auditList().length);
  });

  it("renders a known dossier as the public page contract, not as the working record", () => {
    const page = readFileSync(
      resolve(
        DIST,
        "audits/agentic-commerce/offer-truth-consistency/index.html",
      ),
      "utf8",
    );
    expect(page).toContain("Why it matters");
    expect(page).toContain("Evidence");
    // The whitelist withholds the build record. If this starts appearing, the
    // slice in `content.config.ts` has stopped being applied to the collection.
    expect(page).not.toContain("Code review findings");
    expect(page).not.toContain("Review history");
    expect(page).not.toContain("policy.md");
  });

  describe("the at-a-glance card", () => {
    const page = () =>
      readFileSync(
        resolve(
          DIST,
          "audits/content-extraction/markdown-alternate/index.html",
        ),
        "utf8",
      );

    it("prints the registry facts for the audit it names", () => {
      const audit = auditList().find(
        (entry) => entry.id === "content-extraction/markdown-alternate",
      )!;
      const card =
        /<aside[^>]*aria-labelledby="audit-facts-heading"[\s\S]*?<\/aside>/.exec(
          page(),
        )?.[0];
      expect(card, "no card in the right rail").toBeTruthy();
      expect(card).toContain("At a glance");
      expect(card).toContain(audit.categoryTitle);
      expect(card).toContain(`Grade ${audit.evidenceGrade}`);
      expect(card).toContain("Scored");
      expect(card).toContain(`>${audit.weight}`);
      expect(card).toContain(audit.priority);
      expect(card).toContain("/blob/main/");
    });

    // The card renders twice — the rail and the compact disclosure — and an id
    // may be owned by one element only.
    it("gives the compact copy its own heading id", () => {
      const html = page();
      const ids = [...html.matchAll(/id="(audit-facts-heading[^"]*)"/g)].map(
        (m) => m[1],
      );
      expect(ids).toEqual([
        "audit-facts-heading-compact",
        "audit-facts-heading",
      ]);
    });

    // The reasoning is an argument, not a field: it stays where it can be read.
    it("leaves the grade reasoning in the article", () => {
      expect(page()).toContain("How it scores");
    });
  });

  /**
   * GitHub Pages serves `404.html` from the site root for anything it cannot
   * match. Every HTML report this tool writes carries 215 `evidenceUrl`
   * addresses, so a stale one has to land somewhere navigable rather than on
   * GitHub's generic page.
   */
  it("publishes a 404 page with the site chrome", () => {
    expect(
      existsSync(resolve(DIST, "404.html")),
      "GitHub Pages needs dist/404.html",
    ).toBe(true);
    const html = readFileSync(resolve(DIST, "404.html"), "utf8");

    expect(html).toContain("<title>Page not found</title>");
    // The same chrome as every other page: skip link, header nav, search, footer.
    expect(html).toContain('href="#main"');
    expect(html).toContain('aria-label="Main"');
    expect(html).toContain('id="search-trigger"');
    expect(html).toMatch(/<footer[\s>]/);
    // The two routes it offers by hand, both through the base path.
    expect(html).toContain(`href="${withBase("audits/")}"`);
    expect(html).toContain(`href="${withBase("")}"`);
  });

  it("ships a search index", () => {
    expect(existsSync(resolve(DIST, "pagefind"))).toBe(true);
  });

  // The v1 site shipped `audits-data.json` as a checked-in file and the explorer
  // fetched it. That file is gone; the build now emits the same path from the
  // live registry, so the address anything already fetching it uses still works.
  it("still publishes the audits-data.json endpoint", () => {
    const records = JSON.parse(
      readFileSync(resolve(DIST, "audits-data.json"), "utf8"),
    );
    expect(records).toHaveLength(auditList().length);
    expect(records[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        tier: expect.any(String),
      }),
    );
  });
});
