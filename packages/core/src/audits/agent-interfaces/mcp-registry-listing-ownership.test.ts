import { describe, it, expect, vi } from "vitest";
import {
  McpRegistryListingOwnershipAudit,
  namespaceKind,
  parseListings,
} from "./mcp-registry-listing-ownership";
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
    isSafeUrl: async (url: string) =>
      url.startsWith("https://registry.modelcontextprotocol.io") ||
      url.startsWith("https://example.com"),
  };
});

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

const ENDPOINT = "https://mcp.example.com/mcp";
const VALID_PROOF = "v=MCPv1; k=ed25519; p=dGhpcyBpcyBhIGtleQ==";

/** One registry entry, in the shape the live API returns. */
function entry(
  name: string,
  remotes: Array<{ type: string; url: string }>,
  official: Record<string, unknown> = { status: "active", isLatest: true },
): Record<string, unknown> {
  return {
    server: { name, version: "1.2.0", remotes },
    _meta: { "io.modelcontextprotocol.registry/official": official },
  };
}

interface Site {
  /** Declare no MCP endpoint at all. */
  undeclared?: boolean;
  /** Registry entries returned by every search. */
  servers?: Array<Record<string, unknown>>;
  /** Body served at /.well-known/mcp-registry-auth; undefined means 404. */
  proof?: string;
}

function run(site: Site = {}) {
  const audit = new McpRegistryListingOwnershipAudit();
  const rootFiles: Record<string, FetchResult> = site.undeclared
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
    if (o.url.startsWith("https://registry.modelcontextprotocol.io")) {
      return mockFetchResult(
        JSON.stringify({ servers: site.servers ?? [], metadata: { count: 0 } }),
        200,
        "application/json",
      );
    }
    if (site.proof === undefined) return mockFetchResult("", 404);
    return mockFetchResult(site.proof, 200);
  };

  return { result: audit.audit(ctx), requests };
}

const FIRST_PARTY = () =>
  entry("com.example/analytics", [{ type: "streamable-http", url: ENDPOINT }]);

