import { describe, it, expect } from "vitest";
import { AuthorPageAudit } from "./author-page";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";

describe("AuthorPageAudit", () => {
  const audit = new AuthorPageAudit();

  it("passes when the author page URL returns 200", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("returns 200");
  });

  it("fails when no author page links are found", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><p>No author links here.</p></body></html>`,
    );
    const result = await audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No author page links found");
  });

  it("fails when the author page returns a non-200 status", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("", 404);
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("HTTP 404");
  });

  it("fails when no pages scanned", async () => {
    const result = await audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it('finds author URL via HTML rel="author" link and passes when fetch returns 200', async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <a rel="author" href="/authors/jane">Jane Smith</a>
        <p>Article content</p>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it('finds author URL via class*="author" link', async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <div class="author-bio"><a href="/authors/john">John Doe</a></div>
        <p>Article content</p>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("fails when fetching the author page throws a network error", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => {
      throw new Error("Network error");
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Failed to fetch");
  });

  it("finds author URL in JSON-LD via @graph and passes when fetch returns 200", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}]}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("finds author URL when JSON-LD is a top-level array", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        [{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}]
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("finds author URL when author is an array of person objects", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":[{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"},{"@type":"Person","name":"John"}]}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("handles @type as array with non-string element (covers lines 25-27 Array.isArray + typeof false)", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":[null,"Article"],"author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("handles null in @graph (covers line 14 walk null check)", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[null,{"@type":"Article","author":{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}}]}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("skips Article with no author property (covers line 97 continue)", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Article Without Author"}
        </script>
        <p>No author info here.</p>
      </body></html>`,
    );
    const result = await audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No author page links found");
  });

  it("handles null in author array (covers line 100 false branch)", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":[null,{"@type":"Person","name":"Jane","url":"https://example.com/authors/jane"}]}
        </script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult("bio page", 200, "text/html");
    const result = await audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("ignores HTML author anchor with no href attribute (covers line 113 if(href) false branch)", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <a rel="author">Author With No Link</a>
        <p>No JSON-LD or valid author URL here.</p>
      </body></html>`,
    );
    const result = await audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No author page links found");
  });

  it("covers catch block when page URL is invalid making relative href resolution throw", async () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <a rel="author" href="/authors/jane">Jane Smith</a>
      </body></html>`,
    );
    page.url = ":::not-a-valid-url:::";
    const result = await audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No author page links found");
  });
});
