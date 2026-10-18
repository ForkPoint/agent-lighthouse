import { describe, it, expect } from "vitest";
import { UcpProfileAudit } from "./ucp-profile";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus } from "#core/types";

/** The shape Google's Merchant UCP guide publishes for version 2026-04-08. */
function profile(
  ucp: Record<string, unknown> = {},
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ucp: {
      version: "2026-04-08",
      services: {
        "dev.ucp.shopping": [
          {
            version: "2026-04-08",
            transport: "rest",
            endpoint: "https://example.com/ucp/v1",
          },
        ],
      },
      capabilities: {
        "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
      },
      ...ucp,
    },
    signing_keys: [{ kid: "k1", kty: "EC" }],
    ...over,
  };
}

const withUcp = (body: Record<string, unknown> | string, status = 200) =>
  mockCheckContext([], {
    "/.well-known/ucp": mockFetchResult(
      typeof body === "string" ? body : JSON.stringify(body),
      status,
      "application/json",
    ),
  });

describe("UcpProfileAudit", () => {
  const audit = new UcpProfileAudit();

  it("passes the profile shape Google documents", () => {
    const result = audit.audit(withUcp(profile()));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  it("is not applicable when no profile is published", () => {
    expect(audit.audit(mockCheckContext([], {})).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("is not applicable on a 404 or a 403", () => {
    expect(audit.audit(withUcp("nope", 404)).status).toBe(
      CheckStatus.NotApplicable,
    );
    expect(audit.audit(withUcp("denied", 403)).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("treats an HTML 200 stand-in as absent", () => {
    expect(
      audit.audit(withUcp("<!doctype html><html><body></body></html>")).status,
    ).toBe(CheckStatus.NotApplicable);
  });

  it("fails a body that does not parse as JSON", () => {
    expect(audit.audit(withUcp("{ ucp: ")).status).toBe(CheckStatus.Fail);
  });

  it("treats JSON with no ucp key as absent, not as a broken profile", () => {
    const result = audit.audit(
      withUcp({ services: { "dev.ucp.shopping": [] } }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable when the server answers every well-known path with the same unrelated JSON", () => {
    const result = audit.audit(
      withUcp({ gpc: true, lastUpdate: "2026-01-01" }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("no `ucp` key");
  });

  it("fails a profile whose ucp key is not an object", () => {
    const result = audit.audit(withUcp({ ucp: "2026-08-25" }));
    expect(result.status).toBe(CheckStatus.Fail);
  });

  it("fails a profile that declares no services", () => {
    const result = audit.audit(withUcp(profile({ services: {} })));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("services");
  });

  it("warns when the version is missing", () => {
    const result = audit.audit(withUcp(profile({ version: undefined })));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("version");
  });

  it("passes a profile with no capabilities: the spec says they MAY be omitted", () => {
    const result = audit.audit(withUcp(profile({ capabilities: undefined })));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("passes an embedded binding with no endpoint: endpoint is optional", () => {
    const result = audit.audit(
      withUcp(
        profile({
          services: {
            "dev.ucp.shopping": [
              {
                version: "2026-08-25",
                transport: "rest",
                endpoint: "https://example.com/ucp/v1",
              },
              {
                version: "2026-08-25",
                transport: "embedded",
                schema: "https://ucp.dev/schemas/embedded.json",
              },
            ],
          },
        }),
      ),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reads the 2026-01-11 shape: transport objects and a capabilities array", () => {
    const result = audit.audit(
      withUcp({
        ucp: {
          version: "2026-01-11",
          services: {
            "dev.ucp.shopping": {
              version: "2026-01-11",
              rest: {
                schema: "https://ucp.dev/services/shopping/openapi.json",
                endpoint: "https://example.com/ucp/v1",
              },
              embedded: {
                schema: "https://ucp.dev/services/shopping/embedded.json",
              },
            },
          },
          capabilities: [
            { name: "dev.ucp.shopping.checkout", version: "2026-01-11" },
            { name: "dev.ucp.shopping.fulfillment", version: "2026-01-11" },
          ],
        },
        signing_keys: [{ kid: "k1" }],
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["capabilities"]).toBe(2);
    expect(result.details?.["signingKeys"]).toBe(1);
  });

  it("warns on a non-https endpoint in the 2026-01-11 shape", () => {
    const result = audit.audit(
      withUcp({
        ucp: {
          version: "2026-01-11",
          services: {
            "dev.ucp.shopping": {
              rest: { endpoint: "http://example.com/ucp" },
            },
          },
        },
      }),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("http://example.com/ucp");
  });

  it("counts signing keys from the current top-level keys array", () => {
    const result = audit.audit(
      withUcp(
        profile(
          {},
          { signing_keys: undefined, keys: [{ kid: "a" }, { kid: "b" }] },
        ),
      ),
    );
    expect(result.details?.["signingKeys"]).toBe(2);
  });

  it("warns on a service endpoint that is not absolute https", () => {
    const result = audit.audit(
      withUcp(
        profile({
          services: {
            "dev.ucp.shopping": [
              { version: "2026-04-08", transport: "rest", endpoint: "/ucp/v1" },
            ],
          },
        }),
      ),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("https");
  });

  it("carries only scalar details", () => {
    const result = audit.audit(withUcp(profile()));
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
    expect(result.details?.["services"]).toBe(1);
  });
});
