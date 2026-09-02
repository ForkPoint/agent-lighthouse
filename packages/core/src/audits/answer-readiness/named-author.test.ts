import { describe, it, expect } from "vitest";
import { NamedAuthorAudit } from "./named-author";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("NamedAuthorAudit", () => {
  const audit = new NamedAuthorAudit();

  it("passes with a named author in JSON-LD", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane Smith"}}
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Named author found in JSON-LD");
    expect(result.message).toContain("Jane Smith");
  });

  it("passes with a named author in meta tag", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><head><meta name="author" content="John Doe"></head><body><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("meta tag");
    expect(result.message).toContain("John Doe");
  });

  it("passes with a visible byline", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><span class="author">Alice Brown</span><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("visible byline");
  });

  it("fails when only a generic author name is present", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><span class="author">Staff</span><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No named author attribution found");
  });

  it("fails when no author info is present", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><article><p>Just content with no author.</p></article></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No named author attribution found");
  });

  it("fails when no pages scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it("passes when author is a plain string name in JSON-LD (not an object)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":"Jane Smith"}
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Jane Smith");
  });

  it("finds author via @graph in JSON-LD", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@type":"Person","name":"Alice Johnson"}}]}
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Alice Johnson");
  });

  it("handles null item in @graph (covers line 14 walk null check)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[null,{"@type":"Article","author":{"@type":"Person","name":"Dana White"}}]}
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Dana White");
  });

  it("finds author when JSON-LD is a top-level array", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        [{"@context":"https://schema.org","@type":"BlogPosting","author":{"@type":"Person","name":"Bob Martin"}}]
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Bob Martin");
  });

  it("handles @type as array with non-string element (covers lines 25-27 Array.isArray + typeof false)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":[null,"Article"],"author":{"@type":"Person","name":"Grace Lee"}}
        </script>
        <p>Content</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Grace Lee");
  });

  it("handles author object without name property (covers line 118 ?? empty-string fallback)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person"}}
        </script>
        <span class="author">Hank Evans</span>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("visible byline");
    expect(result.message).toContain("Hank Evans");
  });

  it("skips generic author string names in JSON-LD and falls through to other checks", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":"Admin"}
        </script>
        <span class="author">Alice Brown</span>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("visible byline");
  });

  it('passes with a visible byline via rel="author"', () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><a rel="author">Carol White</a><p>Content</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("visible byline");
  });

  it("skips Article JSON-LD with no author property (covers line 110 continue)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Article Without Author"}
        </script>
        <p>Content here with no byline.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No named author attribution found");
  });

  it("handles null and valid object in author array (covers lines 112 array branch and 117-118 null fallback)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":[null,{"@type":"Person","name":"Valid Author"}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Valid Author");
  });
});
