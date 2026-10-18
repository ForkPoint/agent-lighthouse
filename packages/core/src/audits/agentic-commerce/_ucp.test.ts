import { describe, it, expect } from "vitest";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { NO_UCP_PROFILE, UCP_PATH, readUcpProfile, ucpBindings } from "./_ucp";

const served = (body: string) =>
  mockCheckContext([], {
    [UCP_PATH]: mockFetchResult(body, 200, "application/json"),
  });

describe("readUcpProfile", () => {
  it("reads a site with no fetched profile as absent", () => {
    const read = readUcpProfile(mockCheckContext([], {}));
    expect(read).toEqual({ kind: "absent", found: NO_UCP_PROFILE.found });
  });

  it("names the miss when the path answers something other than a profile", () => {
    const read = readUcpProfile(
      mockCheckContext([], { [UCP_PATH]: mockFetchResult("", 404) }),
    );
    expect(read.kind).toBe("absent");
    expect(read.kind === "absent" && read.found).toContain(`${UCP_PATH}: `);
  });

  // Some servers answer every well-known path with the same unrelated JSON.
  it("reads an empty JSON object as absent, naming no keys", () => {
    const read = readUcpProfile(served("{}"));
    expect(read).toEqual({
      kind: "absent",
      found: `${UCP_PATH}: JSON with no \`ucp\` key (keys: none), so not a UCP profile`,
    });
  });

  it("lists at most five keys of an unrelated JSON document", () => {
    const read = readUcpProfile(
      served(JSON.stringify({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })),
    );
    expect(read.kind === "absent" && read.found).toContain(
      "(keys: a, b, c, d, e)",
    );
  });

  it.each([
    ["{ not json", "HTTP 200, but the body does not parse as JSON"],
    ["[1, 2]", "HTTP 200, but the JSON is not an object"],
  ])("reads %s as broken, not only at the ucp key", (body, found) => {
    expect(readUcpProfile(served(body))).toEqual({
      kind: "broken",
      ucpKeyOnly: false,
      found,
    });
  });

  it("reads a ucp key that is not an object as broken at that key", () => {
    expect(readUcpProfile(served('{"ucp": "2026-04-08"}'))).toEqual({
      kind: "broken",
      ucpKeyOnly: true,
      found: "HTTP 200, but the `ucp` key is not an object",
    });
  });
});

describe("ucpBindings", () => {
  it("reads nothing when services is not an object", () => {
    expect(ucpBindings({ services: ["dev.ucp.shopping"] })).toEqual([]);
    expect(ucpBindings({})).toEqual([]);
  });

  it("reads each object binding of the current array shape", () => {
    expect(
      ucpBindings({
        services: {
          "dev.ucp.shopping": [
            { transport: "rest", endpoint: "https://example.com/ucp" },
            { transport: 7, endpoint: "https://example.com/other" },
            "not a binding",
          ],
        },
      }),
    ).toEqual([
      {
        service: "dev.ucp.shopping",
        transport: "rest",
        endpoint: "https://example.com/ucp",
      },
      // A non-string transport is not guessed at.
      {
        service: "dev.ucp.shopping",
        transport: undefined,
        endpoint: "https://example.com/other",
      },
    ]);
  });

  it("reads one binding per nested transport of the 2026-01-11 shape", () => {
    expect(
      ucpBindings({
        services: {
          "dev.ucp.shopping": {
            rest: { endpoint: "https://example.com/rest" },
            mcp: { endpoint: "https://example.com/mcp" },
          },
        },
      }),
    ).toEqual([
      {
        service: "dev.ucp.shopping",
        transport: "rest",
        endpoint: "https://example.com/rest",
      },
      {
        service: "dev.ucp.shopping",
        transport: "mcp",
        endpoint: "https://example.com/mcp",
      },
    ]);
  });

  it("reads a service object with no transport key as one untyped binding", () => {
    expect(
      ucpBindings({
        services: {
          "dev.ucp.shopping": { endpoint: "https://example.com/ucp" },
        },
      }),
    ).toEqual([
      {
        service: "dev.ucp.shopping",
        transport: undefined,
        endpoint: "https://example.com/ucp",
      },
    ]);
  });

  it("skips a service whose value is neither an array nor an object", () => {
    expect(
      ucpBindings({ services: { "dev.ucp.shopping": "https://example.com" } }),
    ).toEqual([]);
  });
});
