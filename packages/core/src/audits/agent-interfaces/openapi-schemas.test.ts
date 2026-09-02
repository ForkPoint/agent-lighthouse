import { describe, it, expect } from "vitest";
import { OpenApiSchemasAudit } from "./openapi-schemas";
import { mockCheckContext, mockFetchResult } from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";

const responseWithSchema = {
  "200": {
    description: "ok",
    content: { "application/json": { schema: { type: "object" } } },
  },
};
const requestWithSchema = {
  required: true,
  content: { "application/json": { schema: { type: "object" } } },
};

describe("OpenApiSchemasAudit", () => {
  const audit = new OpenApiSchemasAudit();

  it("passes when all operations have response schemas and writes have request schemas", () => {
    const spec = JSON.stringify({
      paths: {
        "/search": {
          get: { operationId: "search", responses: responseWithSchema },
        },
        "/contact": {
          post: {
            operationId: "contact",
            requestBody: requestWithSchema,
            responses: responseWithSchema,
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("response schemas");
  });

  it("warns on partial schema coverage", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": { get: { operationId: "a", responses: responseWithSchema } },
        "/b": {
          get: {
            operationId: "b",
            responses: { "200": { description: "ok" } },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("warn");
    expect(result.message).toContain("Partial schema coverage");
  });

  it("fails on low schema coverage", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": {
          get: {
            operationId: "a",
            responses: { "200": { description: "ok" } },
          },
        },
        "/b": {
          get: {
            operationId: "b",
            responses: { "200": { description: "ok" } },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Low schema coverage");
  });

  // Absent artifact, absent verdict: no document, and no operations inside
  // one, means no schema coverage was ever observed. The coverage failures
  // above are unchanged — they are what carries the grade B.
  it("declines when there is no spec", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.found).toBe("No readable OpenAPI document");
  });

  it("declines on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("declines when there are no operations", () => {
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(JSON.stringify({ paths: {} }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("no operations");
  });

  it("declines when openapi.json contains invalid JSON", () => {
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult("invalid json {{{", 200),
    });
    expect(audit.audit(ctx).status).toBe("na");
  });

  it("fails when a POST endpoint has no requestBody schema but has a response schema", () => {
    const spec = JSON.stringify({
      paths: {
        "/contact": {
          post: {
            operationId: "submitContact",
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "object" } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("request schemas");
  });

  it("fails when response has content but no schema defined on any media type", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": {
          get: {
            operationId: "a",
            responses: {
              "200": { description: "ok", content: { "application/json": {} } },
            },
          },
        },
        "/b": {
          get: {
            operationId: "b",
            responses: {
              "200": { description: "ok", content: { "application/json": {} } },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Low schema coverage");
  });

  it("passes when all GET operations have response schemas (no write methods)", () => {
    const spec = JSON.stringify({
      paths: {
        "/search": {
          get: {
            operationId: "search",
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "object" } } },
              },
            },
          },
        },
        "/products": {
          get: {
            operationId: "listProducts",
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "array" } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).not.toContain("write operation");
  });

  // Present and broken, not absent. A `paths` the author wrote and an agent
  // cannot walk is a defective document, and this audit still says so.
  it("fails and names the defect when a path item is null", () => {
    const spec = JSON.stringify({ paths: { "/null-path": null } });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("paths object is malformed");
    expect(result.found).toBe(
      'paths entry "/null-path" is null, not a path item object',
    );
  });

  it("handles POST with requestBody that has no content property", () => {
    const spec = JSON.stringify({
      paths: {
        "/contact": {
          post: {
            operationId: "contact",
            requestBody: { required: true },
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "object" } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    // Has response schema but requestBody has no content → request schema not counted
    expect(result.status).toBe("fail");
    expect(result.message).toContain("request schemas");
  });

  it("does not count response schema when response entry is not an object", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": { get: { operationId: "a", responses: { "200": null } } },
        "/b": { get: { operationId: "b", responses: { "200": null } } },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Low schema coverage");
  });

  it("declines on a document with no paths key — no operation was ever read", () => {
    const spec = JSON.stringify({ openapi: "3.0.3", info: {} });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("no operations");
  });

  it("does not count request schema when POST requestBody has content but no schema in media type", () => {
    const spec = JSON.stringify({
      paths: {
        "/contact": {
          post: {
            operationId: "contact",
            requestBody: {
              required: true,
              content: { "application/json": {} },
            },
            responses: {
              "200": {
                description: "ok",
                content: { "application/json": { schema: { type: "object" } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    // Has response schema but requestBody media type has no schema → request not counted
    expect(result.status).toBe("fail");
    expect(result.message).toContain("request schemas");
  });

  it("does not count response schema when operation has no responses key", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": {
          post: {
            operationId: "a",
            requestBody: {
              required: true,
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
        "/b": {
          post: {
            operationId: "b",
            requestBody: {
              required: true,
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    // Has request schemas but no response schemas → low coverage
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Low schema coverage");
  });

  it("fails and names the defect when paths is an array", () => {
    const spec = JSON.stringify({ paths: ["get", "post"] });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toBe("paths is an array, not an object");
  });

  it("fails and names the defect when a path item is a string", () => {
    const spec = JSON.stringify({ paths: { "/products": "GET" } });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toBe(
      'paths entry "/products" is a string, not a path item object',
    );
  });

  it("fails and names the defect when a path item is an array", () => {
    const spec = JSON.stringify({ paths: { "/products": ["get", "post"] } });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toBe(
      'paths entry "/products" is an array, not a path item object',
    );
  });
  // Coverage is graded over what can be read. On released `main` this document
  // was graded on its two readable operations; it still is, and the defect is
  // named beside the grade instead of erasing it.
  it("grades coverage over the readable operations beside a broken entry", () => {
    const spec = JSON.stringify({
      paths: {
        "/a": {
          get: {
            responses: {
              "200": { content: { "application/json": { schema: {} } } },
            },
          },
        },
        "/b": {
          get: {
            responses: {
              "200": { content: { "application/json": { schema: {} } } },
            },
          },
        },
        "/legacy": null,
      },
    });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Skipped 1 unreadable entry");
    expect(result.found).toContain("2/2 response schemas");
    expect(result.found).toContain("1 unreadable");
  });

  it("fails when the only method value is not an operation object", () => {
    const spec = JSON.stringify({ paths: { "/x": { get: "yes" } } });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toBe(
      'paths entry "/x" declares get as a string, not an operation object',
    );
  });

  // Legal and declares nothing: an absence one level down, so it declines.
  it("declines an empty path item", () => {
    const spec = JSON.stringify({ paths: { "/x": {} } });
    const ctx = mockCheckContext([], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.found).toBe("0 operations");
  });
});
