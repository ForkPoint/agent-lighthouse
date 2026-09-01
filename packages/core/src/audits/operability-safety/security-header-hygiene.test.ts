import { describe, it, expect } from "vitest";
import { SecurityHeaderHygieneAudit } from "./security-header-hygiene";
import { weightForGrade } from "../../scorer";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import type { CheckContext, PageContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";

/** A homepage with the given response headers (lower-cased keys, as the fetcher stores them). */
function pageWith(
  headers: Record<string, string>,
  html = "<html></html>",
): PageContext {
  const page = mockPageContext("https://example.com", html);
  Object.assign(page.fetchResult.headers, headers);
  return page;
}

/** A context whose only input that matters is the security.txt root file. */
function ctxWith(rootFiles: Record<string, FetchResult>): CheckContext {
  return mockCheckContext([pageWith({})], rootFiles);
}

/** A well-formed security.txt whose Expires is far in the future. */
const VALID_SECURITY_TXT =
  "Contact: mailto:security@example.com\nExpires: 2099-12-31T23:59:59.000Z\n";

const audit = new SecurityHeaderHygieneAudit();

describe("SecurityHeaderHygieneAudit — meta", () => {
  const { meta } = SecurityHeaderHygieneAudit;

  it("keeps its registered id in the operability-safety category", () => {
    expect(meta.id).toBe("operability-safety/security-header-hygiene");
    expect(meta.category).toBe("operability-safety");
  });

  it("is informative at grade C and weight 0 — it can never move a score", () => {
    expect(meta.tier).toBe("informative");
    expect(meta.scoreDisplayMode).toBe("informative");
    expect(meta.evidenceGrade).toBe("C");
    expect(meta.weight).toBe(weightForGrade("C", "informative"));
    expect(meta.weight).toBe(0);
  });

  it("points at its dossier", () => {
    expect(meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/security-header-hygiene.md",
    );
  });

  it("titles both statuses after the one signal it measures", () => {
    expect(meta.title).toContain("security.txt");
    expect(meta.failureTitle).toContain("security.txt");
  });
});

describe("SecurityHeaderHygieneAudit — never fails a site", () => {
  const cases: Array<[string, CheckContext]> = [
    [
      "a valid file",
      ctxWith({
        "/.well-known/security.txt": mockFetchResult(VALID_SECURITY_TXT, 200),
      }),
    ],
    [
      "an expired file",
      ctxWith({
        "/.well-known/security.txt": mockFetchResult(
          "Contact: mailto:s@example.com\nExpires: 2020-01-01T00:00:00.000Z\n",
          200,
        ),
      }),
    ],
    [
      "an HTML soft-404",
      ctxWith({
        "/.well-known/security.txt": mockFetchResult(
          "<!doctype html><html><body>Nope</body></html>",
          200,
        ),
      }),
    ],
    [
      "a 404",
      ctxWith({ "/.well-known/security.txt": mockFetchResult("", 404) }),
    ],
    ["nothing fetched at all", mockCheckContext([], {})],
  ];

  it.each(cases)("never returns fail for %s", (_label, ctx) => {
    expect(audit.audit(ctx).status).not.toBe("fail");
  });
});

describe("SecurityHeaderHygieneAudit — when the audit stays silent", () => {
  // The Class B fix: publishing a security.txt is optional under RFC 9116, so a
  // site without one has nothing to be warned about. This case returned `warn`
  // before 2026-08-24.
  it("reports a site with no security.txt as not applicable, not a warning", () => {
    const result = audit.audit(
      ctxWith({ "/.well-known/security.txt": mockFetchResult("", 404) }),
    );
    expect(result.status).toBe("na");
    expect(result.message).toContain("does not publish");
    expect(result.message).toContain("RFC 9116");
  });

  it("distinguishes a location that was never fetched from one that returned 404", () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe("na");
    expect(result.message).toContain("never fetched");
  });
});

describe("SecurityHeaderHygieneAudit — RFC 9116 conformance", () => {
  const withFile = (file: FetchResult) =>
    audit.audit(ctxWith({ "/.well-known/security.txt": file }));

  it("accepts a file with Contact and a future Expires", () => {
    const result = withFile(mockFetchResult(VALID_SECURITY_TXT, 200));
    expect(result.status).toBe("pass");
    expect(result.score).toBe(1);
    expect(result.found).toContain("/.well-known/security.txt");
  });

  it("falls back to the legacy top-level location", () => {
    const result = audit.audit(
      ctxWith({ "/security.txt": mockFetchResult(VALID_SECURITY_TXT, 200) }),
    );
    expect(result.status).toBe("pass");
    expect(result.found).toContain("legacy location");
  });

  it("does not accept an expired file", () => {
    const result = withFile(
      mockFetchResult(
        "Contact: mailto:s@example.com\nExpires: 2020-01-01T00:00:00.000Z\n",
        200,
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.priority).toBe("low");
    expect(result.found).toContain("expired");
  });

  it("does not accept a file without a Contact field", () => {
    const result = withFile(
      mockFetchResult("Expires: 2099-12-31T23:59:59.000Z\n", 200),
    );
    expect(result.status).toBe("warn");
    expect(result.found).toContain("no Contact");
  });

  it("does not accept a file without an Expires field", () => {
    const result = withFile(
      mockFetchResult("Contact: mailto:s@example.com\n", 200),
    );
    expect(result.status).toBe("warn");
    expect(result.found).toContain("no Expires");
  });

  it("does not accept an unparseable Expires value", () => {
    const result = withFile(
      mockFetchResult("Contact: mailto:s@example.com\nExpires: soon\n", 200),
    );
    expect(result.status).toBe("warn");
    expect(result.found).toContain("unparseable");
  });

  it("does not accept an SPA HTML soft-404 served at 200", () => {
    const result = withFile(
      mockFetchResult(
        "<!doctype html><html><body>Not found</body></html>",
        200,
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.found).toContain("HTML");
  });
});

describe("SecurityHeaderHygieneAudit — the removed header signals", () => {
  // Pins the narrowing: HSTS, CSP and X-Content-Type-Options were removed on
  // 2026-08-24 as not-a-factor, so no response header may change the outcome.
  const HEALTHY_HEADERS = {
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "content-security-policy": "default-src 'self'",
    "x-content-type-options": "nosniff",
  };
  const rootFiles = {
    "/.well-known/security.txt": mockFetchResult(VALID_SECURITY_TXT, 200),
  };

  it("ignores response headers entirely", () => {
    const withHeaders = audit.audit(
      mockCheckContext([pageWith(HEALTHY_HEADERS)], rootFiles),
    );
    const withoutHeaders = audit.audit(
      mockCheckContext([pageWith({})], rootFiles),
    );
    expect(withHeaders.status).toBe(withoutHeaders.status);
    expect(withHeaders.found).toBe(withoutHeaders.found);
  });

  it("passes a valid security.txt on a site with none of the three headers", () => {
    expect(
      audit.audit(mockCheckContext([pageWith({})], rootFiles)).status,
    ).toBe("pass");
  });

  it("names none of the removed headers in its output", () => {
    const result = audit.audit(mockCheckContext([pageWith({})], rootFiles));
    const text = `${result.message} ${result.expected} ${result.found}`;
    for (const header of [
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Content-Type-Options",
    ]) {
      expect(text).not.toContain(header);
    }
  });
});