describe("McpRegistryListingOwnershipAudit", () => {
  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(new McpRegistryListingOwnershipAudit());
  });

  it("is notApplicable when the site declares no MCP endpoint", async () => {
    const { result, requests } = run({ undeclared: true });
    expect((await result).status).toBe("na");
    expect(requests).toHaveLength(0);
  });

  it("sends two searches and one proof request, and never paginates", async () => {
    const { result, requests } = run({
      servers: [FIRST_PARTY()],
      proof: VALID_PROOF,
    });
    await result;
    expect(requests).toHaveLength(3);
    expect(requests[0]?.url).toBe(
      "https://registry.modelcontextprotocol.io/v0.1/servers?search=example.com",
    );
    expect(requests[1]?.url).toBe(
      "https://registry.modelcontextprotocol.io/v0.1/servers?search=example",
    );
    expect(requests[2]?.url).toBe(
      "https://example.com/.well-known/mcp-registry-auth",
    );
    expect(requests.some((r) => r.url.includes("cursor"))).toBe(false);
  });

  it("passes a first-party listing whose ownership proof is served", async () => {
    const { result } = run({ servers: [FIRST_PARTY()], proof: VALID_PROOF });
    const r = await result;
    expect(r.status).toBe("pass");
    expect(r.details?.["ownershipProof"]).toBe("valid");
    expect(r.details?.["firstPartyListings"]).toBe(1);
  });

  it("fails a first-party listing whose proof is missing", async () => {
    const { result } = run({ servers: [FIRST_PARTY()] });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(r.details?.["ownershipProof"]).toBe("absent");
    expect(strings(r, "failures")[0]).toContain(
      "/.well-known/mcp-registry-auth",
    );
  });

  it("fails a first-party listing whose proof does not match the grammar", async () => {
    const { result } = run({
      servers: [FIRST_PARTY()],
      proof: "MCPv1 ed25519 abc",
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(r.details?.["ownershipProof"]).toBe("malformed");
  });

  it("fails when no registry listing names a server on this domain", async () => {
    const { result } = run({ servers: [], proof: VALID_PROOF });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "failures")[0]).toContain("No registry listing");
  });

  // The join key is the remote host. A name carrying the brand proves nothing.
  it("ignores an entry whose name mentions the domain but whose remotes point elsewhere", async () => {
    const { result } = run({
      servers: [
        entry("com.example/analytics", [
          { type: "streamable-http", url: "https://evil.test/mcp" },
        ]),
      ],
      proof: VALID_PROOF,
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "listings")).toHaveLength(0);
  });

  it("matches a remote on a subdomain of the audited apex", async () => {
    const { result } = run({ servers: [FIRST_PARTY()], proof: VALID_PROOF });
    expect(strings(await result, "listings")[0]).toContain("first-party");
  });

  it("fails an aggregator-only listing and names the proxying host", async () => {
    const { result } = run({
      servers: [
        entry("ai.smithery/example-analytics", [
          { type: "streamable-http", url: ENDPOINT },
          {
            type: "streamable-http",
            url: "https://server.smithery.ai/@example/analytics/mcp",
          },
        ]),
      ],
      proof: VALID_PROOF,
    });
    const r = await result;
    expect(r.status).toBe("fail");
    expect(strings(r, "warnings").join(" ")).toContain("server.smithery.ai");
    expect(r.details?.["firstPartyListings"]).toBe(0);
  });

  // An account-bound listing is at least held by somebody who can update it.
  it("warns rather than fails when the only listing is bound to a GitHub account", async () => {
    const { result } = run({
      servers: [
        entry("io.github.alice/example-analytics", [
          { type: "streamable-http", url: ENDPOINT },
        ]),
      ],
      proof: VALID_PROOF,
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("GitHub account");
  });

  it("warns on a listing that is not active or not the latest version", async () => {
    const stale = run({
      servers: [
        entry(
          "com.example/analytics",
          [{ type: "streamable-http", url: ENDPOINT }],
          {
            status: "active",
            isLatest: false,
          },
        ),
      ],
      proof: VALID_PROOF,
    });
    expect((await stale.result).status).toBe("warn");
    expect(strings(await stale.result, "warnings").join(" ")).toContain(
      "not the latest",
    );

    const deleted = run({
      servers: [
        entry(
          "com.example/analytics",
          [{ type: "streamable-http", url: ENDPOINT }],
          {
            status: "deleted",
            isLatest: true,
          },
        ),
      ],
      proof: VALID_PROOF,
    });
    expect(strings(await deleted.result, "warnings").join(" ")).toContain(
      '"deleted"',
    );
  });

  it("warns on a listing that offers only the deprecated sse transport", async () => {
    const { result } = run({
      servers: [
        entry("com.example/analytics", [{ type: "sse", url: ENDPOINT }]),
      ],
      proof: VALID_PROOF,
    });
    const r = await result;
    expect(r.status).toBe("warn");
    expect(strings(r, "warnings").join(" ")).toContain("sse");
  });

  it("classifies namespaces by prefix", () => {
    expect(namespaceKind("com.example/analytics", "example.com")).toBe(
      "first-party",
    );
    expect(namespaceKind("io.github.alice/thing", "example.com")).toBe(
      "github-account",
    );
    expect(namespaceKind("ai.smithery/example", "example.com")).toBe(
      "aggregator",
    );
    // A namespace that merely starts with the same letters is not the domain.
    expect(namespaceKind("com.example-evil/thing", "example.com")).toBe(
      "aggregator",
    );
  });

  it("parses the live response shape and tolerates junk", () => {
    expect(parseListings("not json")).toEqual([]);
    expect(
      parseListings(JSON.stringify({ servers: [{}, 3, null] })),
    ).toHaveLength(1);
    const parsed = parseListings(JSON.stringify({ servers: [FIRST_PARTY()] }));
    expect(parsed[0]?.name).toBe("com.example/analytics");
    expect(parsed[0]?.status).toBe("active");
    expect(parsed[0]?.isLatest).toBe(true);
  });
});
