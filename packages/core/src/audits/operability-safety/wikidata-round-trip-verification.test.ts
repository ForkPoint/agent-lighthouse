import { describe, it, expect, vi } from "vitest";
import {
  WikidataRoundTripVerificationAudit,
  wikidataId,
  claimedEntities,
  officialWebsite,
} from "./wikidata-round-trip-verification";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import { extractJsonLd, parseHtml } from "../../parser";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) =>
      url.startsWith("https://www.wikidata.org"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

/** A wbgetclaims body giving `website` as P856 at `rank`. */
function claims(website: string | undefined, rank = "normal"): string {
  if (website === undefined) return JSON.stringify({ claims: {} });
  return JSON.stringify({
    claims: {
      P856: [
        { rank, mainsnak: { datavalue: { value: website, type: "string" } } },
      ],
    },
  });
}

interface Site {
  sameAs?: string[];
  /** Response body per Q-id, or a status to answer with. */
  wikidata?: Record<string, string | number>;
}

function run(site: Site) {
  const audit = new WikidataRoundTripVerificationAudit();
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Example Inc",
    ...(site.sameAs ? { sameAs: site.sameAs } : {}),
  });
  const html = `<html><head><script type="application/ld+json">${jsonLd}</script></head><body><p>Home.</p></body></html>`;
  const ctx = mockCheckContext([mockPageContext("https://example.com/", html)]);
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const id = new URL(o.url).searchParams.get("entity") ?? "";
    const answer = site.wikidata?.[id];
    if (typeof answer === "number")
      return mockFetchResult("", answer, "application/json");
    return mockFetchResult(
      answer ?? claims("https://example.com/"),
      200,
      "application/json",
    );
  };

  return { result: audit.audit(ctx), requests };
}

describe("WikidataRoundTripVerificationAudit", () => {
  const audit = new WikidataRoundTripVerificationAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no page claims a Wikidata entity", async () => {
    const { result, requests } = run({
      sameAs: ["https://twitter.com/example"],
    });
    expect((await result).status).toBe("na");
    expect(requests).toHaveLength(0);
  });

  describe("wikidataId", () => {
    it("reads a Q-id from both URL forms and rejects anything else", () => {
      expect(wikidataId("https://www.wikidata.org/wiki/Q95")).toBe("Q95");
      expect(wikidataId("http://wikidata.org/entity/Q42")).toBe("Q42");
      expect(
        wikidataId("https://en.wikipedia.org/wiki/Google"),
      ).toBeUndefined();
    });
  });

  describe("claimedEntities", () => {
    it("collects Q-ids from identity nodes only", () => {
      const $ = parseHtml(
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              sameAs: ["https://www.wikidata.org/wiki/Q95"],
            },
            {
              "@type": "WebPage",
              sameAs: ["https://www.wikidata.org/wiki/Q1"],
            },
          ],
        })}</script>`,
      );
      expect(claimedEntities(extractJsonLd($))).toEqual(["Q95"]);
    });
  });

  describe("officialWebsite", () => {
    it("prefers a preferred-rank statement and ignores a deprecated one", () => {
      const body = JSON.stringify({
        claims: {
          P856: [
            {
              rank: "deprecated",
              mainsnak: { datavalue: { value: "https://old.test/" } },
            },
            {
              rank: "normal",
              mainsnak: { datavalue: { value: "https://normal.test/" } },
            },
            {
              rank: "preferred",
              mainsnak: { datavalue: { value: "https://preferred.test/" } },
            },
          ],
        },
      });
      expect(officialWebsite(body)).toBe("https://preferred.test/");
      expect(officialWebsite("not json")).toBeUndefined();
    });
  });

  it("passes when the entity points back at this domain", async () => {
    const { result, requests } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
    });
    const r = await result;
    expect(r.status).toBe("pass");
    expect(requests[0]?.url).toContain("property=P856");
    expect(strings(r, "verified").join(" ")).toContain("Q95");
  });

  it("passes when the entity points at a subdomain of this domain", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://www.example.com/about") },
    });
    expect((await result).status).toBe("pass");
  });

  it("fails when the entity points at an unrelated organization", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://someone-else.test/") },
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures").join(" ")).toContain("someone-else.test");
  });

  // about.google is Google's official website; the same name, another TLD.
  it("warns rather than fails on the same name under a different domain", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://example.io/") },
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("different domain");
  });

  it("warns when the entity declares no official website", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims(undefined) },
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("no official website");
  });

  it("warns when Wikidata itself does not answer", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: 503 },
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("503");
  });

  it("resolves at most two entities per scan", async () => {
    const { result, requests } = run({
      sameAs: ["Q1", "Q2", "Q3"].map(
        (id) => `https://www.wikidata.org/wiki/${id}`,
      ),
    });
    await result;
    expect(requests).toHaveLength(2);
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = WikidataRoundTripVerificationAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
