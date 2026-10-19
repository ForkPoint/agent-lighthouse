import { describe, it, expect } from "vitest";
import { CorsAiFilesAudit } from "./cors-ai-files";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { sharedProbeUrl } from "#core/gatherers/discovery";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus, HttpMethod } from "#core/types";

describe("CorsAiFilesAudit", () => {
  const audit = new CorsAiFilesAudit();

  function corsResult(acao?: string): FetchResult {
    const r = mockFetchResult("", 204);
    if (acao !== undefined) r.headers["access-control-allow-origin"] = acao;
    return r;
  }

  it("passes when all AI files return Access-Control-Allow-Origin", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => corsResult("*");
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("All AI files have CORS");
  });

  it("warns when only some files have CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async (opts) =>
      opts.url.includes("llms.txt") ? corsResult("*") : corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("ai-catalog.json");
  });

  it("is not applicable when neither AI file is published", async () => {
    const ctx = mockCheckContext([], {
      "/llms.txt": mockFetchResult("", 404),
      "/.well-known/ai-catalog.json": mockFetchResult("", 404),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // A homepage redirect answers both paths with HTML and HTTP 200.
  it("is not applicable when both AI files answer with an HTML page", async () => {
    const home = mockFetchResult(
      '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
      200,
      "text/html",
    );
    const ctx = mockCheckContext([], {
      "/llms.txt": home,
      "/.well-known/ai-catalog.json": home,
    });
    ctx.fetch = async () => corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("fails when no AI files have CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No AI files have CORS");
  });

  it("treats fetch errors as missing CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      throw new Error("network");
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("passes when CORS header is a specific origin (not *)", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      const r = mockFetchResult("", 204);
      r.headers["access-control-allow-origin"] =
        "https://trusted-agent.example.com";
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  describe("probe shape — a browser always sends Origin", () => {
    /** A server that, like many CDNs, emits ACAO only on a real CORS request. */
    function reflectingFetch(seen: FetchOptions[]) {
      return async (opts: FetchOptions): Promise<FetchResult> => {
        seen.push(opts);
        const origin = opts.headers?.["Origin"];
        return corsResult(origin ? "*" : undefined);
      };
    }

    it("sends Origin and Access-Control-Request-Method on the preflight", async () => {
      const seen: FetchOptions[] = [];
      const ctx = mockCheckContext([]);
      ctx.fetch = reflectingFetch(seen);
      await audit.audit(ctx);
      const preflight = seen.find((o) => o.method === HttpMethod.Options);
      expect(preflight?.headers?.["Origin"]).toMatch(/^https:\/\//);
      expect(preflight?.headers?.["Access-Control-Request-Method"]).toBe("GET");
    });

    it("passes a server that answers CORS only when Origin is present", async () => {
      const ctx = mockCheckContext([]);
      ctx.fetch = reflectingFetch([]);
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Pass);
    });

    it("falls back to a GET carrying Origin when the preflight has no ACAO", async () => {
      const seen: FetchOptions[] = [];
      const ctx = mockCheckContext([]);
      ctx.fetch = async (opts) => {
        seen.push(opts);
        return corsResult(
          opts.method === HttpMethod.Get && opts.headers?.["Origin"]
            ? "*"
            : undefined,
        );
      };
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Pass);
      expect(seen.some((o) => o.method === HttpMethod.Get)).toBe(true);
    });

    it("does not reuse a cached probe that was sent without Origin", async () => {
      const ctx = mockCheckContext([]);
      ctx.fetch = reflectingFetch([]);
      await sharedProbeUrl(ctx, `${ctx.baseUrl}/llms.txt`, {
        method: HttpMethod.Options,
      });
      const result = await audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Pass);
    });
  });
});
