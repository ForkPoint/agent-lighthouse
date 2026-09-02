import { describe, it, expect, vi } from "vitest";
import { McpOauthDiscoveryChainAudit } from "./mcp-oauth-discovery-chain";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchOptions, FetchResult } from "../../fetcher";

// isSafeUrl resolves DNS before any metadata URL read out of site-controlled
// JSON is fetched. Offline stand-in, still blocking loopback and private ranges.
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
    if (o.url === ENDPOINT && o.method === "POST") return discover;
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
    expect(result.status).toBe("na");
  });

  it("follows the chain from the URL the challenge advertises", async () => {
    const { result, seen } = await run(challenge(), HEALTHY);
    expect(seen).toContain(PRM_URL);
    expect(seen).toContain(AS_URL);
    expect(result.status).toBe("pass");
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
    expect(result.status).toBe("pass");
  });

  // The single highest-value assertion in the whole chain.
  it("fails when the PRM resource is not string-identical to the canonical server URI", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, resource: `${ENDPOINT}/` }),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("resource");
    expect(result.message).toContain("drift");
  });

  it("fails when authorization_servers is absent", async () => {
    const { authorization_servers: _drop, ...withoutAs } = PRM;
    const { result } = await run(challenge(), { [PRM_URL]: json(withoutAs) });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("authorization_servers");
  });

  it("fails when authorization_servers is an empty array", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: [] }),
    });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("authorization_servers");
  });

  // The gate must produce a named finding, not a silent skip.
  it("fails an authorization server on a private address, naming the range", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, authorization_servers: ["https://10.0.0.1"] }),
    });
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("warn");
    expect(result.message).toContain("offline_access");
  });

  it("warns on an omnibus scope and names it", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json({ ...PRM, scopes_supported: ["*"] }),
      [AS_URL]: json(AS_META),
    });
    expect(result.status).toBe("warn");
    expect(result.message).toContain("omnibus");
  });

  it("fails when the AS metadata issuer is not string-identical to the issuer used", async () => {
    const { result } = await run(challenge(), {
      [PRM_URL]: json(PRM),
      [AS_URL]: json({ ...AS_META, issuer: "https://auth.example.com/" }),
    });
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("warn");
    expect(result.message).toContain("S256");
  });

  it("fails when no authorization server metadata answers", async () => {
    const { result } = await run(challenge(), { [PRM_URL]: json(PRM) });
    expect(result.status).toBe("fail");
    expect(result.message).toContain("publishes no metadata");
  });

  it("fails a server that challenges but publishes no PRM anywhere", async () => {
    const { result } = await run(challenge(), {});
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("pass");
    expect(result.message).toContain("before consent");
  });

  it("is notApplicable for an open endpoint that publishes no PRM at all", async () => {
    const ok = mockFetchResult(
      '{"jsonrpc":"2.0","id":"al-1","result":{}}',
      200,
      "application/json",
    );
    const { result } = await run(ok, {});
    expect(result.status).toBe("na");
  });

  it("fails a non-Bearer challenge scheme", async () => {
    const { result } = await run(challenge("", 'Basic realm="mcp"'), HEALTHY);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Bearer");
  });
});
