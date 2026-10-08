import { describe, it, expect, vi } from "vitest";
import { ReflectedParameterInjectionCanaryAudit } from "./reflected-parameter-injection-canary";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions } from "../../fetcher";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  ScoreDisplayMode,
  HttpMethod,
} from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

/** The value the audit sent, whichever probe carried it. */
function sentValue(url: string): string {
  const parsed = new URL(url);
  for (const value of parsed.searchParams.values()) return value;
  return decodeURIComponent(parsed.pathname.slice(1));
}

const ReflectionSlot = {
  Title: "title",
  Og: "og",
  Canonical: "canonical",
  Jsonld: "jsonld",
  Text: "text",
  None: "none",
} as const;

type ReflectionSlot = (typeof ReflectionSlot)[keyof typeof ReflectionSlot];

/**
 * A site that echoes whatever it was sent into one named slot.
 *
 * `robots` adds a noindex marker, which is the difference between a rendered
 * reflection that warns and one that fails.
 */
function reflectingSite(
  slot: ReflectionSlot,
  opts: { noindex?: boolean } = {},
): { ctx: CheckContext; calls: () => number } {
  let calls = 0;
  const ctx = mockCheckContext([
    mockPageContext(
      "https://example.com/",
      "<html><head></head><body><p>Mugs.</p></body></html>",
    ),
  ]);
  ctx.fetch = async (options: FetchOptions) => {
    calls += 1;
    const echo = sentValue(options.url);
    const robots = opts.noindex ? '<meta name="robots" content="noindex">' : "";
    const bodies: Record<typeof slot, string> = {
      title: `<title>Results for ${echo}</title>`,
      og: `<meta property="og:description" content="Results for ${echo}">`,
      canonical: `<link rel="canonical" href="https://example.com/?q=${echo}">`,
      jsonld: `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        name: `Results for ${echo}`,
      })}</script>`,
      text: "",
      none: "",
    };
    const head = `${robots}${slot === "text" || slot === "none" ? "" : bodies[slot]}`;
    const body =
      slot === ReflectionSlot.Text
        ? `<p>No results for ${echo}.</p>`
        : "<p>No results.</p>";
    return mockFetchResult(
      `<html><head>${head}</head><body>${body}</body></html>`,
      200,
      "text/html",
    );
  };
  return { ctx, calls: () => calls };
}

describe("ReflectedParameterInjectionCanaryAudit", () => {
  const audit = new ReflectedParameterInjectionCanaryAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes a site that reflects nothing", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.None);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails a canary reflected into the title", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Title);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("title");
  });

  it("fails a canary reflected into og:description", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Og);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });

  it("fails a canary reflected into the canonical href", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Canonical);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });

  it("fails a canary reflected into a JSON-LD string value", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Jsonld);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });

  // A noindex page renders the text but never becomes an answer source.
  it("warns on a text-node reflection when the page is noindex", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Text, { noindex: true });
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Warn);
  });

  it("fails the same text-node reflection on an indexable page", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Text);
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Fail);
  });

  it("says whether the canary came back escaped and whether brackets survived", async () => {
    const { ctx } = reflectingSite(ReflectionSlot.Title);
    const result = await audit.audit(ctx);
    expect(result.found).toMatch(/raw|escaped/);
    expect(result.found).toContain("angle bracket");
  });

  // The probe budget is a hard cap, not an average.
  it("sends at most five probes", async () => {
    const { ctx, calls } = reflectingSite(ReflectionSlot.None);
    await audit.audit(ctx);
    expect(calls()).toBeLessThanOrEqual(5);
  });

  it("sends only read-only GETs to the scanned origin", async () => {
    const seen: FetchOptions[] = [];
    const { ctx } = reflectingSite(ReflectionSlot.None);
    const inner = ctx.fetch;
    ctx.fetch = async (options: FetchOptions) => {
      seen.push(options);
      return inner(options);
    };
    await audit.audit(ctx);
    expect(seen.length).toBeGreaterThan(0);
    for (const options of seen) {
      expect(options.method ?? HttpMethod.Get).toBe("GET");
      expect(new URL(options.url).origin).toBe("https://example.com");
    }
  });

  it("is notApplicable when no probe connects", async () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        "<html><body><p>Mugs.</p></body></html>",
      ),
    ]);
    ctx.fetch = async () => mockFetchResult("", 0);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("registers as a scored grade-B audit with critical priority", () => {
    const { meta } = ReflectedParameterInjectionCanaryAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.defaultPriority).toBe(CheckPriority.Critical);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Ternary);
  });
});
