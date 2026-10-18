import { describe, it, expect, vi } from "vitest";
import { McpOriginValidationCorsAudit } from "./mcp-origin-validation-cors";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import type { AuditResult } from "#core/types";
import { AuditResultSchema } from "#core/schemas";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  HttpMethod,
} from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => url.startsWith("https://mcp.example.com"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

const ENDPOINT = "https://mcp.example.com/mcp";

interface Server {
  /** Status for the discover POST with no Origin. */
  baselineStatus?: number;
  /** Status for the discover POST carrying a throwaway Origin. */
  originStatus?: number;
  /** Answer with a WWW-Authenticate challenge on the baseline. */
  challenges?: boolean;
  /** 'reflect' echoes the request Origin; anything else is sent verbatim. */
  allowOrigin?: string;
  allowCredentials?: boolean;
  allowHeaders?: string;
  accelBuffering?: string;
  /** Declare no endpoint at all. */
  undeclared?: boolean;
}

function run(server: Server = {}) {
  const audit = new McpOriginValidationCorsAudit();
  const rootFiles: Record<string, FetchResult> = server.undeclared
    ? {}
    : {
        "/.well-known/mcp/servers.json": mockFetchResult(
          JSON.stringify({ servers: [{ url: ENDPOINT }] }),
          200,
          "application/json",
        ),
      };
  const ctx = mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        "<html><body><p>Hi.</p></body></html>",
      ),
    ],
    rootFiles,
  );
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const requestOrigin = o.headers?.["Origin"] ?? "";
    const cors: Record<string, string> = {};
    if (server.allowOrigin !== undefined) {
      cors["access-control-allow-origin"] =
        server.allowOrigin === "reflect" ? requestOrigin : server.allowOrigin;
    }
    if (server.allowCredentials)
      cors["access-control-allow-credentials"] = "true";
    if (server.allowHeaders !== undefined)
      cors["access-control-allow-headers"] = server.allowHeaders;
    if (server.accelBuffering !== undefined)
      cors["x-accel-buffering"] = server.accelBuffering;

    if (o.method === HttpMethod.Options) {
      const result = mockFetchResult("", 204, "text/plain");
      Object.assign(result.headers, cors);
      return result;
    }

    const status =
      requestOrigin === ""
        ? (server.baselineStatus ?? 200)
        : (server.originStatus ?? server.baselineStatus ?? 200);
    const result = mockFetchResult(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "al-1",
        result: { serverInfo: { name: "x", version: "1" } },
      }),
      status,
      "application/json",
    );
    Object.assign(result.headers, cors);
    if (server.challenges && requestOrigin === "")
      result.headers["www-authenticate"] = 'Bearer realm="mcp"';
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

