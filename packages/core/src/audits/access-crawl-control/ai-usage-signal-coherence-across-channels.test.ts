import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { AiUsageSignalCoherenceAcrossChannelsAudit } from "./ai-usage-signal-coherence-across-channels";
import {
  challengedSiteContext,
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

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
    const result = await audit.audit(
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
    expect(result.status).toBe("pass");
  });

  it("fails when two channels disagree, naming both and their source lines", async () => {
    const result = await audit.audit(
      site({
        robots: "User-agent: *\nContent-Usage: train-ai=y\nAllow: /\n",
        headers: { "tdm-reservation": "1" },
      }),
    );
    expect(result.status).toBe("fail");
    const contradictions = result.details?.["contradictions"] as string[];
    expect(contradictions[0]).toContain("robots.txt Content-Usage");
    expect(contradictions[0]).toContain("tdm-reservation response header");
    expect(contradictions[0]).toContain("Content-Usage: train-ai=y");
  });

  it("reads a tdm-reservation of 1 as a denial and 0 as a permission", async () => {
    const denied = await audit.audit(
      site({
        head: '<meta name="tdm-reservation" content="1">',
        robots: "User-agent: *\nContent-Usage: train-ai=n\n",
      }),
    );
    expect(denied.status).toBe("pass");
    const contradicted = await audit.audit(
      site({
        head: '<meta name="tdm-reservation" content="0">',
        robots: "User-agent: *\nContent-Usage: train-ai=n\n",
      }),
    );
    expect(contradicted.status).toBe("fail");
  });

  // A Content-Signal line written inside a named group is that group's, which
  // is the same RFC 9309 precedence rule robots-ai-group-shadowing applies.
  it("does not apply a named group’s Content-Signal to another agent", async () => {
    const result = await audit.audit(
      site({
        robots: "User-agent: GPTBot\nContent-Signal: ai-train=no\nAllow: /\n",
        headers: { "content-usage": "train-ai=y" },
      }),
    );
    expect(result.status).toBe("fail");
    const other = await audit.audit(
      site({
        robots:
          "User-agent: GPTBot\nContent-Signal: ai-train=no\nAllow: /\n\nUser-agent: CCBot\nDisallow: /\n",
      }),
    );
    // GPTBot's signal and CCBot's block are about different agents, so they do
    // not contradict each other.
    expect(other.status).toBe("pass");
  });

  it("reports a prepended Content-Signal block as an edge override, not an ordinary contradiction", async () => {
    const result = await audit.audit(
      site({
        robots:
          "User-Agent: *\nContent-Signal: search=yes, ai-train=no\nAllow: /\n\nUser-agent: *\nContent-Usage: train-ai=y\nAllow: /\n",
      }),
    );
    expect(result.status).toBe("fail");
    const overrides = result.details?.["edgeOverrides"] as string[];
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toContain("Content-Signal");
    expect(result.remediation).toContain(
      "above your own robots.txt directives",
    );
  });

  it("warns on total silence, with a different remedy from a contradiction", async () => {
    const result = await audit.audit(
      site({ robots: "User-agent: *\nAllow: /\n" }),
    );
    expect(result.status).toBe("warn");
    expect(result.details?.["signals"]).toBe(0);
    expect(result.remediation).toContain("Content-Usage");
  });

  it("reads an inline RSL document without fetching anything", async () => {
    const result = await audit.audit(
      site({
        body: '<script type="application/rsl+xml"><rsl xmlns="https://rslstandard.org/rsl"><content url="/"><license><prohibits type="usage">ai-input</prohibits></license></content></rsl></script>',
        headers: { "content-usage": "ai-input=y" },
      }),
    );
    expect(result.status).toBe("fail");
    expect(result.details?.["channels"] as string[]).toContain(
      "inline RSL document",
    );
  });

  it("does not use a tdmrep.json that is a bare object, and says so", async () => {
    const result = await audit.audit(
      site({
        tdmrep: '{"tdm-reservation": 1}',
        robots: "User-agent: *\nContent-Usage: train-ai=y\n",
      }),
    );
    expect(result.status).toBe("pass");
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
      (await audit.audit(reached)).status,
      "the same header reached is judged",
    ).toBe("pass");

    const challenged = challengedSiteContext(reached.pages, reached.rootFiles);
    const plan = planAudits(challenged, defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      AiUsageSignalCoherenceAcrossChannelsAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === AiUsageSignalCoherenceAcrossChannelsAudit.meta.id,
      )?.status,
    ).toBe("na");
  });

  it("is a scored grade B audit", () => {
    const { meta } = AiUsageSignalCoherenceAcrossChannelsAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
