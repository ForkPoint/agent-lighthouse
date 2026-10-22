import { describe, it, expect, vi } from "vitest";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import type { FetchOptions } from "#core/fetcher";
import { HttpMethod } from "#core/types";
import {
  NO_OPENAPI_SPEC,
  defectCount,
  defectNote,
  openApiOperations,
  probeOpenApiServer,
  readOpenApiPaths,
  readOpenApiSpec,
} from "./openapi";

// probeOpenApiServer gates every URL with isSafeUrl, which resolves DNS. An
// offline stand-in that refuses private ranges keeps the gate observable.
vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => !new URL(url).hostname.startsWith("10."),
  };
});

const ctxWith = (body: string, status = 200) =>
  mockCheckContext([], { "/openapi.json": mockFetchResult(body, status) });

describe("readOpenApiSpec", () => {
  it("returns the parsed document served at /openapi.json", () => {
    const spec = readOpenApiSpec(
      ctxWith(JSON.stringify({ openapi: "3.1.0", paths: {} })),
    );
    expect(spec?.["openapi"]).toBe("3.1.0");
  });

  it("returns undefined when no root file was fetched", () => {
    expect(readOpenApiSpec(mockCheckContext([], {}))).toBeUndefined();
  });

  it("returns undefined on a non-200 status", () => {
    expect(
      readOpenApiSpec(ctxWith(JSON.stringify({ openapi: "3.1.0" }), 404)),
    ).toBeUndefined();
  });

  it("returns undefined on an empty body", () => {
    expect(readOpenApiSpec(ctxWith(""))).toBeUndefined();
  });

  it("returns undefined on an HTML page served at /openapi.json", () => {
    expect(
      readOpenApiSpec(
        ctxWith(
          '<!DOCTYPE html>\n<html lang="fr"><head><title>Home</title></head><body>Shop</body></html>',
        ),
      ),
    ).toBeUndefined();
  });

  it("returns undefined on a body that is not JSON", () => {
    expect(readOpenApiSpec(ctxWith("invalid json {{{"))).toBeUndefined();
  });

  it("returns undefined on JSON that is not an object", () => {
    expect(readOpenApiSpec(ctxWith("[1, 2, 3]"))).toBeUndefined();
    expect(readOpenApiSpec(ctxWith('"a string"'))).toBeUndefined();
    expect(readOpenApiSpec(ctxWith("null"))).toBeUndefined();
  });
});

describe("openApiOperations", () => {
  it("flattens every declared method into path + method + operation", () => {
    const ops = openApiOperations({
      paths: {
        "/search": {
          get: { operationId: "search" },
          post: { operationId: "searchPost" },
        },
        "/contact": { post: { operationId: "contact" } },
      },
    });
    expect(ops).toHaveLength(3);
    expect(ops.map((o) => `${o.method} ${o.path}`)).toContain("get /search");
  });

  it("ignores keys that are not HTTP methods", () => {
    const ops = openApiOperations({
      paths: {
        "/search": { get: {}, parameters: [], summary: "not an operation" },
      },
    });
    expect(ops).toHaveLength(1);
  });

  // These fixed document shapes exercise the traversal,
  // and each one used to be pinned by a near-identical test in three separate
  // audit suites. They belong to the traversal, so they live with it.
  it.each([
    ["no paths key", { openapi: "3.1.0", info: {} }],
    ["paths as an array", { paths: ["get", "post"] }],
    ["paths as null", { paths: null }],
    ["a null path item", { paths: { "/x": null } }],
    ["a string path item", { paths: { "/x": "GET" } }],
    ["an array path item", { paths: { "/x": ["get"] } }],
    ["a non-object operation", { paths: { "/x": { get: "yes" } } }],
  ])("returns no operations for %s", (_label, spec) => {
    expect(openApiOperations(spec as Record<string, unknown>)).toEqual([]);
  });

  // A caller here is looking for one endpoint, not grading the document. A site
  // with a POST /contact and one broken sibling entry does have a contact
  // endpoint, and `readOpenApiPaths` would discard both because it judges the
  // document as a whole. That difference is why this walk is separate.
  it("keeps the well-formed entries beside a broken one", () => {
    const ops = openApiOperations({
      paths: {
        "/contact": { post: { operationId: "contact" } },
        "/bad": "oops",
      },
    });
    expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(["post /contact"]);
  });

  // OpenAPI 3.1 §4.8.8: a Paths Object may carry specification extensions
  // beside its path items. A real path key always starts with `/`, so an `x-`
  // key is never an operation, whatever it holds.
  it("skips a specification extension that looks like a path item", () => {
    const ops = openApiOperations({
      paths: { "x-webhooks": { post: {} }, "/ok": { get: {} } },
    });
    expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(["get /ok"]);
  });
});

