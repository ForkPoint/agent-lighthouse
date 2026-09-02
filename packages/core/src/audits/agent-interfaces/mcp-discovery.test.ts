import { describe, it, expect } from "vitest";
import { McpDiscoveryAudit } from "./mcp-discovery";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";

describe("McpDiscoveryAudit", () => {
  const audit = new McpDiscoveryAudit();

  it("passes when servers.json has a servers array", () => {
    const body = JSON.stringify({
      servers: [
        {
          name: "MCP",
          url: "https://example.com/mcp",
          transport: "streamable-http",
        },
      ],
    });
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("1 server(s)");
  });

  // Neither path is registered or specified and no shipping MCP client is
  // documented as fetching either, so publishing nothing withholds nothing.
  // This used to be a scored fail at weight 1.0 -- a false FAIL on precisely
  // the sites running a real MCP server discovered by any other route.
  it("reports na when no MCP discovery document is published", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.message).toContain("no documented MCP client fetches");
  });

  it("reports na when servers.json returns 404", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.found).toContain("HTTP 404");
  });

  it("fails when servers.json is invalid JSON", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult("nope {{{", 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("not valid JSON");
  });

  it("fails when there is no servers array", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(
        JSON.stringify({ name: "x" }),
        200,
      ),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("carries no servers array");
  });

  // The shape of a discovery file without the discovery.
  it("fails an empty servers array", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/mcp/servers.json": mockFetchResult(
        JSON.stringify({ servers: [] }),
        200,
      ),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("lists no servers");
  });

  it("fails an empty UCP document rather than passing it", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/ucp": mockFetchResult("{}", 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("no services and no capabilities");
  });

  it("passes a UCP document that declares capabilities", () => {
    const ctx = mockCheckContext([], {
      "/.well-known/ucp": mockFetchResult(
        JSON.stringify({ version: "1.0", capabilities: { checkout: true } }),
        200,
      ),
    });
    expect(audit.audit(ctx).status).toBe("pass");
  });

  // Four of the five researched signals record `Consumers: none-known` and
  // recommend informative or delete. The fifth is a validation rule already
  // implemented by agent-interfaces/openapi-exists at the ratified path.
  it("is registered informative at weight 0", () => {
    const { meta } = McpDiscoveryAudit;
    expect(meta.evidenceGrade).toBe("C");
    expect(meta.tier).toBe("informative");
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe("informative");
  });
});