describe("McpOriginValidationCorsAudit", () => {
  const audit = new McpOriginValidationCorsAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const { result, requests } = run({ undeclared: true });
    expect((await result).status).toBe(CheckStatus.NotApplicable);
    expect(requests).toHaveLength(0);
  });

  // The unambiguous defect: any page the user visits can call the endpoint
  // with the user's session.
  it("fails a reflected Origin paired with credentials", async () => {
    const { result } = run({
      allowOrigin: "reflect",
      allowCredentials: true,
      challenges: true,
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "findings").join(" ")).toContain(
      "reflects an arbitrary Origin",
    );
    expect(r.details?.["allowCredentials"]).toBe(true);
  });

  it("fails a wildcard ACAO on an endpoint that issues an auth challenge", async () => {
    const { result } = run({
      allowOrigin: "*",
      baselineStatus: 401,
      challenges: true,
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(strings(r, "findings").join(" ")).toContain(
      "Access-Control-Allow-Origin: *",
    );
  });

  it("fails a wildcard ACAO on an endpoint that admits an Authorization header", async () => {
    const { result } = run({
      allowOrigin: "*",
      allowHeaders: "content-type, authorization",
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Fail);
    expect(r.details?.["credentialAccepting"]).toBe(true);
  });

  it("warns when a credential-accepting endpoint answers identically with and without an Origin", async () => {
    const { result } = run({ allowHeaders: "content-type, authorization" });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Warn);
    expect(strings(r, "findings").join(" ")).toContain(
      "applies no Origin policy",
    );
  });

  // A public, unauthenticated endpoint has no session for a page to borrow.
  it("reports permissive CORS on an endpoint with no auth surface without scoring it", async () => {
    const { result } = run({ allowOrigin: "*" });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(strings(r, "notes").join(" ")).toContain("Reported, not scored");
  });

  it("passes an endpoint that answers 403 to a throwaway Origin", async () => {
    const { result } = run({
      originStatus: 403,
      allowHeaders: "content-type, authorization",
    });
    const r = await result;
    expect(r.status).toBe(CheckStatus.Pass);
    expect(r.details?.["originDifferentiates"]).toBe(true);
  });

  it("records X-Accel-Buffering when the endpoint sends it", async () => {
    const { result } = run({ accelBuffering: "no" });
    const r = await result;
    expect(strings(r, "notes").join(" ")).toContain("X-Accel-Buffering: no");
  });

  it("sends a throwaway .example Origin and at most three requests beyond discovery", async () => {
    const { result, requests } = run();
    await result;
    const origins = requests
      .map((o) => o.headers?.["Origin"])
      .filter(Boolean) as string[];
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins)
      expect(origin).toMatch(/^https:\/\/al-probe-[0-9a-f]{12}\.example$/);
    expect(
      requests.filter((o) => o.method === HttpMethod.Options),
    ).toHaveLength(1);
    expect(requests.length).toBeLessThanOrEqual(3);
  });

  it("is notApplicable on a malformed declaration and names the defect", async () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(
        JSON.stringify({ servers: [{ url: 7 }] }),
        200,
        "application/json",
      ),
    });
    const r = await audit.audit(ctx);
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.found).toBe("Malformed declaration (no-url)");
  });

  // Reachability belongs to mcp-modern-era-reachability; this audit declines.
  it("is notApplicable when the endpoint does not answer the baseline discover", async () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(
        JSON.stringify({ servers: [{ url: ENDPOINT }] }),
        200,
        "application/json",
      ),
    });
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const r = await audit.audit(ctx);
    expect(r.status).toBe(CheckStatus.NotApplicable);
    expect(r.found).toBe(`${ENDPOINT} did not answer`);
  });

  /** Baseline answers; the Origin-bearing POST and the preflight are scripted. */
  function partial(withOrigin: FetchResult | undefined) {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(
        JSON.stringify({ servers: [{ url: ENDPOINT }] }),
        200,
        "application/json",
      ),
    });
    ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
      if (o.method === HttpMethod.Options) throw new Error("socket hang up");
      const origin = o.headers?.["Origin"];
      if (!origin) return mockFetchResult('{"jsonrpc":"2.0"}', 200);
      if (!withOrigin) throw new Error("socket hang up");
      const res = { ...withOrigin, headers: { ...withOrigin.headers } };
      res.headers["access-control-allow-origin"] = origin;
      return res;
    };
    return ctx;
  }

  // With no preflight answer, the CORS headers on the Origin-bearing POST are
  // the ones a browser would act on.
  it("reads CORS headers off the Origin-bearing POST when the preflight gets no answer", async () => {
    const answer = mockFetchResult('{"jsonrpc":"2.0"}', 200);
    answer.headers["access-control-allow-credentials"] = "true";
    const r = AuditResultSchema.parse(await audit.audit(partial(answer)));
    expect(r.status).toBe(CheckStatus.Fail);
    expect(r.displayValue).toBe("Reflected origin + credentials");
    expect(r.details?.["preflightStatus"]).toBe(0);
    expect(r.found).toContain("preflight no answer");
  });

  it("passes with no CORS headers at all when neither probe beyond the baseline answers", async () => {
    const r = AuditResultSchema.parse(await audit.audit(partial(undefined)));
    expect(r.status).toBe(CheckStatus.Pass);
    expect(r.displayValue).toBe("no CORS headers");
    expect(r.found).toContain("with-Origin no answer, preflight no answer");
    expect(r.found).toContain('Access-Control-Allow-Origin "absent"');
    expect(r.details?.["originDifferentiates"]).toBe(false);
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = McpOriginValidationCorsAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.defaultPriority).toBe(CheckPriority.High);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