describe("readOpenApiPaths", () => {
  // Absent and broken are different findings, and this is the one place the
  // difference is decided. An audit about the document's contents declines the
  // first and fails the second.
  it.each([
    ["no paths key", { openapi: "3.1.0", info: {} }],
    ["an empty paths object", { paths: {} }],
    [
      "path items that declare no method",
      { paths: { "/x": { summary: "nothing" } } },
    ],
    ["a legal path item that declares nothing", { paths: { "/x": {} } }],
    ["only specification extensions", { paths: { "x-internal": "anything" } }],
    // Legal Path Item members that are not Operation Objects. Judging these
    // would fail every document that declares shared parameters.
    [
      "a path item carrying only non-operation members",
      {
        paths: {
          "/x": { summary: "a", parameters: [], servers: [], $ref: "#/x" },
        },
      },
    ],
  ])("reports %s as empty", (_label, spec) => {
    expect(readOpenApiPaths(spec as Record<string, unknown>).kind).toBe(
      "empty",
    );
  });

  it.each([
    [
      "paths as an array",
      { paths: ["get", "post"] },
      "paths is an array, not an object",
    ],
    ["paths as null", { paths: null }, "paths is null, not an object"],
    [
      "paths as a string",
      { paths: "/search" },
      "paths is a string, not an object",
    ],
    [
      "a null path item",
      { paths: { "/x": null } },
      'paths entry "/x" is null, not a path item object',
    ],
    [
      "a string path item",
      { paths: { "/x": "GET" } },
      'paths entry "/x" is a string, not a path item object',
    ],
    [
      "an array path item",
      { paths: { "/x": ["get"] } },
      'paths entry "/x" is an array, not a path item object',
    ],
    // A defect is a defect at either level: a non-object where an Operation
    // Object belongs is the same error as one where a Path Item Object
    // belongs, so the document is present and broken, not empty.
    [
      "a method value that is not an operation object",
      { paths: { "/x": { get: "yes" } } },
      'paths entry "/x" declares get as a string, not an operation object',
    ],
    [
      "a method value that is null",
      { paths: { "/x": { post: null } } },
      'paths entry "/x" declares post as null, not an operation object',
    ],
    [
      "a number path item",
      { paths: { "/x": 1 } },
      'paths entry "/x" is a number, not a path item object',
    ],
    [
      "a method value that is a boolean",
      { paths: { "/x": { get: true } } },
      'paths entry "/x" declares get as a boolean, not an operation object',
    ],
    // Every entry defective means nothing survives the read, so it is
    // malformed even though there is more than one broken thing.
    [
      "every entry defective",
      { paths: { "/a": null, "/b": "GET" } },
      'paths entry "/a" is null, not a path item object (+1 more)',
    ],
  ])("reports %s as malformed and names it", (_label, spec, found) => {
    const reading = readOpenApiPaths(spec);
    expect(reading.kind).toBe("malformed");
    expect(reading.kind === "malformed" && reading.found).toBe(found);
  });

  // The regression this classifier used to carry: it judged the document as a
  // whole, so one broken entry erased every operation beside it. What is
  // readable is returned, and what is not is named alongside it.
  it("keeps the readable operations beside a broken entry and lists the defect", () => {
    const reading = readOpenApiPaths({
      paths: {
        "/a": { get: { operationId: "a" } },
        "/b": { post: { operationId: "b" } },
        "/legacy": null,
        "/c": { get: "yes" },
      },
    });
    expect(reading.kind).toBe("operations");
    if (reading.kind !== "operations") return;
    expect(reading.operations.map((o) => `${o.method} ${o.path}`)).toEqual([
      "get /a",
      "post /b",
    ]);
    expect(reading.defects).toEqual([
      'paths entry "/legacy" is null, not a path item object',
      'paths entry "/c" declares get as a string, not an operation object',
    ]);
  });

  it("reports no defects for a document with nothing broken", () => {
    const reading = readOpenApiPaths({ paths: { "/a": { get: {} } } });
    expect(reading.kind === "operations" && reading.defects).toEqual([]);
  });

  it("does not judge a specification extension beside a real path item", () => {
    const reading = readOpenApiPaths({
      paths: {
        "x-internal": ["anything"],
        "/search": { get: { operationId: "search" } },
      },
    });
    expect(reading.kind).toBe("operations");
  });
});

