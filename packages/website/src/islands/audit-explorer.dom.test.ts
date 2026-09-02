// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountExplorer } from "./audit-explorer";

/**
 * The interaction layer, against a fixture that mirrors what
 * `pages/audits/index.astro` renders: hidden controls, a live count, an
 * empty-state paragraph, and cards carrying their own facets.
 *
 * jsdom is confined to this file — `filterAudits` is pure and is tested without
 * a DOM in `audit-explorer.test.ts`.
 */
const CARDS = [
  {
    id: "agentic-commerce/offer-truth-consistency",
    category: "agentic-commerce",
    tier: "scored",
    title: "Offer Truth Consistency",
    tags: "price offer",
  },
  {
    id: "access-crawl-control/robots-directives",
    category: "access-crawl-control",
    tier: "informative",
    title: "Robots Directives",
    tags: "robots",
  },
  {
    id: "access-crawl-control/llms-txt",
    category: "access-crawl-control",
    tier: "experimental",
    title: "LLMs Txt",
    tags: "",
  },
];

const fixture = () => `
  <section id="audit-controls" hidden>
    <label for="audit-search">Search audits</label>
    <input id="audit-search" type="search" />
    <button type="button" data-filter="category" data-value="all" aria-pressed="true">All categories</button>
    <button type="button" data-filter="category" data-value="access-crawl-control" aria-pressed="false">Access</button>
    <button type="button" data-filter="tier" data-value="all" aria-pressed="true">All tiers</button>
    <button type="button" data-filter="tier" data-value="informative" aria-pressed="false">Advisory</button>
  </section>
  <p aria-live="polite">Showing <span id="audit-count">${CARDS.length}</span> of ${CARDS.length} audits</p>
  <ul>
    ${CARDS.map(
      (card) => `
      <li data-audit-id="${card.id}" data-category="${card.category}" data-tier="${card.tier}" data-tags="${card.tags}">
        <code>${card.id}</code><h2><a href="#">${card.title}</a></h2><p>A description of ${card.title}.</p>
      </li>`,
    ).join("")}
  </ul>
  <p id="audit-empty" hidden>No audits match your search.</p>
`;

const visible = () =>
  [...document.querySelectorAll<HTMLElement>("[data-audit-id]")]
    .filter((card) => !card.hidden)
    .map((card) => card.dataset["auditId"]);

const count = () => document.querySelector("#audit-count")!.textContent;
const pill = (kind: string, value: string) =>
  document.querySelector<HTMLElement>(
    `[data-filter="${kind}"][data-value="${value}"]`,
  )!;
const search = () => document.querySelector<HTMLInputElement>("#audit-search")!;

const type = (text: string) => {
  search().value = text;
  search().dispatchEvent(new Event("input", { bubbles: true }));
};

describe("mountExplorer", () => {
  beforeEach(() => {
    document.body.innerHTML = fixture();
    mountExplorer();
  });

  it("reveals the controls it has just wired up", () => {
    expect(document.querySelector<HTMLElement>("#audit-controls")!.hidden).toBe(
      false,
    );
  });

  it("starts with every card shown and the count agreeing", () => {
    expect(visible()).toHaveLength(3);
    expect(count()).toBe("3");
  });

  it("hides the cards a search does not match, and counts what is left", () => {
    type("robots");

    expect(visible()).toEqual(["access-crawl-control/robots-directives"]);
    expect(count()).toBe("1");
    // Hidden, not merely unstyled: `hidden` takes the card out of the a11y tree.
    const gone = document.querySelector<HTMLElement>(
      '[data-audit-id="agentic-commerce/offer-truth-consistency"]',
    )!;
    expect(gone.hidden).toBe(true);
  });

  it("searches the tags a card carries but does not print", () => {
    type("price");

    expect(visible()).toEqual(["agentic-commerce/offer-truth-consistency"]);
  });

  it("moves the pressed state to the clicked pill and off its siblings", () => {
    pill("category", "access-crawl-control").click();

    expect(
      pill("category", "access-crawl-control").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(pill("category", "all").getAttribute("aria-pressed")).toBe("false");
    // The other group is untouched.
    expect(pill("tier", "all").getAttribute("aria-pressed")).toBe("true");
    expect(visible()).toEqual([
      "access-crawl-control/robots-directives",
      "access-crawl-control/llms-txt",
    ]);
    expect(count()).toBe("2");
  });

  it("combines the two filter groups with the search box", () => {
    pill("category", "access-crawl-control").click();
    pill("tier", "informative").click();

    expect(visible()).toEqual(["access-crawl-control/robots-directives"]);

    type("llms");
    expect(visible()).toEqual([]);
    expect(count()).toBe("0");
  });

  it("shows the empty state only while nothing matches", () => {
    const empty = () =>
      document.querySelector<HTMLElement>("#audit-empty")!.hidden;
    expect(empty()).toBe(true);

    type("nothing-matches-this");
    expect(empty()).toBe(false);

    type("");
    expect(empty()).toBe(true);
    expect(count()).toBe("3");
  });
});
