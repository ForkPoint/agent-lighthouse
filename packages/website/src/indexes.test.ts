import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { auditList, categoryList } from "./lib/registry";
import { auditPath, categoryPath } from "./lib/routes";

const DIST = resolve(__dirname, "../dist");

const page = (relative: string) =>
  readFileSync(resolve(DIST, relative, "index.html"), "utf8");

/** The audit ids a page renders a card for, in document order. */
const cardIds = (html: string) =>
  [...html.matchAll(/data-audit-id="([^"]+)"/g)].map((m) => m[1]!);

/** Every heading on a page, in document order, as depths. */
const headingDepths = (html: string) =>
  [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));

/** The `id` an element's `aria-labelledby` points at, if it has one. */
const labelledBy = (tag: string) => /aria-labelledby="([^"]+)"/.exec(tag)?.[1];

/**
 * These assert against `dist/` for the reason `layouts/chrome.test.ts` records:
 * `experimental_AstroContainer` needs Vite 8 and Vitest pins Vite 5, so a page
 * cannot be rendered in-process here. They are skipped on a checkout that has
 * never been built, and the build gate produces what they read.
 */
const built = existsSync(resolve(DIST, "audits"));

describe.skipIf(!built)("rendered /audits/", () => {
  it("renders a card for every audit, linking to its dossier", () => {
    const html = page("audits");
    const audits = auditList();

    expect(cardIds(html)).toEqual(audits.map((audit) => audit.id));
    for (const audit of audits) {
      expect(html, audit.id).toContain(`href="${auditPath(audit.id)}"`);
    }
  });

  it("gives the page one h1 and the search box a label", () => {
    const html = page("audits");

    expect(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/<label[^>]*for="audit-search"/);
    expect(html).toMatch(/<input[^>]*id="audit-search"/);
  });

  it("announces the result count from a live region", () => {
    const html = page("audits");
    // Every page now carries a second polite region — the search dialog's status
    // line, in the header — so this looks for the one that holds the count
    // rather than for the first one on the page. Two live regions coexist here
    // because only one is ever in the accessibility tree: the dialog's sits
    // inside a closed `<dialog>`, which is `display: none` until it is opened.
    const regions = [
      ...html.matchAll(
        /<[a-z]+[^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/[a-z]+>/g,
      ),
    ].map((match) => match[0]);
    const region = regions.find((candidate) =>
      candidate.includes('id="audit-count"'),
    );

    expect(region, "no polite live region holds the count").toBeDefined();
    // The server-rendered count is the unfiltered total, which is what a reader
    // with JavaScript off sees below it.
    expect(region).toContain(String(auditList().length));
  });

  it("offers one pressed pill per filter group, over every category and tier", () => {
    const html = page("audits");
    const pills = (kind: string) =>
      [
        ...html.matchAll(
          new RegExp(`<button[^>]*data-filter="${kind}"[^>]*>`, "g"),
        ),
      ].map((m) => m[0]);
    const values = (kind: string) =>
      pills(kind).map((pill) => /data-value="([^"]+)"/.exec(pill)?.[1]);

    expect(values("category")).toEqual([
      "all",
      ...categoryList().map((category) => category.id),
    ]);
    expect(values("tier")).toEqual([
      "all",
      "scored",
      "informative",
      "experimental",
    ]);
    for (const kind of ["category", "tier"]) {
      // Every pill carries a pressed state, and exactly one starts pressed.
      expect(pills(kind).every((pill) => pill.includes("aria-pressed="))).toBe(
        true,
      );
      expect(
        pills(kind).filter((pill) => pill.includes('aria-pressed="true"')),
      ).toHaveLength(1);
    }
  });

  it("keeps the registry out of the browser bundle", () => {
    const html = page("audits");
    // Astro inlines a script this small rather than emitting a file, so read
    // both forms: whichever the bundler chose is what the browser executes.
    const inline = [
      ...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g),
    ].map((m) => ["inline", m[1]!] as const);
    const external = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(
      (m) =>
        [
          m[1]!,
          readFileSync(
            resolve(DIST, m[1]!.replace("/agent-lighthouse/", "")),
            "utf8",
          ),
        ] as const,
    );
    const scripts = [...inline, ...external];

    expect(scripts.length, "the explorer ships no script").toBeGreaterThan(0);
    // The explorer is in there — otherwise the assertions below prove nothing.
    expect(scripts.some(([, code]) => code.includes("#audit-search"))).toBe(
      true,
    );
    for (const [where, code] of scripts) {
      expect(code, `${where} reaches for core`).not.toContain(
        "@forkpoint/agent-lighthouse-core",
      );
      expect(code, `${where} reaches for the registry`).not.toContain(
        "defaultConfig",
      );
    }
  });

  it("carries each card\u2019s facets on the card, not in a second copy of the registry", () => {
    const html = page("audits");
    const cards = [
      ...html.matchAll(/<li[^>]*data-audit-id="[^"]*"[^>]*>/g),
    ].map((m) => m[0]);
    const byId = new Map(auditList().map((audit) => [audit.id, audit]));

    expect(cards).toHaveLength(byId.size);
    for (const card of cards) {
      const id = /data-audit-id="([^"]+)"/.exec(card)![1]!;
      const audit = byId.get(id)!;
      expect(card, id).toContain(`data-category="${audit.category}"`);
      expect(card, id).toContain(`data-tier="${audit.tier}"`);
    }
    // The explorer reads those attributes and the card text. A serialized copy
    // of the registry in the page would be the same text twice.
    expect(html, "the page ships a serialized data blob").not.toMatch(
      /<script[^>]*type="application\/json"/,
    );
  });

  it("nests its headings without skipping a level, and names the list", () => {
    const html = page("audits");
    const depths = headingDepths(html);

    expect(depths[0]).toBe(1);
    for (const [index, depth] of depths.entries()) {
      const previous = depths[index - 1] ?? depth;
      expect(
        depth - previous,
        `heading ${index} jumps from h${previous} to h${depth}`,
      ).toBeLessThanOrEqual(1);
    }

    const list = /<ul[^>]*aria-labelledby="[^"]+"[^>]*>/.exec(html)?.[0];
    expect(list, "the card list has no accessible name").toBeDefined();
    expect(html).toContain(`id="${labelledBy(list!)}"`);
  });
});

