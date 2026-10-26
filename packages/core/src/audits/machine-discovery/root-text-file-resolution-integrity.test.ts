import { describe, it, expect, vi } from "vitest";
import { RootTextFileResolutionIntegrityAudit } from "./root-text-file-resolution-integrity";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { AuditResultSchema } from "#core/schemas";
import type { AuditResult } from "#core/types";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

interface Origin {
  /** What a root .txt path that does not exist answers. */
  probe?: (url: string, index: number) => FetchResult;
  robotsThrows?: boolean;
  robotsStatus?: number;
  robotsType?: string;
}

function run(origin: Origin = {}) {
  const audit = new RootTextFileResolutionIntegrityAudit();
  const ctx = mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        "<html><body><p>Hi.</p></body></html>",
      ),
    ],
    {
      "/robots.txt": mockFetchResult(
        "User-agent: *\nAllow: /\n",
        200,
        "text/plain",
      ),
    },
  );
  const requests: FetchOptions[] = [];
  let probeIndex = 0;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    if (new URL(o.url).pathname === "/robots.txt") {
      if (origin.robotsThrows) throw new Error("request not sent");
      return mockFetchResult(
        "User-agent: *\nAllow: /\n",
        origin.robotsStatus ?? 200,
        origin.robotsType ?? "text/plain",
      );
    }
    const index = probeIndex++;
    const result = origin.probe
      ? origin.probe(o.url, index)
      : mockFetchResult("", 404, "text/plain");
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

