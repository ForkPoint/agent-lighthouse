import { describe, it, expect } from "vitest";
import {
  describeFailure,
  entryLabel,
  nonEmptyString,
  readAiCatalog,
  readAiCatalogs,
  stringList,
} from "./_ard";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";

const ctxWith = (
  body: string,
  status = 200,
  contentType = "application/ai-catalog+json",
) =>
  mockCheckContext([], {
    "/.well-known/ai-catalog.json": mockFetchResult(body, status, contentType),
  });

describe("readAiCatalog", () => {
  it("parses an ARD manifest into typed entries", () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: "1.0",
          host: { displayName: "Example" },
          entries: [
            {
              identifier: "urn:air:example.com:server:a",
              displayName: "A",
              type: "application/mcp-server-card+json",
              url: "https://example.com/a",
              capabilities: ["x", "  ", 42],
            },
            { identifier: "urn:air:example.com:skill:b", data: "# inline" },
          ],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.entries[0]!.capabilities).toEqual(["x"]);
    expect(read.manifest.entries[0]!.hasData).toBe(false);
    expect(read.manifest.entries[1]!.hasData).toBe(true);
    expect(read.manifest.entries[1]!.url).toBeUndefined();
  });

  // An HTML page at a well-known path is a catch-all route answering for a
  // file that does not exist: absent, as isRootArtifact rules everywhere else.
  it.each([
    ["absent", undefined],
    ["absent", "<!doctype html><html></html>"],
    ["not-json", "nope {{{"],
    ["shape", JSON.stringify({ services: [] })],
  ])("names the %s failure mode", (reason, body) => {
    const ctx =
      body === undefined
        ? mockCheckContext([], {})
        : ctxWith(
            body,
            200,
            body.startsWith("<") ? "text/html" : "application/json",
          );
    const read = readAiCatalog(ctx);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe(reason);
  });

  it("detects an HTML soft-404 from the body even when the content type lies", () => {
    const read = readAiCatalog(
      ctxWith("<html><body>Not found</body></html>", 200, "application/json"),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("absent");
    expect(read.found).toContain("HTML page");
  });

  it("says 'HTML body' when an HTML stand-in carries no content type", () => {
    const read = readAiCatalog(
      ctxWith("<!doctype html><html></html>", 200, ""),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.found).toContain(
      "HTTP 200 with an HTML page (HTML body), not the file",
    );
  });

  // An entry that is not an object still holds its place, so later entries
  // keep their position and the bad one is labelled by number.
  it("keeps a non-object entry as an empty entry at its position", () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          entries: ["not an entry", { identifier: "urn:air:example.com:b" }],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const [first, second] = read.manifest.entries;
    expect(first).toEqual({
      hasData: false,
      capabilities: [],
      representativeQueries: [],
      tags: [],
      hasTrustManifest: false,
      index: 0,
    });
    expect(entryLabel(first!)).toBe("entry #1");
    expect(second?.identifier).toBe("urn:air:example.com:b");
  });

  it("treats an HTML stand-in beside a 404 as absent, naming both paths", () => {
    const read = readAiCatalog(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          "<!doctype html><html></html>",
          200,
          "text/html",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult("", 404),
      }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("absent");
    expect(read.found).toContain(
      "/.well-known/ard.json: HTTP 200 with an HTML page",
    );
    expect(read.found).toContain("/.well-known/ai-catalog.json: HTTP 404");
    expect(describeFailure(read)).toMatch(/^Neither .+ nor .+ is served/);
  });

  it("reports a broken manifest ahead of an HTML stand-in at the other path", () => {
    const read = readAiCatalog(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          "<!doctype html><html></html>",
          200,
          "text/html",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult(
          "nope {{{",
          200,
          "application/json",
        ),
      }),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("not-json");
  });

  // ARD §4.2: updatedAt is an entry field. §4.2/§4.3: trustManifest sits on the
  // entry and the host. Neither is defined at the manifest root.
  it("reads updatedAt and trustManifest at their spec-defined levels", () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: "1.0",
          updatedAt: "2026-08-01",
          trustManifest: { issuer: "did:web:example.com" },
          host: {
            displayName: "Example",
            trustManifest: { issuer: "did:web:example.com" },
          },
          entries: [
            {
              identifier: "urn:air:example.com:a",
              updatedAt: "2026-08-02T00:00:00Z",
            },
            {
              identifier: "urn:air:example.com:b",
              trustManifest: { issuer: "did:web:example.com" },
            },
          ],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.entries[0]!.updatedAt).toBe("2026-08-02T00:00:00Z");
    expect(read.manifest.entries[0]!.hasTrustManifest).toBe(false);
    expect(read.manifest.entries[1]!.hasTrustManifest).toBe(true);
    expect(read.manifest.hostHasTrustManifest).toBe(true);
    // The root-level copies are not part of the schema and must not leak in.
    expect("updatedAt" in read.manifest).toBe(false);
    expect("hasTrustManifest" in read.manifest).toBe(false);
  });

  it("does not promote a root-level trustManifest onto the host", () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: "1.0",
          trustManifest: { issuer: "did:web:example.com" },
          host: { displayName: "Example" },
          entries: [{ identifier: "urn:air:example.com:a" }],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.hostHasTrustManifest).toBe(false);
    expect(read.manifest.entries[0]!.hasTrustManifest).toBe(false);
  });

  // ARD v0.91 requires only `entries`; specVersion is read when present.
  it("treats a whitespace-only specVersion as absent without rejecting the manifest", () => {
    const read = readAiCatalog(
      ctxWith(JSON.stringify({ specVersion: "  ", host: {}, entries: [] })),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.specVersion).toBeUndefined();
  });

  it("reports only entries as missing", () => {
    const read = readAiCatalog(ctxWith(JSON.stringify({ specVersion: "1.0" })));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason === "shape" && read.missing).toEqual(["entries"]);
  });

  it("prefers the manifest that lists entries over an empty one", () => {
    const read = readAiCatalog(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          JSON.stringify({ entries: [] }),
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult(
          JSON.stringify({ entries: [{ identifier: "x" }] }),
          200,
          "application/json",
        ),
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.path).toBe("/.well-known/ai-catalog.json");
    expect(read.manifest.hasHost).toBe(false);
  });
});

