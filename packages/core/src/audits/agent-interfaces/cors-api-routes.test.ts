import { describe, it, expect, vi } from "vitest";
import { CorsApiRoutesAudit } from "./cors-api-routes";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { FetchOptions, FetchResult } from "../../fetcher";

// isSafeUrl performs a real DNS lookup before the audit probes a `servers[].url`
// it read out of a site-controlled document. Stub it with an offline stand-in
// that still blocks loopback and private ranges, so the refusal test proves the
// gate rather than the mock.
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

function spec(doc: Record<string, unknown>): FetchResult {
  return mockFetchResult(JSON.stringify(doc), 200, "application/json");
}

const simpleSpec = spec({
  openapi: "3.1.0",
  info: { title: "API", version: "1" },
  servers: [{ url: "https://example.com/api" }],
  paths: { "/products": { get: {} } },
});

/** A fetch stub that records every probed URL and answers with the given ACAO. */
function corsFetch(acao?: string, status = 204) {
  const seen: string[] = [];
  const fetch = async (options: FetchOptions): Promise<FetchResult> => {
    seen.push(`${options.method ?? "GET"} ${options.url}`);
    const r = mockFetchResult("", status);
    if (acao !== undefined) r.headers["access-control-allow-origin"] = acao;
    return r;
  };
  return { fetch, seen };
}

