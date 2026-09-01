import { describe, it, expect, vi } from "vitest";
import { McpOriginValidationCorsAudit } from "./mcp-origin-validation-cors";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
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
  allowOrigin?: "reflect" | string;
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

    if (o.method === "OPTIONS") {
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
    expect((await result).status).toBe("na");
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
    expect(r.status).toBe("fail");
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
    expect(r.status).toBe("fail");
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
    expect(r.status).toBe("fail");
    expect(r.details?.["credentialAccepting"]).toBe(true);
  });

  it("warns when a credential-accepting endpoint answers identically with and without an Origin", async () => {
    const { result } = run({ allowHeaders: "content-type, authorization" });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "findings").join(" ")).toContain(
      "applies no Origin policy",
    );
  });

  // A public, unauthenticated endpoint has no session for a page to borrow.
  it("reports permissive CORS on an endpoint with no auth surface without scoring it", async () => {
    const { result } = run({ allowOrigin: "*" });
    const r = await result;
    expect(r.status).toBe("pass");
    expect(strings(r, "notes").join(" ")).toContain("Reported, not scored");
  });

  it("passes an endpoint that answers 403 to a throwaway Origin", async () => {
    const { result } = run({
      originStatus: 403,
      allowHeaders: "content-type, authorization",
    });
    const r = await result;
    expect(r.status).toBe("pass");
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
    expect(requests.filter((o) => o.method === "OPTIONS")).toHaveLength(1);
    expect(requests.length).toBeLessThanOrEqual(3);
  });

  it("registers as a scored grade-B audit", () => {
    const { meta } = McpOriginValidationCorsAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.defaultPriority).toBe("high");
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