describe.skipIf(!built)("rendered category indexes", () => {
  const categories = categoryList();

  it("publishes one page per category and nothing else", () => {
    const dirs = readdirSync(resolve(DIST, "categories"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(dirs.sort()).toEqual(
      categories.map((category) => category.id).sort(),
    );
  });

  it("lists exactly its own audits, in registry order", () => {
    const audits = auditList();
    for (const category of categories) {
      const html = page(`categories/${category.id}`);
      const own = audits
        .filter((audit) => audit.category === category.id)
        .map((a) => a.id);

      expect(own.length, category.id).toBe(category.count);
      expect(cardIds(html), category.id).toEqual(own);
    }
  });

  it("titles each page with its category and links back to every other", () => {
    for (const category of categories) {
      const html = page(`categories/${category.id}`);

      expect(html.match(/<h1[\s>]/g) ?? [], category.id).toHaveLength(1);
      // `&` in a category name arrives escaped, as it must.
      const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1];
      expect(heading, category.id).toBe(category.name.replace(/&/g, "&amp;"));
      for (const other of categories) {
        expect(html, `${category.id} → ${other.id}`).toContain(
          `href="${categoryPath(other.id)}"`,
        );
      }
    }
  });

  it("nests its headings without skipping a level, and names the list", () => {
    for (const category of categories) {
      const html = page(`categories/${category.id}`);
      const depths = headingDepths(html);

      expect(depths[0], category.id).toBe(1);
      for (const [index, depth] of depths.entries()) {
        const previous = depths[index - 1] ?? depth;
        expect(
          depth - previous,
          `${category.id}: h${previous} \u2192 h${depth}`,
        ).toBeLessThanOrEqual(1);
      }

      const list = /<ul[^>]*aria-labelledby="[^"]+"[^>]*>/.exec(html)?.[0];
      expect(
        list,
        `${category.id}: the card list has no accessible name`,
      ).toBeDefined();
      expect(html, category.id).toContain(`id="${labelledBy(list!)}"`);
    }
  });
});
