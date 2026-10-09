import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { ExtractorSurvivalRecallAudit } from "./extractor-survival-recall";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
} from "#core/types";

const PROSE =
  "The copper kettle reaches a rolling boil in about three minutes on a gas hob. " +
  "It holds that heat for a further hour once the lid is closed properly. ";

const page = (body: string, head = ""): CheckContext =>
  mockCheckContext([
    mockPageContext(
      "https://example.com/kettles",
      `<html><head><title>Kettles</title>${head}</head><body>${body}</body></html>`,
      1,
    ),
  ]);

const article = (extra = "") => `<main><article>
  <h1>Copper kettle</h1>
  <h2>Boiling</h2><p>${PROSE.repeat(3)}</p>
  <h2>Descaling</h2><p>${PROSE.repeat(3)}</p>
  ${extra}
</article></main>`;

describe("ExtractorSurvivalRecallAudit", () => {
  const audit = new ExtractorSurvivalRecallAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the page carries no key spans", async () => {
    expect(
      (await audit.audit(page("<div>Nothing structured here at all.</div>")))
        .status,
    ).toBe(CheckStatus.NotApplicable);
  });

  it("passes when every key span survives both extractors", async () => {
    const result = await audit.audit(page(article()));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(Number(result.details?.["recall"])).toBeGreaterThanOrEqual(0.9);
  });

  // Readability lifts an h1 that repeats the title out of the body and into
  // the article title. The title is still delivered, so the h1 survived.
  it("counts an h1 kept as Readability's article title as surviving", async () => {
    const result = await audit.audit(
      mockCheckContext([
        mockPageContext(
          "https://example.com/kettles",
          `<html><head><title>Riveted pot | Kettle Co</title></head><body>${article().replace("<h1>Copper kettle</h1>", "<h1>Riveted pot</h1>")}</body></html>`,
          1,
        ),
      ]),
    );
    expect(Number(result.details?.["readabilityRecall"])).toBe(1);
  });

  // A hidden panel is not on the page a reader sees, so its spans are not
  // facts an extractor lost.
  it("takes no key spans from a hidden dialog", async () => {
    const result = await audit.audit(
      page(
        article(
          `<div hidden role="dialog"><h2>Keyboard shortcuts</h2><p>Press the slash key to search every page. Press escape to close the panel.</p></div>`,
        ),
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found ?? "").not.toContain("Keyboard shortcuts");
  });

  it("takes its key spans from h1, section openers, captions, dt, th and JSON-LD", async () => {
    const head = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Copper kettle",
      description: "A two litre copper kettle with a riveted handle.",
    })}</script>`;
    const body = article(
      "<table><caption>Specifications table</caption><tr><th>Capacity</th><td>2 litres</td></tr></table>" +
        "<dl><dt>Warranty term</dt><dd>Two years</dd></dl>" +
        "<p>A two litre copper kettle with a riveted handle.</p>",
    );
    const result = await audit.audit(page(body, head));
    const kinds = result.details?.["spanKinds"] as string[];
    expect(kinds).toContain("h1");
    expect(kinds).toContain("caption");
    expect(kinds).toContain("dt");
    expect(kinds).toContain("th");
    expect(kinds).toContain("json-ld");
  });

  // Regression: the JSON-LD span's host element was looked up with the string
  // interpolated into a `:contains()` selector. gov.uk publishes "Register your
  // vehicle as off the road (SORN)"; cut to 40 characters the closing bracket
  // is gone, css-what threw "Parenthesis not matched", and the runner replaced
  // the whole verdict with `scan-error`. Brackets, quotes and backslashes are
  // ordinary things for a site to publish.
  it("measures a page whose structured data carries selector punctuation", async () => {
    const name =
      'Register your vehicle as off the road (SORN) — the "statutory" \\ form';
    const head = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name,
    })}</script>`;
    const result = await audit.audit(page(`${article()}<p>${name}</p>`, head));
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
    expect(result.details?.["spanKinds"]).toContain("json-ld");
  });

  it("fails when a spec table lives in an aside, and names the ancestor chain", async () => {
    const body = `${article()}<aside class="related-specs"><table><caption>Specifications table</caption><tr><th>Capacity</th><td>2 litres</td></tr><tr><th>Material</th><td>Copper</td></tr></table></aside>`;
    const result = await audit.audit(page(body));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("aside.related-specs");
  });

  it("reports both extractors separately", async () => {
    const result = await audit.audit(page(article()));
    expect(result.details?.["readabilityRecall"]).toBeTypeOf("number");
    expect(result.details?.["aggressiveRecall"]).toBeTypeOf("number");
  });

  it("reports over-strip risk and boilerplate leakage without deciding the status", async () => {
    const result = await audit.audit(page(article()));
    expect(Number(result.details?.["textRatio"])).toBeGreaterThan(0);
    expect(Number(result.details?.["textRatio"])).toBeLessThanOrEqual(1);
  });

  it("registers as a scored grade-B audit with high priority", () => {
    const { meta } = ExtractorSurvivalRecallAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.defaultPriority).toBe(CheckPriority.High);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ExtractorSurvivalRecallAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      ExtractorSurvivalRecallAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === ExtractorSurvivalRecallAudit.meta.id,
      )?.status,
    ).toBe(CheckStatus.NotApplicable);
  });

  // A modifier class that mentions a blocklisted word is not that widget.
  // Firecrawl's selectors (`.banner`-style) name whole class tokens.
  it("does not drop a page wrapper whose class only contains a blocklisted word", async () => {
    const result = await audit.audit(
      page(
        `<div class="page-content page-content--banner-enabled">${article()}</div>`,
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["aggressiveRecall"]).toBe(1);
  });

  // A drop rule that would delete most of the page matched the page, not a widget.
  it("never drops an element that holds most of the page's text", async () => {
    const result = await audit.audit(
      page(`<div class="banner">${article()}</div>`),
    );
    expect(result.details?.["aggressiveRecall"]).toBe(1);
  });

  // Script text is not prose: a JSON-LD URL is not a fact the page states.
  it("does not take key spans from script contents", async () => {
    const jsonLd = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: "https://example.com/kettles",
      potentialAction: { target: "https://example.com/search?q={query}" },
    })}</script>`;
    const result = await audit.audit(page(`${article()}${jsonLd}`));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["spanKinds"]).not.toContain("json-ld");
  });

  const SPECS =
    "<h2>Specifications</h2><p>The kettle holds two litres and weighs one kilogram empty.</p>" +
    "<h2>Warranty</h2><p>Every kettle carries a two year warranty against leaks and rust.</p>";

  it("keeps a block whose class merely contains a blocklisted word", async () => {
    const result = await audit.audit(
      page(article(`<div class="hero hero--promotional">${SPECS}</div>`)),
    );
    expect(result.details?.["aggressiveRecall"]).toBe(1);
  });

  // True positive: a genuinely lossy page still fails, and names the culprit.
  it("still fails when facts sit in a block whose class token is a blocklisted word", async () => {
    const result = await audit.audit(
      page(article(`<div class="promo">${SPECS}</div>`)),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["aggressiveRecall"]).toBe(0.5);
    expect(result.found).toContain("div.promo");
  });

  it("still drops a block by id", async () => {
    const result = await audit.audit(
      page(article(`<div id="sidebar">${SPECS}</div>`)),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["aggressiveRecall"]).toBe(0.5);
  });
});
