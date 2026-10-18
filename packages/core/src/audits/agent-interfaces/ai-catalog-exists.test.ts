import { describe, it, expect } from "vitest";
import { AiCatalogExistsAudit } from "./ai-catalog-exists";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import type { PageContext } from "#core/check-context";
import { CheckStatus } from "#core/types";

/** An ARD §4.1 manifest, shaped like the spec's own conformance example. */
function ard(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    specVersion: "1.0",
    host: { displayName: "Example", identifier: "did:web:example.com" },
    entries: [
      {
        identifier: "urn:air:example.com:server:search",
        displayName: "Search",
        type: "application/mcp-server-card+json",
        url: "https://example.com/mcp/search.json",
        description: "Search the product catalog.",
        capabilities: ["search"],
        representativeQueries: ["find blue running shoes"],
      },
    ],
    ...over,
  });
}

/** The schema the framework invented before this rewrite. */
const LEGACY = JSON.stringify({
  version: "1.0",
  name: "Site",
  services: [
    { name: "Search", url: "https://example.com/api/search", type: "rest" },
  ],
});

const page = (
  head: string,
  url = "https://example.com/",
  index = 0,
): PageContext =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, index);

const withCatalog = (
  body: string,
  status = 200,
  contentType = "application/ai-catalog+json",
) =>
  mockCheckContext([], {
    "/.well-known/ai-catalog.json": mockFetchResult(body, status, contentType),
  });

