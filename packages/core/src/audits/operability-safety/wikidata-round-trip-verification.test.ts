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
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import { extractJsonLd, parseHtml } from "#core/parser";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import type { AuditResult } from "#core/types";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  ScoreDisplayMode,
} from "#core/types";

const dns = vi.hoisted(() => ({ wikidataResolves: true }));

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) =>
      dns.wikidataResolves && url.startsWith("https://www.wikidata.org"),
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
    expect((await result).status).toBe(CheckStatus.NotApplicable);
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

  it("reads an identity type out of an @type array", () => {
    expect(
      claimedEntities([
        {
          "@type": ["Thing", "Organization"],
          sameAs: "https://www.wikidata.org/wiki/Q42",
        },
      ]),
    ).toEqual(["Q42"]);
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

    it("skips malformed statements and keeps the first of equal rank", () => {
      const body = JSON.stringify({
        claims: {
          P856: [
            "not a statement",
            { rank: "normal", mainsnak: "not a snak" },
            { rank: "normal", mainsnak: { datavalue: "not a datavalue" } },
            { rank: "normal", mainsnak: { datavalue: { value: 42 } } },
            // No rank, or a rank Wikidata does not define, reads as normal.
            { mainsnak: { datavalue: { value: "https://first.test/" } } },
            {
              rank: "unknown-rank",
              mainsnak: { datavalue: { value: "https://second.test/" } },
            },
          ],
        },
      });
      expect(officialWebsite(body)).toBe("https://first.test/");
    });

    it("keeps a preferred statement over a later normal one", () => {
      const body = JSON.stringify({
        claims: {
          P856: [
            {
              rank: "preferred",
              mainsnak: { datavalue: { value: "https://preferred.test/" } },
            },
            {
              rank: "normal",
              mainsnak: { datavalue: { value: "https://normal.test/" } },
            },
          ],
        },
      });
      expect(officialWebsite(body)).toBe("https://preferred.test/");
    });

    it("finds nothing when P856 is not a statement list", () => {
      expect(
        officialWebsite(JSON.stringify({ claims: { P856: "x" } })),
      ).toBeUndefined();
    });
  });

  it("passes when the entity points back at this domain", async () => {
    const { result, requests } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(requests[0]?.url).toContain("property=P856");
    expect(strings(r, "verified").join(" ")).toContain("Q95");
  });

  it("passes when the entity points at a subdomain of this domain", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://www.example.com/about") },
    });
    expect((await result).status).toBe(CheckStatus.Pass);
  });

  it("fails when the entity points at an unrelated organization", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://someone-else.test/") },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("someone-else.test");
  });

  // about.google is Google's official website; the same name, another TLD.
  it("warns rather than fails on the same name under a different domain", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("https://example.io/") },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "warnings").join(" ")).toContain("different domain");
  });

  it("warns when the entity declares no official website", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims(undefined) },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "warnings").join(" ")).toContain("no official website");
  });

  it("is notApplicable when Wikidata itself does not answer", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: 503 },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.message).toContain("503");
    expect(strings(r, "warnings").join(" ")).toContain("503");
  });

  it("judges the entities it read when another one is unreachable", async () => {
    const { result } = run({
      sameAs: [
        "https://www.wikidata.org/wiki/Q1",
        "https://www.wikidata.org/wiki/Q2",
      ],
      wikidata: { Q1: claims("https://example.com/"), Q2: 503 },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(strings(r, "verified")).toHaveLength(1);
    expect(strings(r, "warnings").join(" ")).toContain("503");
  });

  it("fails a P856 value that names no resolvable domain", async () => {
    const { result } = run({
      sameAs: ["https://www.wikidata.org/wiki/Q95"],
      wikidata: { Q95: claims("not a url") },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(r.message).toContain("belongs to no resolvable domain");
  });

  it("is notApplicable when the Wikidata request gets no response", async () => {
    const audit = new WikidataRoundTripVerificationAudit();
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        sameAs: ["https://www.wikidata.org/wiki/Q95"],
      },
    )}</script></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", html),
    ]);
    ctx.fetch = async () => {
      throw new Error("connection reset");
    };
    const r = await audit.audit(ctx);
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.message).toContain("Q95: Wikidata answered HTTP 0");
  });

  it("is notApplicable when the Wikidata URL fails the safety check", async () => {
    dns.wikidataResolves = false;
    try {
      const { result, requests } = run({
        sameAs: ["https://www.wikidata.org/wiki/Q95"],
      });
      const r = await result;
      expect(r.status).toBe(CheckStatus.NotApplicable);
      expect(r.message).toContain("Q95: Wikidata could not be reached");
      expect(requests).toHaveLength(0);
      expect(strings(r, "warnings").join(" ")).toContain("unverified");
    } finally {
      dns.wikidataResolves = true;
    }
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

  it("registers as an informative grade-C audit", () => {
    const { meta } = WikidataRoundTripVerificationAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(meta.tier).toBe(AuditTier.Informative);
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
