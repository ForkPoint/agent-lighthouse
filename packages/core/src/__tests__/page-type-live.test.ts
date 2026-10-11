import { describe, expect, it } from "vitest";
import { createFetcher } from "#core/fetcher";
import {
  classifyPage,
  extractJsonLd,
  extractMetaTags,
  extractMicrodata,
  extractRdfa,
  parseHtml,
} from "#core/parser";
import { readFixture } from "#core/tests/fixture-io";
import { readPageTypeLabels, requestedUrl } from "#core/tests/page-type-labels";

/**
 * A small live sample: one page per page type, fetched with the scanner's own
 * fetcher, checked for its page type only.
 *
 * The frozen corpus proves the classifier on the bytes it was given; this
 * proves the same pages still read the same way today. Verdicts are not
 * asserted, because a live page changes without any code change. A page that
 * no longer answers 200 is skipped with its status, not failed: the URL has
 * moved, and the fixture still holds what it proved.
 */
const live = Object.entries(readPageTypeLabels()).filter(
  ([, label]) => label.live,
);

describe.skipIf(process.env["AL_SKIP_NETWORK"] === "1")(
  "page types on live pages",
  () => {
    const fetcher = createFetcher();

    for (const [name, label] of live) {
      it(
        `${name} still reads as ${label.expected}`,
        { timeout: 60_000 },
        async (ctx) => {
          const url = requestedUrl(readFixture(name).provenance);
          const result = await fetcher.fetch({ url });
          if (result.status !== 200 || !result.body) {
            ctx.skip(`${name} answered HTTP ${result.status} today`);
            return;
          }
          const $ = parseHtml(result.body);
          const classification = classifyPage(
            url,
            $,
            [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)],
            extractMetaTags($),
          );
          expect(
            classification.type,
            `Signals: ${classification.signals.join(", ") || "none"}`,
          ).toBe(label.expected);
        },
      );
    }
  },
);
