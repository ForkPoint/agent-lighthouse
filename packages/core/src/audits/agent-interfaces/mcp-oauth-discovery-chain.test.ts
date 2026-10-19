import { describe, it, expect, vi } from "vitest";
import { McpOauthDiscoveryChainAudit } from "./mcp-oauth-discovery-chain";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus, HttpMethod } from "#core/types";

// isSafeUrl resolves DNS before any metadata URL read out of site-controlled
// JSON is fetched. Offline stand-in, still blocking loopback and private ranges.
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

const ENDPOINT = "https://api.example.com/mcp";
const PRM_URL =
  "https://api.example.com/.well-known/oauth-protected-resource/mcp";
const PRM_ROOT = "https://api.example.com/.well-known/oauth-protected-resource";
const ISSUER = "https://auth.example.com";
const AS_URL =
  "https://auth.example.com/.well-known/oauth-authorization-server";

function servers(): Record<string, FetchResult> {
  return {
    "/.well-known/mcp/servers.json": mockFetchResult(
      JSON.stringify({ servers: [{ url: ENDPOINT }] }),
      200,
      "application/json",
    ),
  };
}

function json(payload: unknown, status = 200): FetchResult {
  return mockFetchResult(JSON.stringify(payload), status, "application/json");
}

function challenge(resourceMetadata = PRM_URL, header?: string): FetchResult {
  const res = mockFetchResult("", 401, "text/plain");
  res.headers["www-authenticate"] =
    header ??
    `Bearer resource_metadata="${resourceMetadata}", scope="mcp:tools"`;
  return res;
}

const PRM = {
  resource: ENDPOINT,
  resource_name: "Acme MCP",
  authorization_servers: [ISSUER],
  scopes_supported: ["mcp:tools"],
};

const AS_META = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  code_challenge_methods_supported: ["S256"],
  authorization_response_iss_parameter_supported: true,
};

type Result = { status: string; message: string; found: string };

/**
 * Wire up one scan. `docs` maps an absolute URL to its response; anything else
 * answers 404, and the MCP endpoint itself answers `discover`.
 */
function wire(discover: FetchResult, docs: Record<string, FetchResult>) {
  const seen: string[] = [];
  const ctx: CheckContext = mockCheckContext([], servers());
  ctx.fetch = async (o: FetchOptions) => {
    seen.push(o.url);
    if (o.url === ENDPOINT && o.method === HttpMethod.Post) return discover;
    return docs[o.url] ?? mockFetchResult("Not Found", 404, "text/plain");
  };
  return { ctx, seen };
}

function run(discover: FetchResult, docs: Record<string, FetchResult>) {
  const w = wire(discover, docs);
  return new McpOauthDiscoveryChainAudit()
    .audit(w.ctx)
    .then((r) => ({ ...w, result: r as Result }));
}

const HEALTHY: Record<string, FetchResult> = {
  [PRM_URL]: json(PRM),
  [AS_URL]: json(AS_META),
};

