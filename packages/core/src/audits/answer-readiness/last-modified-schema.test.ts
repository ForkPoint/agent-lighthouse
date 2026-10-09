import { describe, it, expect } from "vitest";
import { LastModifiedSchemaAudit } from "./last-modified-schema";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("LastModifiedSchemaAudit", () => {
  const audit = new LastModifiedSchemaAudit();

  it("passes when dateModified differs from datePublished", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","datePublished":"2025-01-01T10:00:00Z","dateModified":"2025-01-20T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("differs from datePublished");
  });

  it("warns when dateModified equals datePublished", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","datePublished":"2025-01-01T10:00:00Z","dateModified":"2025-01-01T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("equals datePublished");
  });

  it("fails when no dateModified is present", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","datePublished":"2025-01-01T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No dateModified found");
  });

  it("fails when no pages scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No pages scanned");
  });

  it("warns when dateModified is set but datePublished is absent", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","dateModified":"2025-01-20T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("no datePublished");
  });

  it("finds dateModified via @graph and passes when it differs from datePublished", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Article","datePublished":"2025-01-01T10:00:00Z","dateModified":"2025-02-01T10:00:00Z"}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("finds dateModified in a top-level JSON-LD array", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        [{"@context":"https://schema.org","@type":"BlogPosting","datePublished":"2025-01-01","dateModified":"2025-03-01"}]
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("handles null item in @graph gracefully (covers line 14 walk null check)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[null,{"@type":"Article","datePublished":"2025-01-01T10:00:00Z","dateModified":"2025-02-01T10:00:00Z"}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("differs from datePublished");
  });

  it("handles @type as array with non-string element (covers lines 25-27 Array.isArray + typeof false)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":[null,"Article"],"datePublished":"2025-01-01T10:00:00Z","dateModified":"2025-03-01T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("differs from datePublished");
  });

  it("warns when dateModified is a string but datePublished is a non-string value (covers asString fallback)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","datePublished":1735725600,"dateModified":"2025-01-20T10:00:00Z"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("equals datePublished");
    // datePublished is numeric → coerced to '' in the found detail.
    expect(result.found).toContain("datePublished: ");
  });
});
