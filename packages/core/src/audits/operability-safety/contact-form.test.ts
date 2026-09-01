import { describe, it, expect } from "vitest";
import { ContactFormAudit } from "./contact-form";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";

describe("ContactFormAudit", () => {
  const audit = new ContactFormAudit();

  it("passes when a page has a contact form (matched by action)", () => {
    const page = mockPageContext(
      "https://example.com/contact",
      `<html><body>
        <form action="/api/contact" method="POST">
          <input type="text" name="name" />
          <input type="email" name="email" />
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("contact");
  });

  it("passes when a form input name matches a contact indicator", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <form action="/submit" method="POST">
          <textarea name="message"></textarea>
        </form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    expect(audit.audit(ctx).status).toBe("pass");
  });

  it("passes when OpenAPI has a POST contact endpoint", () => {
    const spec = JSON.stringify({
      paths: { "/api/contact": { post: { operationId: "submitContact" } } },
    });
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>no forms</p></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("POST");
  });

  it("fails when no contact form or endpoint exists", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <form action="/newsletter" method="POST"><input type="text" name="q" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No contact");
  });

  it("fails when openapi.json contains invalid JSON and no forms match", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>No forms</p></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult("not valid json {{{", 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });

  it("fails when spec has no paths property and no contact forms", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>No forms</p></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(
        JSON.stringify({ info: { title: "API" } }),
        200,
      ),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });

  it("fails when only a GET contact endpoint exists (not POST)", () => {
    const spec = JSON.stringify({
      paths: { "/api/contact": { get: { operationId: "getContact" } } },
    });
    const page = mockPageContext(
      "https://example.com",
      "<html><body></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });

  it("skips path items that are not objects in getOperations", () => {
    const spec = JSON.stringify({
      paths: {
        "/api/null-path": null,
        "/api/submit-order": { post: { operationId: "placeOrder" } },
      },
    });
    const page = mockPageContext(
      "https://example.com",
      "<html><body></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    // POST /api/submit-order doesn't match any contact indicator → fail
    expect(result.status).toBe("fail");
  });

  it("fails when paths is an array (covers Array.isArray branch of isObject)", () => {
    const spec = JSON.stringify({ paths: ["get", "post"] });
    const page = mockPageContext(
      "https://example.com",
      "<html><body></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });

  it("fails when path item is a string (covers typeof branch of isObject)", () => {
    const spec = JSON.stringify({ paths: { "/newsletter": "POST" } });
    const page = mockPageContext(
      "https://example.com",
      "<html><body></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });

  it("fails when path item is an array (covers Array.isArray branch of isObject at pathItem)", () => {
    const spec = JSON.stringify({ paths: { "/newsletter": ["get", "post"] } });
    const page = mockPageContext(
      "https://example.com",
      "<html><body></body></html>",
    );
    const ctx = mockCheckContext([page], {
      "/openapi.json": mockFetchResult(spec, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
  });
});