describe("RootTextFileResolutionIntegrityAudit", () => {
  const audit = new RootTextFileResolutionIntegrityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("passes when both random probes 404 and robots.txt is text/plain", async () => {
    const { result } = run();
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(r.details?.["discoveryProbeReliable"]).toBe(true);
  });

  it("sends exactly three requests: two random probes and robots.txt", async () => {
    const { result, requests } = run();
    await result;
    expect(requests).toHaveLength(3);
    const probes = requests.filter(
      (o) => new URL(o.url).pathname !== "/robots.txt",
    );
    expect(probes).toHaveLength(2);
    for (const probe of probes) {
      expect(new URL(probe.url).pathname).toMatch(/^\/[0-9a-f]{32}\.txt$/);
      expect(probe.headers?.["Cache-Control"]).toBe("no-cache");
      expect(probe.followRedirects).toBe(true);
    }
    // Two probes, two different names: one real file must not decide the verdict.
    expect(probes[0]!.url).not.toBe(probes[1]!.url);
  });

  it("classifies an HTML body as an SPA or HTML catch-all", async () => {
    const { result } = run({
      probe: () =>
        mockFetchResult(
          "<!doctype html><html><body>App</body></html>",
          200,
          "text/html",
        ),
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("SPA or HTML catch-all");
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
  });

  // A random .txt that 301s to the homepage is answered by a redirect, not by
  // a catch-all. The fetcher follows it, so the final answer is the
  // homepage's 200 HTML, but the .txt path itself does not serve a file.
  const toHomepage = (url: string): FetchResult => {
    const result = mockFetchResult(
      "<!doctype html><html><body>Home</body></html>",
      200,
      "text/html",
    );
    result.url = url;
    result.finalUrl = "https://example.com/";
    result.redirectChain = [
      { status: 301, from: url, to: "https://example.com/" },
    ];
    return result;
  };

  it("reads a probe redirected to another path as absent", async () => {
    const { result } = run({ probe: (url) => toHomepage(url) });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(r.details?.["discoveryProbeReliable"]).toBe(true);
    expect(r.found).toContain("redirected away");
  });

  // True positive: a 200 HTML answer at the requested path is still a
  // catch-all, even when the fetcher reports the final URL.
  it("still fails an HTML 200 served at the requested path", async () => {
    const { result } = run({
      probe: (url) => {
        const r = mockFetchResult(
          "<!doctype html><html><body>App</body></html>",
          200,
          "text/html",
        );
        r.url = url;
        r.finalUrl = url;
        return r;
      },
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("SPA or HTML catch-all");
  });

  // A redirect that keeps the path (http to https, apex to www) is not a
  // redirect away. Its final answer is still judged.
  it("judges a same-path redirect on its final answer", async () => {
    const { result } = run({
      probe: (url) => {
        const r = mockFetchResult(
          "<html><body>App</body></html>",
          200,
          "text/html",
        );
        r.url = url;
        r.finalUrl = url.replace(
          "https://example.com",
          "https://www.example.com",
        );
        return r;
      },
    });
    expect((await result).status).toBe(CheckStatus.Fail);
  });

  it("classifies a text body served as text/html as a wrong content type", async () => {
    const { result } = run({
      probe: (_url, index) =>
        mockFetchResult(`plain body ${index}`, 200, "text/html"),
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("wrong content type");
  });

  it("classifies two byte-identical bodies as a static catch-all", async () => {
    const { result } = run({
      probe: () => mockFetchResult("fallback", 200, "text/plain"),
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("static catch-all");
  });

  it("fails a probe status that is neither 2xx nor 404/410", async () => {
    const { result } = run({
      probe: () => mockFetchResult("", 403, "text/plain"),
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("403");
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
  });

  it("accepts 410 as proof the origin resolves a missing file", async () => {
    const { result } = run({
      probe: () => mockFetchResult("", 410, "text/plain"),
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
  });

  it("fails a robots.txt served as application/octet-stream", async () => {
    const { result } = run({ robotsType: "application/octet-stream" });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").join(" ")).toContain("text/plain");
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
  });

  // A site with no robots.txt has no positive control, which is not the same
  // defect as an origin that mislabels the file it does serve.
  it("warns rather than fails when robots.txt is missing", async () => {
    const { result } = run({ robotsStatus: 404, robotsType: "" });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "warnings").join(" ")).toContain(
      "positive control did not run",
    );
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
  });

  it.each([
    {
      name: "status zero",
      probe: () => mockFetchResult("", 0, ""),
      robotsStatus: 0,
    },
    {
      name: "thrown requests",
      probe: () => {
        throw new Error("request not sent");
      },
      robotsThrows: true,
    },
    { name: "missing robots response", robotsThrows: true },
    {
      name: "missing second probe",
      probe: (_url: string, index: number) => {
        if (index === 1) throw new Error("request not sent");
        return mockFetchResult("", 404, "text/plain");
      },
    },
    {
      name: "both probes missing with good robots",
      probe: () => {
        throw new Error("request not sent");
      },
    },
    {
      name: "status zero after a changed final URL",
      probe: () => ({
        ...mockFetchResult("", 0, ""),
        finalUrl: "https://example.com/",
      }),
    },
  ])("marks $name as unverified without a site defect", async (origin) => {
    const r = await run(origin).result;
    expect(AuditResultSchema.parse(r).status).toBe(CheckStatus.NotApplicable);
    expect(r.displayValue).toBe("Unverified");
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
    expect(strings(r, "failures")).toEqual([]);
    expect(audit.toCheckResult(r).title).toBe(
      RootTextFileResolutionIntegrityAudit.meta.title,
    );
  });

  it("retains status-zero diagnostics for the corpus failure case", async () => {
    const r = await run({
      probe: () => mockFetchResult("", 0, ""),
      robotsStatus: 0,
    }).result;
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.details?.["probeStatuses"]).toEqual(["0", "0"]);
    expect(r.details?.["robotsStatus"]).toBe(0);
  });

  it.each([
    {
      name: "catch-all with no robots response",
      probe: () => mockFetchResult("<html>App</html>", 200, "text/html"),
      robotsThrows: true,
    },
    {
      name: "one catch-all and one unsent probe",
      probe: (_url: string, index: number) =>
        mockFetchResult("<html>App</html>", index === 0 ? 200 : 0, "text/html"),
      robotsStatus: 0,
    },
    {
      name: "HTTP rejection with no robots response",
      probe: () => mockFetchResult("", 403, ""),
      robotsThrows: true,
    },
    {
      name: "bad robots type with unsent probes",
      probe: () => mockFetchResult("", 0, ""),
      robotsType: "text/html",
    },
  ])("retains the observed defect for $name", async (origin) => {
    const r = await run(origin).result;
    expect(AuditResultSchema.parse(r).status).toBe(CheckStatus.Fail);
    expect(strings(r, "failures").length).toBeGreaterThan(0);
    expect(r.details?.["discoveryProbeReliable"]).toBe(false);
  });

  it("keeps both diagnostic slots when the first probe throws", async () => {
    const r = await run({
      probe: (_url, index) => {
        if (index === 0) throw new Error("request not sent");
        return mockFetchResult("<html>App</html>", 200, "text/html");
      },
      robotsThrows: true,
    }).result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(r.details?.["probeStatuses"]).toEqual(["0", "200"]);
    expect(strings(r, "probeNames")).toHaveLength(2);
    expect(r.found).toContain("no HTTP response and HTTP 200");
    expect(r.found).toContain("/robots.txt: no HTTP response");
  });

  it("does not treat missing probes plus a robots 404 as a complete warning", async () => {
    const r = await run({
      probe: () => {
        throw new Error("request not sent");
      },
      robotsStatus: 404,
    }).result;
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.details?.["probeStatuses"]).toEqual(["0", "0"]);
    expect(strings(r, "probeNames")).toHaveLength(2);
    expect(r.found).toContain("no HTTP response and no HTTP response");
    expect(r.found).toContain("HTTP 404");
  });

  it("emits the derived flag and names the checks it qualifies", () => {
    const { meta } = RootTextFileResolutionIntegrityAudit;
    expect(meta.guidance?.impact).toContain("llms.txt");
    expect(meta.guidance?.impact).toContain("IndexNow");
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
