import { describe, it, expect } from "vitest";
import { CorsAiFilesAudit } from "./cors-ai-files";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import type { FetchResult } from "../../fetcher";

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
    expect(result.status).toBe("pass");
    expect(result.message).toContain("All AI files have CORS");
  });

  it("warns when only some files have CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async (opts) =>
      opts.url.includes("llms.txt") ? corsResult("*") : corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("ai-catalog.json");
  });

  it("fails when no AI files have CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No AI files have CORS");
  });

  it("treats fetch errors as missing CORS", async () => {
    const ctx = mockCheckContext([]);
    ctx.fetch = async () => {
      throw new Error("network");
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("pass");
  });
});
