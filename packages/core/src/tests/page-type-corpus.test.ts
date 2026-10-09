import { describe, expect, it } from "vitest";
import {
  classifyPage,
  extractJsonLd,
  extractMetaTags,
  extractMicrodata,
  extractRdfa,
  parseHtml,
} from "#core/parser";
import { listFixtures, readFixture } from "./fixture-io";
import { readPageTypeLabels, requestedUrl } from "./page-type-labels";

/**
 * The classifier against pages a person has labelled.
 *
 * The verdict snapshot in `real-page-corpus.test.ts` records whatever the
 * classifier said; this suite says what it should have said. Each label
 * comes from reading the page, and `page-types.json` names the shape it
 * covers. A miss here is a page type the scan gets wrong on a real site.
 */
const labels = readPageTypeLabels();
const fixtures = new Set(listFixtures());

describe("page-type corpus", () => {
  it("labels only fixtures that exist", () => {
    expect(Object.keys(labels).filter((name) => !fixtures.has(name))).toEqual(
      [],
    );
  });

  for (const [name, label] of Object.entries(labels)) {
    it(`${name} reads as ${label.expected}`, () => {
      const { html, provenance } = readFixture(name);
      const $ = parseHtml(html);
      const structuredData = [
        ...extractJsonLd($),
        ...extractMicrodata($),
        ...extractRdfa($),
      ];
      const classification = classifyPage(
        requestedUrl(provenance),
        $,
        structuredData,
        extractMetaTags($),
      );
      expect(
        classification.type,
        `${label.why} Signals: ${classification.signals.join(", ") || "none"}`,
      ).toBe(label.expected);
    });
  }
});
