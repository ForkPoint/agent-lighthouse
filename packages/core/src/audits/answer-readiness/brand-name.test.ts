import { describe, it, expect } from "vitest";
import { BrandNameAudit } from "./brand-name";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("BrandNameAudit", () => {
  const audit = new BrandNameAudit();

  it("passes when the brand (legal-suffix stripped) appears in the footer", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Knix Inc."}
        </script>
        <main><p>Welcome to our site.</p></main>
        <footer>© 2026 Knix. All rights reserved.</footer>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Knix");
    expect(result.message).toContain("appears in body text");
  });

  it("passes when og:site_name brand appears in body text", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><head><meta property="og:site_name" content="Acme Tools"></head>
        <body><p>At Acme Tools we build great things.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Acme Tools");
  });

  it("fails when the brand name is absent from body text", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Knix"}
        </script>
        <p>This page never mentions the company name.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("not found in body text");
  });

  it("warns when there is no org name in schema or og:site_name", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body><p>Some generic content.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("No organization name found");
  });

  it("fails when no pages scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it("passes when brand name found via WebSite JSON-LD with publisher name in body", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"WebSite","name":"Acme","publisher":{"@type":"Organization","name":"Acme Corp"}}
        </script>
        <p>Welcome to Acme. We build great tools.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Acme");
  });

  it("passes when brand name found via Article JSON-LD publisher", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Some Article","publisher":{"@type":"Organization","name":"TechCo"}}
        </script>
        <main><p>This is published by TechCo, a leading technology company.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("TechCo");
  });

  it("handles Article JSON-LD without publisher gracefully", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Some Article"}
        </script>
        <main><p>Some Article content here about Some Article.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("appears in body text");
  });

  it("handles nodes without @type from flattenJsonLd (covers line 16 !objType return false)", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Acme","contact":{"email":"info@acme.com"}}
        </script>
        <p>Welcome to Acme. We build great tools.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Acme");
  });

  it("handles @type as array in findJsonLdByType filter (covers line 17 Array.isArray true branch)", () => {
    const page = mockPageContext(
      "https://example.com/",
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":["Organization","LocalBusiness"],"name":"WidgetCo"}
        </script>
        <p>Welcome to WidgetCo. We make great widgets.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("WidgetCo");
  });
});