describe("CorsApiRoutesAudit", () => {
  const audit = new CorsApiRoutesAudit();

  it("returns na on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  describe("applicability — no API surface, nothing to say", () => {
    // Every ordinary content site used to lose half a point on an API check
    // that did not apply to it.
    it("is na when no OpenAPI document is published", async () => {
      const result = await audit.audit(mockCheckContext([], {}));
      expect(result.status).toBe("na");
      expect(result.status).not.toBe("warn");
    });

    it("is na when /openapi.json is an SPA HTML soft-404", async () => {
      const ctx = mockCheckContext([], {
        "/openapi.json": mockFetchResult(
          "<!doctype html><html></html>",
          200,
          "text/html",
        ),
      });
      expect((await audit.audit(ctx)).status).toBe("na");
    });

    it("is na when /openapi.json is served but is not an OpenAPI document", async () => {
      const ctx = mockCheckContext([], {
        "/openapi.json": mockFetchResult(
          '{"hello":1}',
          200,
          "application/json",
        ),
      });
      expect((await audit.audit(ctx)).status).toBe("na");
    });

    // The dead gate arm: /swagger.json is not in the orchestrator's
    // rootFilePaths, so ctx.rootFiles['/swagger.json'] was always undefined.
    it("does not reference /swagger.json at all", () => {
      expect(JSON.stringify(CorsApiRoutesAudit.meta)).not.toContain(
        "swagger.json",
      );
    });

    it("never returns fail", async () => {
      const { fetch } = corsFetch(undefined);
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = fetch;
      expect((await audit.audit(ctx)).status).not.toBe("fail");
    });
  });

  describe("spec-driven probing", () => {
    it("probes the declared server and path, not a hardcoded /api/", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [{ url: "https://api.example.com/v1" }],
          paths: { "/products": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("pass");
      expect(seen.join(" ")).toContain("https://api.example.com/v1/products");
      expect(seen.join(" ")).not.toContain("https://example.com/api/");
    });

    it("resolves a relative server url against the site base", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [{ url: "/v2" }],
          paths: { "/orders": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      await audit.audit(ctx);
      expect(seen.join(" ")).toContain("https://example.com/v2/orders");
    });

    it("defaults to the site root when the spec declares no servers", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          paths: { "/ping": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      await audit.audit(ctx);
      expect(seen.join(" ")).toContain("https://example.com/ping");
    });

    it("skips templated paths and probes a concrete one", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [{ url: "https://example.com/api" }],
          paths: { "/products/{id}": { get: {} }, "/products": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      await audit.audit(ctx);
      expect(seen).toContain("OPTIONS https://example.com/api/products");
      expect(seen.join(" ")).not.toContain("{id}");
    });

    it("substitutes server variable defaults", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [
            {
              url: "https://{region}.example.com/v1",
              variables: { region: { default: "eu" } },
            },
          ],
          paths: { "/ping": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      await audit.audit(ctx);
      expect(seen.join(" ")).toContain("https://eu.example.com/v1/ping");
    });

    it("sends OPTIONS first and falls back to GET when the preflight carries no ACAO", async () => {
      const seen: string[] = [];
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = async (options) => {
        seen.push(options.method ?? "GET");
        const r = mockFetchResult("", 204);
        if (options.method === "GET")
          r.headers["access-control-allow-origin"] = "*";
        return r;
      };
      const result = await audit.audit(ctx);
      expect(seen).toContain("OPTIONS");
      expect(seen).toContain("GET");
      expect(result.status).toBe("pass");
    });

    it("refuses to probe a private-address server url", async () => {
      const { fetch, seen } = corsFetch("*");
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [{ url: "http://192.168.1.10/internal" }],
          paths: { "/ping": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(seen).toHaveLength(0);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("not safe to probe");
    });

    it("warns when every probe throws", async () => {
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = async () => {
        throw new Error("network");
      };
      const result = await audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("could not be reached");
    });
  });

  describe("an ACAO that actually admits a third-party origin", () => {
    it("passes on a wildcard", async () => {
      const { fetch } = corsFetch("*");
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("pass");
      expect(result.found).toContain("*");
    });

    // The old test asserted this passes. A single named origin admits that
    // origin and nothing else, so no agent sandbox matches it.
    it("warns on a narrow named origin", async () => {
      const { fetch } = corsFetch("https://trusted.example.com");
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("one named origin");
    });

    it("warns on a same-origin-only ACAO", async () => {
      const { fetch } = corsFetch("https://example.com");
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("own origin");
    });

    it("warns when no probed endpoint carries an ACAO", async () => {
      const { fetch } = corsFetch(undefined);
      const ctx = mockCheckContext([], { "/openapi.json": simpleSpec });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.found).toContain("1 of 1 endpoint(s) answered");
      expect(result.found).toContain("none with Access-Control-Allow-Origin");
    });
  });

  // A finding that says "none of them" when half the probes never landed
  // describes a site that was never measured.
  describe("unreachable probes are not counted as answers", () => {
    it("names how many endpoints answered and how many did not", async () => {
      const { fetch } = corsFetch(undefined);
      const ctx = mockCheckContext([], {
        "/openapi.json": spec({
          openapi: "3.1.0",
          servers: [
            { url: "https://example.com/api" },
            { url: "http://192.168.1.10/internal" },
          ],
          paths: { "/products": { get: {} } },
        }),
      });
      ctx.fetch = fetch;
      const result = await audit.audit(ctx);
      expect(result.status).toBe("warn");
      expect(result.found).toContain("1 of 2 endpoint(s) answered");
      expect(result.found).toContain("1 unreachable");
    });
  });

  describe("meta contract", () => {
    const meta = CorsApiRoutesAudit.meta;

    it("is grade C, informative, weight 0", () => {
      expect(meta.id).toBe("agent-interfaces/cors-api-routes");
      expect(meta.evidenceGrade).toBe("C");
      expect(meta.tier).toBe("informative");
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe("informative");
    });

    // "Blocks all agentic workflows" is false: every server-side crawler and
    // MCP client is a non-browser HTTP client, unaffected by CORS.
    it("scopes the claim to browser-sandboxed agents", () => {
      const copy = JSON.stringify(meta);
      expect(copy).not.toContain("blocks all agentic workflows");
      // MCP clients may still be named — but only to say they are unaffected,
      // which is the correction, not the original claim.
      expect(copy).toContain("MCP clients are not browsers");
      expect(copy).toContain("Apps SDK");
    });

    it("drops the priority to low", () => {
      expect(meta.defaultPriority).toBe("low");
    });
  });
});
