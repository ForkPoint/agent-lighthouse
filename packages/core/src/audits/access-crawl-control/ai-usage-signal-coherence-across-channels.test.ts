import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { AiUsageSignalCoherenceAcrossChannelsAudit } from "./ai-usage-signal-coherence-across-channels";
import {
  challengedSiteContext,
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import type { AuditResult } from "#core/types";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";

/** The contradictions detail, defaulted so an absent list fails the assertion, not the read. */
const contradictionsOf = (result: AuditResult): string[] =>
  (result.details?.["contradictions"] ?? []) as string[];

interface SiteSpec {
  robots?: string;
  tdmrep?: string;
  headers?: Record<string, string>;
  head?: string;
  body?: string;
}

function site(spec: SiteSpec): CheckContext {
  const page = mockPageContext(
    "https://example.com/",
    `<html><head>${spec.head ?? ""}</head><body>${spec.body ?? "<p>Hello.</p>"}</body></html>`,
  );
  Object.assign(page.fetchResult.headers, spec.headers ?? {});
  const rootFiles: Record<string, ReturnType<typeof mockFetchResult>> = {};
  if (spec.robots !== undefined)
    rootFiles["/robots.txt"] = mockFetchResult(spec.robots, 200, "text/plain");
  if (spec.tdmrep !== undefined) {
    rootFiles["/.well-known/tdmrep.json"] = mockFetchResult(
      spec.tdmrep,
      200,
      "application/json",
    );
  }
  const ctx = mockCheckContext([page], rootFiles);
  // Nothing in this audit may reach the network.
  ctx.fetch = async () => {
    throw new Error("this audit must not fetch");
  };
  return ctx;
}

describe("AiUsageSignalCoherenceAcrossChannelsAudit", () => {
  const audit = new AiUsageSignalCoherenceAcrossChannelsAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("maps every channel into the same category space", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nContent-Signal: search=no\n",
        headers: { "content-usage": "train-ai=n" },
      }),
    );
    const channels = result.details?.["channels"] as string[];
    expect(channels).toContain("robots.txt Disallow");
    expect(channels).toContain("robots.txt Content-Signal");
    expect(channels).toContain("Content-Usage response header");
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("fails when two channels disagree, naming both and their source lines", async () => {
    const result = audit.audit(
      site({
        robots: "User-agent: *\nContent-Usage: train-ai=y\nAllow: /\n",
        headers: { "tdm-reservation": "1" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    const contradictions = result.details?.["contradictions"] as string[];
    expect(contradictions[0]).toContain("robots.txt Content-Usage");
    expect(contradictions[0]).toContain("tdm-reservation response header");
    expect(contradictions[0]).toContain("Content-Usage: train-ai=y");
  });

  it("reads a tdm-reservation of 1 as a denial and 0 as a permission", async () => {
    const denied = audit.audit(
      site({
        head: '<meta name="tdm-reservation" content="1">',
        robots: "User-agent: *\nContent-Usage: train-ai=n\n",
      }),
    );
    expect(denied.status).toBe(CheckStatus.Pass);
    const contradicted = audit.audit(
      site({
        head: '<meta name="tdm-reservation" content="0">',
        robots: "User-agent: *\nContent-Usage: train-ai=n\n",
      }),
    );
    expect(contradicted.status).toBe(CheckStatus.Fail);
  });

  // A Content-Signal line written inside a named group is that group's, which
  // is the same RFC 9309 precedence rule robots-ai-group-shadowing applies.
  it("does not apply a named group’s Content-Signal to another agent", async () => {
    const result = audit.audit(
      site({
        robots: "User-agent: GPTBot\nContent-Signal: ai-train=no\nAllow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["notes"]).toEqual(
      expect.arrayContaining([expect.stringContaining("Overlapping")]),
    );
    const other = audit.audit(
      site({
        robots:
          "User-agent: GPTBot\nContent-Signal: ai-train=no\nAllow: /\n\nUser-agent: CCBot\nDisallow: /\n",
      }),
    );
    // GPTBot's signal and CCBot's block are about different agents, so they do
    // not contradict each other.
    expect(other.status).toBe(CheckStatus.Pass);
  });

  it("does not infer edge ownership from line order", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-Agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /\n\nUser-agent: *\nContent-Usage: train-ai=y\nAllow: /\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    const overrides = result.details?.["edgeOverrides"] as string[];
    expect(overrides).toHaveLength(0);
    expect(contradictionsOf(result)[0]).toContain("Content-Signal");
    expect(result.remediation).not.toContain("CDN");
  });

  // Coherence needs at least one declaration. Silence has nothing to
  // contradict, and no source documents a cost for it.
  it("is not applicable on total silence, and keeps the notes it gathered", async () => {
    const result = audit.audit(
      site({
        robots: "User-agent: *\nAllow: /\n",
        tdmrep: '{"tdm-reservation": 1}',
      }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.score).toBe(0);
    expect(result.details?.["signals"]).toBe(0);
    expect((result.details!["notes"] as string[])[0]).toContain(
      "array of rules",
    );
    expect(result.remediation).toBeUndefined();
  });

  it("still fails a robots.txt block contradicted by a response header", async () => {
    const result = audit.audit(
      site({
        robots: "User-agent: GPTBot\nDisallow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    const contradictions = result.details?.["contradictions"] as string[];
    expect(contradictions[0]).toContain("robots.txt Disallow");
    expect(contradictions[0]).toContain("Content-Usage response header");
  });

  // Anthropic documents `ClaudeBot` as its training token; `anthropic-ai`
  // appears in no Anthropic document. Perplexity says PerplexityBot is not
  // used to crawl content for AI foundation models.
  it("reads a ClaudeBot block as a training denial", async () => {
    const result = audit.audit(
      site({
        robots: "User-agent: ClaudeBot\nDisallow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(contradictionsOf(result)[0]).toContain("ClaudeBot is blocked");
  });

  it("does not read a PerplexityBot or anthropic-ai block as a training denial", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: PerplexityBot\nDisallow: /\n\nUser-agent: anthropic-ai\nDisallow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(contradictionsOf(result)).toEqual([]);
  });

  // Review scenario: no operator documents Bytespider or cohere-ai as a
  // training crawler, so blocking them states no training preference.
  it("does not read a Bytespider or cohere-ai block as a training denial", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: Bytespider\nDisallow: /\n\nUser-agent: cohere-ai\nDisallow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(contradictionsOf(result)).toEqual([]);
  });

  it("still passes a single declaration with nothing to contradict it", async () => {
    const result = audit.audit(
      site({ robots: "User-agent: *\nContent-Usage: train-ai=n\n" }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reads an inline RSL document without fetching anything", async () => {
    const result = audit.audit(
      site({
        body: '<script type="application/rsl+xml"><rsl xmlns="https://rslstandard.org/rsl"><content url="/"><license><prohibits type="usage">ai-input</prohibits></license></content></rsl></script>',
        headers: { "content-usage": "ai-input=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.details?.["channels"] as string[]).toContain(
      "inline RSL document",
    );
  });

  // A homepage redirect answers /.well-known/tdmrep.json with HTML. That is
  // no tdmrep.json, not a malformed one, so no note names it.
  it("ignores an HTML page at /.well-known/tdmrep.json", async () => {
    const result = audit.audit(
      site({
        tdmrep:
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        robots: "User-agent: *\nContent-Usage: train-ai=y\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(JSON.stringify(result.details ?? {})).not.toContain("tdmrep");
  });

  it("does not use a tdmrep.json that is a bare object, and says so", async () => {
    const result = audit.audit(
      site({
        tdmrep: '{"tdm-reservation": 1}',
        robots: "User-agent: *\nContent-Usage: train-ai=y\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect((result.details!["notes"] as string[])[0]).toContain(
      "array of rules",
    );
  });

  // Finding 1 of the pre-merge review: a bot wall served at HTTP 200 through the
  // site's own edge carries the site's head fragment and its site-wide response
  // headers on a body the site did not write. `origin-reachable` is met there,
  // so the runner must not run this audit against the wall's declaration.
  it("declines to compare channels a bot wall answering 200 filled in", async () => {
    const reached = site({ headers: { "content-usage": "train-ai=n" } });
    expect(
      audit.audit(reached).status,
      "the same header reached is judged",
    ).toBe(CheckStatus.Pass);

    const challenged = challengedSiteContext(reached.pages, reached.rootFiles);
    const plan = planAudits(challenged, defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      AiUsageSignalCoherenceAcrossChannelsAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === AiUsageSignalCoherenceAcrossChannelsAudit.meta.id,
      )?.status,
    ).toBe(CheckStatus.NotApplicable);
  });

  it("reads robots.txt alone when the scan sampled no page", async () => {
    const ctx = mockCheckContext([], {
      "/robots.txt": mockFetchResult(
        "User-agent: *\nContent-Usage: train-ai=n\n",
        200,
        "text/plain",
      ),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["signals"]).toBe(1);
  });

  // attach-05 lets a Content-Usage value lead with a path prefix; declarations
  // over disjoint paths cannot contradict each other.
  it("compares AIPREF declarations only over overlapping path prefixes", async () => {
    const disjoint = audit.audit(
      site({
        robots: "User-agent: *\nContent-Usage: /private/ train-ai=n\n",
        headers: { "content-usage": "/public/ train-ai=y" },
      }),
    );
    expect(disjoint.status).toBe(CheckStatus.Pass);
    const overlapping = audit.audit(
      site({
        robots: "User-agent: *\nContent-Usage: /private/ train-ai=n\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(overlapping.status).toBe(CheckStatus.Fail);
    expect(contradictionsOf(overlapping)[0]).toContain(
      "train-ai over /private/",
    );
  });

  it("ignores values no channel's vocabulary defines", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: *\nContent-Usage: train-ai=maybe, bots=n\nContent-Signal: ai-train=perhaps, crawl=no\n",
        headers: {
          "content-usage": "((not a dictionary",
          "tdm-reservation": "2",
        },
        head: '<meta name="tdm-reservation" content="yes">',
      }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.details?.["signals"]).toBe(0);
  });

  it("does not compare declarations scoped to two different named agents", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: Google-Extended\nContent-Usage: train-ai=y\n\nUser-agent: CCBot\nDisallow: /\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("matches a named agent across channels without regard to case", async () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: gptbot\nContent-Usage: train-ai=y\n\nUser-agent: GPTBot\nDisallow: /\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(contradictionsOf(result)[0]).toContain("robots.txt Disallow");
  });

  it("reads tdmrep.json rules, skipping entries that carry no reservation", async () => {
    const result = audit.audit(
      site({
        tdmrep: JSON.stringify([
          "not a rule",
          null,
          { location: "blog/", "tdm-reservation": 1 },
          { location: "/x/", "tdm-reservation": "maybe" },
        ]),
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    const [finding] = contradictionsOf(result);
    expect(finding).toContain("/.well-known/tdmrep.json");
    expect(finding).toContain('location "blog/" with tdm-reservation 1');
  });

  it("reads a location-less tdmrep.json rule as covering the whole site", async () => {
    const result = audit.audit(
      site({
        tdmrep: '[{"tdm-reservation": "0"}]',
        robots: "User-agent: *\nContent-Usage: train-ai=n\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(contradictionsOf(result)[0]).toContain("train-ai over /");
  });

  it("notes a tdmrep.json that is not JSON at all", async () => {
    const result = audit.audit(
      site({
        tdmrep: "[{ broken",
        robots: "User-agent: *\nContent-Usage: train-ai=y\n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect((result.details!["notes"] as string[])[0]).toContain(
      "array of rules",
    );
  });

  it("reads noai in X-Robots-Tag and in meta robots as a training denial", async () => {
    const header = audit.audit(
      site({
        headers: {
          "x-robots-tag": "noindex, NoAI",
          "content-usage": "train-ai=y",
        },
      }),
    );
    expect(header.status).toBe(CheckStatus.Fail);
    expect(header.details?.["channels"] as string[]).toContain(
      "X-Robots-Tag noai",
    );
    const meta = audit.audit(
      site({
        head: '<meta name="robots" content="noai, noimageai">',
        robots: "User-agent: *\nContent-Usage: train-ai=y\n",
      }),
    );
    expect(meta.status).toBe(CheckStatus.Fail);
    expect(meta.details?.["channels"] as string[]).toContain(
      '<meta name="robots"> noai',
    );
  });

  it("scopes an inline RSL document to its content URL and reads only usage terms", async () => {
    const rsl = (url: string, terms: string) =>
      `<script type="application/rsl+xml"><rsl xmlns="https://rslstandard.org/rsl"><content url="${url}"><license>${terms}</license></content></rsl></script>`;
    const scoped = audit.audit(
      site({
        body:
          '<script type="application/rsl+xml">  </script>' +
          rsl(
            "https://example.com/blog/",
            '<prohibits type="usage">train-ai, unknown-use</prohibits><prohibits type="user">search</prohibits>',
          ),
        headers: { "content-usage": "/shop/ train-ai=y, search=y" },
      }),
    );
    // /blog/ and /shop/ do not overlap, and the `user` term is not a usage.
    expect(scoped.status).toBe(CheckStatus.Pass);
    expect(scoped.details?.["signals"]).toBe(3);

    const unparseable = audit.audit(
      site({
        body: rsl("http://[", '<prohibits type="usage">search</prohibits>'),
        headers: { "content-usage": "/shop/ search=y" },
      }),
    );
    // An unreadable content URL falls back to the whole site, which overlaps.
    expect(unparseable.status).toBe(CheckStatus.Fail);
  });

  it("keeps Content Signals paths case-sensitive and disjoint", () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: *\nContent-Signal: /Blog/ ai-train=no\nContent-Usage: /blog/ train-ai=y",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(contradictionsOf(result)).toEqual([]);
  });

  it("does not leak extension-only groups or equate crawl access with use", () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: A\nContent-Signal: ai-train=yes\nUser-agent: B\nContent-Usage: train-ai=n\nUser-agent: GPTBot\nDisallow: /",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(contradictionsOf(result)).toEqual([]);
  });

  it("does not equate Content Signals search with another vocabulary", () => {
    const result = audit.audit(
      site({
        robots:
          "User-agent: *\nContent-Signal: search=yes\nContent-Usage: search=n",
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("is a scored grade B audit", () => {
    const { meta } = AiUsageSignalCoherenceAcrossChannelsAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});

it("caps stored overlapping-pair notes and reports the omitted count", () => {
  const audit = new AiUsageSignalCoherenceAcrossChannelsAudit();
  const robots =
    "User-agent: *\n" +
    "Content-Signal: /blog/ ai-train=no\n".repeat(10) +
    "Content-Usage: train-ai=y\n".repeat(10);
  const result = audit.audit(site({ robots }));
  expect(result.details?.["notes"]).toHaveLength(50);
  expect(result.details?.["omittedNotes"]).toBe(50);
});

it("reports incomplete Content Signals parsing without claiming silence", () => {
  const result = new AiUsageSignalCoherenceAcrossChannelsAudit().audit(
    site({
      robots: "#" + "x".repeat(500 * 1024) + "\nContent-Signal: search=yes",
    }),
  );
  expect(result.status).toBe(CheckStatus.NotApplicable);
  expect(result.message).toContain("incomplete");
  expect(JSON.stringify(result)).not.toContain(
    "No AI-usage signal in robots.txt",
  );
});

it("keeps other robots channels when Content Signals exceeds its expansion limit", () => {
  const audit = new AiUsageSignalCoherenceAcrossChannelsAudit();
  const robots =
    "User-agent: *\nContent-Usage: train-ai=y\nUser-agent: GPTBot\nDisallow: /\n";
  const headers = { "tdm-reservation": "1" };
  const baseline = audit.audit(site({ robots, headers }));
  const expansion =
    Array.from({ length: 100 }, (_, i) => `User-agent: Bot${i}`).join("\n") +
    "\n" +
    "Content-Signal: ai-train=no\n".repeat(100);
  const result = audit.audit(site({ robots: robots + expansion, headers }));
  expect(result.status).toBe(CheckStatus.Fail);
  expect(contradictionsOf(result)).toEqual(contradictionsOf(baseline));
  expect(result.details?.["channels"]).toEqual(
    expect.arrayContaining([
      "robots.txt Content-Usage",
      "robots.txt Disallow",
      "tdm-reservation response header",
    ]),
  );
  expect(result.details?.["channels"]).not.toContain(
    "robots.txt Content-Signal",
  );
  expect(result.details?.["notes"]).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Content Signals analysis incomplete"),
    ]),
  );
});