describe("defectNote and defectCount", () => {
  it("say nothing when nothing was skipped", () => {
    expect(defectNote([])).toBe("");
    expect(defectCount([])).toBe("");
  });

  it("name one skipped entry in the singular", () => {
    const defects = ['paths entry "/x" is null, not a path item object'];
    expect(defectNote(defects)).toBe(
      ' Skipped 1 unreadable entry: paths entry "/x" is null, not a path item object.',
    );
    expect(defectCount(defects)).toBe("; 1 unreadable");
  });

  it("name the first of several and count the rest", () => {
    const defects = ["first defect", "second defect", "third defect"];
    expect(defectNote(defects)).toBe(
      " Skipped 3 unreadable entries: first defect (+2 more).",
    );
    expect(defectCount(defects)).toBe("; 3 unreadable");
  });
});

describe("probeOpenApiServer", () => {
  function recordingCtx() {
    const seen: FetchOptions[] = [];
    const ctx = mockCheckContext([], {});
    ctx.fetch = async (options) => {
      seen.push(options);
      return mockFetchResult("", 204);
    };
    return { ctx, seen };
  }

  it("sends OPTIONS with no headers when the caller names neither", async () => {
    const { ctx, seen } = recordingCtx();
    const result = await probeOpenApiServer(ctx, "https://api.example.com/v1");
    expect(result?.status).toBe(204);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe(HttpMethod.Options);
    expect(seen[0]?.headers).toBeUndefined();
  });

  it("answers a repeat request from the per-scan cache", async () => {
    const { ctx, seen } = recordingCtx();
    const url = "https://api.example.com/v1/products";
    await probeOpenApiServer(ctx, url, { method: HttpMethod.Get });
    await probeOpenApiServer(ctx, url, { method: HttpMethod.Get });
    expect(seen).toHaveLength(1);
    // Headers are part of the key, so a request that sends them is new.
    await probeOpenApiServer(ctx, url, {
      method: HttpMethod.Get,
      headers: { Origin: "https://example.invalid" },
    });
    expect(seen).toHaveLength(2);
  });

  it("refuses a URL that fails the safety check without fetching it", async () => {
    const { ctx, seen } = recordingCtx();
    const result = await probeOpenApiServer(ctx, "http://10.0.0.5/internal");
    expect(result).toBeUndefined();
    expect(seen).toHaveLength(0);
  });

  it("returns undefined when the fetch throws", async () => {
    const ctx = mockCheckContext([], {});
    ctx.fetch = async () => {
      throw new Error("network");
    };
    expect(
      await probeOpenApiServer(ctx, "https://api.example.com/v1"),
    ).toBeUndefined();
  });
});

describe("NO_OPENAPI_SPEC", () => {
  // The four content audits must say the same thing about the same absence.
  // A per-audit sentence is how three of them drifted apart in the first place.
  it("carries one message and one `found` for the whole family", () => {
    expect(NO_OPENAPI_SPEC.found).toBe("No readable OpenAPI document");
    expect(NO_OPENAPI_SPEC.message).toContain("/openapi.json");
  });

  // The read also comes back empty for a 200 whose body will not parse, so the
  // wording may not claim the site publishes nothing.
  it("does not claim the site publishes no document", () => {
    expect(NO_OPENAPI_SPEC.message).not.toContain("is published");
    expect(NO_OPENAPI_SPEC.message).toContain("readable");
  });
});