describe("McpOauthDiscoveryChainAudit", () => {
  const audit = new McpOauthDiscoveryChainAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const ctx: CheckContext = mockCheckContext([]);
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("follows the chain from the URL the challenge advertises", async () => {
    const { result, seen } = await run(challenge(), HEALTHY);
    expect(seen).toContain(PRM_URL);
    expect(seen).toContain(AS_URL);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // Without resource_metadata a client falls back, and RFC 9728 §3 fixes the
  // order: the path-suffixed URL first, then the bare well-known.
  it("records the fallback and probes both RFC 9728 §3 URLs in spec order", async () => {
    const { result, seen } = await run(challenge("", "Bearer"), {
      [PRM_ROOT]: json(PRM),
      [AS_URL]: json(AS_META),
    });
    const probes = seen.filter((u) => u.includes("oauth-protected-resource"));
    expect(probes).toEqual([PRM_URL, PRM_ROOT]);
    expect(result.message).toContain("fall back");
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // The single highest-value assertion in the whole chain.
  it("fails when the PRM resource is not string-identical to the canonical server URI", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, resource: `${ENDPOINT}/` }),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("resource");
    expect(result.message).toContain("drift");
  });

  it("fails when authorization_servers is absent", async () => {
    const { authorization_servers: _drop, ...withoutAs } = PRM;
    const { result } = await run(challenge(), { [PRM_URL]: json(withoutAs) });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("authorization_servers");
  });

  it("fails when authorization_servers is an empty array", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: [] }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("authorization_servers");
  });

  // The gate must produce a named finding, not a silent skip.
  it("fails an authorization server on a private address, naming the range", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: ["https://10.0.0.1"] }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("https://10.0.0.1");
    expect(result.message).toContain("private");
  });

  it("warns when scopes_supported advertises offline_access", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({
        ...PRM,
        scopes_supported: ["mcp:tools", "offline_access"],
      }),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("offline_access");
  });

  it("warns on an omnibus scope and names it", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, scopes_supported: ["*"] }),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("omnibus");
  });

  it("fails when the AS metadata issuer is not string-identical to the issuer used", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json(PRM),
      [AS_URL]: json({ ...AS_META, issuer: "https://auth.example.com/" }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("issuer");
  });

  it("warns when the AS does not advertise S256", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json(PRM),
      [AS_URL]: json({
        ...AS_META,
        code_challenge_methods_supported: ["plain"],
      }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("S256");
  });

  it("fails when no authorization server metadata answers", async () => {
    const { result } = await run(challenge(), { [PRM_URL]: json(PRM) });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("publishes no metadata");
  });

  it("fails a server that challenges but publishes no PRM anywhere", async () => {
    const { result } = await run(challenge(), {});
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no Protected Resource Metadata");
  });

  // A 200 is a positive pre-consent signal, and the probing still runs because
  // privileged tools may sit behind a PRM the open surface never mentions.
  it("records an unauthenticated 200 as a positive signal and still probes the well-knowns", async () => {
    const ok = mockFetchResult(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "al-1",
        result: { supportedVersions: ["2026-07-28"] },
      }),
      200,
      "application/json",
    );
    const { result, seen } = await run(ok, {
      [PRM_ROOT]: json(PRM),
      [AS_URL]: json(AS_META),
    });
    expect(seen).toContain(PRM_URL);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("before consent");
  });

  it("is notApplicable for an open endpoint that publishes no PRM at all", async () => {
    const ok = mockFetchResult(
      '{"jsonrpc":"2.0","id":"al-1","result":{}}',
      200,
      "application/json",
    );
    const { result } = await run(ok, {});
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("fails a non-Bearer challenge scheme", async () => {
    const { result } = await run(challenge("", 'Basic realm="mcp"'), HEALTHY);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("Bearer");
  });

  it("is notApplicable on a malformed declaration and names the defect", async () => {
    const ctx: CheckContext = mockCheckContext([], {
      "/.well-known/mcp/servers.json": json({ mcp: [] }),
    });
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toBe("Malformed declaration (no-array)");
  });

  // Reachability belongs to mcp-modern-era-reachability; this audit declines.
  it("is notApplicable when the endpoint does not answer at all", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async () => {
      throw new Error("socket hang up");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("mcp-modern-era-reachability");
    expect(result.found).toBe(`${ENDPOINT}; endpoint unreachable`);
  });

  it("fails a 401 that carries no WWW-Authenticate header at all", async () => {
    const bare = mockFetchResult("", 401, "text/plain");
    const { result } = await run(bare, {
      [PRM_ROOT]: json(PRM),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("`WWW-Authenticate: (absent)`");
    expect(result.found).toContain("challenge without resource_metadata");
  });

  // An endpoint at the origin root has no path suffix, so RFC 9728 §3 leaves a
  // single well-known URL to try.
  it("probes only the bare well-known for an endpoint at the origin root", async () => {
    const root = "https://api.example.com/";
    const seen: string[] = [];
    const ctx: CheckContext = mockCheckContext([], {
      "/.well-known/mcp/servers.json": json({ servers: [{ url: root }] }),
    });
    ctx.fetch = async (o: FetchOptions) => {
      seen.push(o.url);
      if (o.method === HttpMethod.Post) return challenge("", "Bearer");
      if (o.url === PRM_ROOT)
        return json({ ...PRM, resource: "https://api.example.com" });
      if (o.url === AS_URL) return json(AS_META);
      return mockFetchResult("Not Found", 404, "text/plain");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(seen.filter((u) => u.includes("oauth-protected-resource"))).toEqual([
      PRM_ROOT,
    ]);
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // RFC 8414 §3.1 inserts the well-known segment before an issuer's path; the
  // OIDC variants follow.
  it("reads AS metadata for an issuer with a path from the path-inserted well-known", async () => {
    const tenant = "https://auth.example.com/tenant1";
    const insertedOidc =
      "https://auth.example.com/.well-known/openid-configuration/tenant1";
    const { result, seen } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: [tenant] }),
      [insertedOidc]: json({ ...AS_META, issuer: tenant }),
    });
    expect(seen).toContain(
      "https://auth.example.com/.well-known/oauth-authorization-server/tenant1",
    );
    expect(seen).toContain(insertedOidc);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("AS metadata read 1");
  });

  it("falls through a metadata URL whose fetch throws to the next candidate", async () => {
    const ctx: CheckContext = mockCheckContext([], servers());
    ctx.fetch = async (o: FetchOptions) => {
      if (o.url === ENDPOINT) return challenge();
      if (o.url === PRM_URL) throw new Error("socket hang up");
      if (o.url === PRM_ROOT) return json(PRM);
      if (o.url === AS_URL) return json(AS_META);
      return mockFetchResult("Not Found", 404, "text/plain");
    };
    const result = (await audit.audit(ctx)) as Result;
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain(`PRM ${PRM_ROOT}`);
  });

  it("does not accept a PRM document that is JSON but not an object", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json([PRM]),
      [PRM_ROOT]: json(["not", "metadata"]),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no Protected Resource Metadata");
    expect(result.found).toContain("3 URL(s) probed");
  });

  it("fails a PRM with no resource value", async () => {
    const { resource: _drop, ...withoutResource } = PRM;
    const { result } = await run(challenge(), {
      [PRM_URL]: json(withoutResource),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("no `resource` value");
  });

  it("fails a plain-http authorization server", async () => {
    const http = "http://auth.example.com";
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: [http] }),
      "http://auth.example.com/.well-known/oauth-authorization-server": json({
        ...AS_META,
        issuer: http,
      }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain(`"${http}" is not an https URL`);
  });

  it("fails an authorization server that is not an absolute URL without probing it", async () => {
    const { result, seen } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: ["auth-server"] }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain('"auth-server" is not an absolute URL');
    expect(result.message).not.toContain("publishes no metadata");
    expect(seen.filter((u) => u.includes("authorization-server"))).toEqual([]);
    expect(result.found).toContain("AS metadata read 0");
  });

  it("fails an AS whose metadata names no authorization or token endpoint", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json(PRM),
      [AS_URL]: json({ issuer: ISSUER }),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("declares no `authorization_endpoint`");
    expect(result.message).toContain("declares no `token_endpoint`");
  });

  it("warns on the RECOMMENDED items: resource_name, scopes_supported and RFC 9207", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ resource: ENDPOINT, authorization_servers: [ISSUER] }),
      [AS_URL]: json({
        ...AS_META,
        authorization_response_iss_parameter_supported: false,
      }),
    });
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("no `resource_name`");
    expect(result.message).toContain("no `scopes_supported`");
    expect(result.message).toContain(
      "authorization_response_iss_parameter_supported",
    );
    expect(result.found).toContain("scopes none declared");
  });

  // A status that is neither a challenge nor an open answer adds no note.
  it("records a non-401, non-200 discover status without a challenge note", async () => {
    const forbidden = mockFetchResult("Forbidden", 403, "text/plain");
    const { result } = await run(forbidden, {
      [PRM_ROOT]: json(PRM),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("challenge absent (HTTP 403)");
    expect(result.message).not.toContain("Also:");
  });
});