describe("readAiCatalogs", () => {
  it("returns every valid manifest, ard.json first", () => {
    const manifests = readAiCatalogs(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          JSON.stringify({ entries: [{ identifier: "a" }] }),
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult(
          JSON.stringify({ entries: [{ identifier: "b" }] }),
          200,
          "application/json",
        ),
      }),
    );
    expect(manifests.map((m) => m.path)).toEqual([
      "/.well-known/ard.json",
      "/.well-known/ai-catalog.json",
    ]);
  });

  it("skips absent and broken paths", () => {
    const manifests = readAiCatalogs(
      mockCheckContext([], {
        "/.well-known/ard.json": mockFetchResult(
          "nope",
          200,
          "application/json",
        ),
        "/.well-known/ai-catalog.json": mockFetchResult(
          JSON.stringify({ entries: [] }),
          200,
          "application/json",
        ),
      }),
    );
    expect(manifests.map((m) => m.path)).toEqual([
      "/.well-known/ai-catalog.json",
    ]);
  });
});

describe("_ard helpers", () => {
  it("nonEmptyString rejects blanks and non-strings", () => {
    expect(nonEmptyString("a")).toBe("a");
    expect(nonEmptyString("  ")).toBeUndefined();
    expect(nonEmptyString(7)).toBeUndefined();
  });

  it("stringList drops blank and non-string members", () => {
    expect(stringList(["a", "", " ", 1, null])).toEqual(["a"]);
    expect(stringList("a")).toEqual([]);
  });

  it("entryLabel falls back through displayName, identifier and position", () => {
    const base = {
      hasData: false,
      capabilities: [],
      representativeQueries: [],
      tags: [],
      hasTrustManifest: false,
      index: 2,
    };
    expect(
      entryLabel({ ...base, displayName: "Name", identifier: "urn:x" }),
    ).toBe("Name");
    expect(entryLabel({ ...base, identifier: "urn:x" })).toBe("urn:x");
    expect(entryLabel(base)).toBe("entry #3");
  });
});