describe("AiCatalogExistsAudit", () => {
  const audit = new AiCatalogExistsAudit();

  // ── ARD §4.1: specVersion + host + entries[] ──

  it("passes on an ARD §4.1 manifest (specVersion + host + entries)", () => {
    const result = audit.audit(withCatalog(ard()));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("1 entr");
  });

  it("counts several entries in the plural", () => {
    const body = JSON.parse(ard()) as { entries: unknown[] };
    body.entries.push({
      identifier: "urn:air:example.com:server:orders",
      displayName: "Orders",
      type: "application/mcp-server-card+json",
      url: "https://example.com/mcp/orders.json",
    });
    const result = audit.audit(withCatalog(JSON.stringify(body)));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("with 2 entries.");
    expect(result.found).toBe("Valid ARD manifest with 2 entries");
  });

  it("fails on the invented top-level services array", () => {
    const result = audit.audit(withCatalog(LEGACY));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("entries");
    expect(result.message).not.toContain("specVersion");
  });

  // ARD v0.91's ArdManifest schema requires only `entries`. specVersion and
  // host belong to the AI Catalog spec, and hf-discover reads only entries.
  it("passes a manifest without specVersion", () => {
    const result = audit.audit(withCatalog(ard({ specVersion: undefined })));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).not.toContain("undefined");
  });

  it("passes a manifest without host", () => {
    expect(audit.audit(withCatalog(ard({ host: undefined }))).status).toBe(
      CheckStatus.Pass,
    );
  });

  it("passes a bare entries-only manifest", () => {
    const body = JSON.stringify({ entries: JSON.parse(ard()).entries });
    expect(audit.audit(withCatalog(body)).status).toBe(CheckStatus.Pass);
  });

  // ── ARD v0.91 path: /.well-known/ard.json ──

  it("passes a manifest served only at /.well-known/ard.json", () => {
    const result = audit.audit(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          ard(),
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult("", 404),
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("/.well-known/ard.json");
  });

  it("passes when ai-catalog.json is valid and ard.json is absent", () => {
    const result = audit.audit(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult("", 404),
        "/.well-known/ai-catalog.json": mockFetchResult(ard()),
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("/.well-known/ai-catalog.json");
  });

  it("passes when one path is valid even if the other is broken", () => {
    const result = audit.audit(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          "nope {{{",
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult(ard()),
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("reports the broken file, not the absent one, when neither is valid", () => {
    const result = audit.audit(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          "nope {{{",
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult("", 404),
      }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("/.well-known/ard.json");
    expect(result.message).toContain("not valid JSON");
  });

  it("names both paths when neither is served", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.message).toContain("/.well-known/ard.json");
    expect(result.message).toContain("/.well-known/ai-catalog.json");
  });

  it("fails when entries is not an array", () => {
    expect(audit.audit(withCatalog(ard({ entries: { a: 1 } }))).status).toBe(
      CheckStatus.Fail,
    );
  });

  it("warns on a conformant manifest that lists no entries at all", () => {
    const result = audit.audit(withCatalog(ard({ entries: [] })));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("no entries");
  });

  it("does not require the ai-catalog media type to pass", () => {
    expect(
      audit.audit(withCatalog(ard(), 200, "application/json")).status,
    ).toBe(CheckStatus.Pass);
  });

  // ── absence, soft-404 and malformed bodies ──

  it("fails when the manifest is not fetched at all", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("Not fetched");
  });

  it("fails when the manifest 404s", () => {
    expect(audit.audit(withCatalog("", 404)).status).toBe(CheckStatus.Fail);
  });

  it("fails when the manifest body is not valid JSON", () => {
    const result = audit.audit(withCatalog("nope {{{"));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("not valid JSON");
  });

  it('diagnoses an HTML soft-404 as "no manifest served", not "invalid JSON"', () => {
    const result = audit.audit(
      withCatalog("<!doctype html><html></html>", 200, "text/html"),
    );
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("HTML");
    expect(result.message).not.toContain("not valid JSON");
  });

  // ── absorbed ai-catalog-link (4.19): the rel="ai-catalog" advertisement ──

  it('warns when a rel="ai-catalog" link advertises a catalog the well-known path does not serve', () => {
    const ctx = mockCheckContext(
      [page('<link rel="ai-catalog" href="/ai-catalog.json">')],
      {
        "/.well-known/ai-catalog.json": mockFetchResult("", 404),
      },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("/ai-catalog.json");
  });

  it('does not count a rel="ai-catalog" link with no href as an advertisement', () => {
    const ctx = mockCheckContext([page('<link rel="ai-catalog">')], {
      "/.well-known/ai-catalog.json": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).not.toContain("advertised");
  });

  it("matches the rel token case-insensitively and inside a multi-token rel", () => {
    const ctx = mockCheckContext(
      [
        page(
          '<link rel="Alternate AI-Catalog" type="application/ai-catalog+json" href="/c.json">',
        ),
      ],
      { "/.well-known/ai-catalog.json": mockFetchResult("", 404) },
    );
    expect(audit.audit(ctx).status).toBe(CheckStatus.Warn);
  });

  it("accepts an HTTP Link header advertising the catalog", () => {
    const p = page("");
    p.fetchResult.headers["link"] = '</ai-catalog.json>; rel="ai-catalog"';
    const ctx = mockCheckContext([p], {
      "/.well-known/ai-catalog.json": mockFetchResult("", 404),
    });
    expect(audit.audit(ctx).status).toBe(CheckStatus.Warn);
  });

  it("finds the advertisement on any crawled page, not only the homepage", () => {
    const ctx = mockCheckContext(
      [
        page(""),
        page(
          '<link rel="ai-catalog" href="/c.json">',
          "https://example.com/developers",
          1,
        ),
      ],
      { "/.well-known/ai-catalog.json": mockFetchResult("", 404) },
    );
    expect(audit.audit(ctx).status).toBe(CheckStatus.Warn);
  });

  it("does not treat the old title-matched alternate link as an advertisement", () => {
    const ctx = mockCheckContext(
      [
        page(
          '<link rel="alternate" type="application/json" href="/c.json" title="AI Catalog">',
        ),
      ],
      { "/.well-known/ai-catalog.json": mockFetchResult("", 404) },
    );
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  it("reports the advertisement alongside a valid well-known manifest", () => {
    const ctx = mockCheckContext(
      [page('<link rel="ai-catalog" href="/ai-catalog.json">')],
      {
        "/.well-known/ai-catalog.json": mockFetchResult(
          ard(),
          200,
          "application/ai-catalog+json",
        ),
      },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain('rel="ai-catalog"');
  });

  it("still passes on the well-known manifest with no advertisement at all", () => {
    const ctx = mockCheckContext([page("")], {
      "/.well-known/ai-catalog.json": mockFetchResult(
        ard(),
        200,
        "application/ai-catalog+json",
      ),
    });
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it('does not claim "advertised but not served" when the served manifest is merely malformed', () => {
    const ctx = mockCheckContext(
      [page('<link rel="ai-catalog" href="/ai-catalog.json">')],
      {
        "/.well-known/ai-catalog.json": mockFetchResult(
          LEGACY,
          200,
          "application/json",
        ),
      },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).not.toContain("resolves only");
  });

  // ── guidance must teach the real schema ──

  it("ships a code sample using the ARD schema, not the invented one", () => {
    const code = AiCatalogExistsAudit.meta.guidance?.code ?? "";
    expect(code).toContain("specVersion");
    expect(code).toContain('"host"');
    expect(code).toContain('"entries"');
    expect(code).not.toContain('"services"');
    expect(code).not.toContain('"owner"');
  });
});
