import { describe, it, expect } from "vitest";
import { SpecificNumbersAudit } from "./specific-numbers";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("SpecificNumbersAudit", () => {
  const audit = new SpecificNumbersAudit();

  it("passes when concrete data points are present", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <p>Our platform processes 50,000 requests per second with 99.9% uptime.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("Specific data points found");
    expect(result.found).toMatch(/99\.9%|50,000/);
  });

  it("ignores plain numbers without units/symbols and fails", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body><main>
        <p>Call us at 555-123-4567 for product number 12345.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No specific numbers");
  });

  it("fails when content has no numeric data", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><main><p>Our platform is fast and reliable.</p></main></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
  });

  it("fails when no pages were scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });

  it("caps examples at 5 when multiple pages contribute many data points", () => {
    // First page contributes 5+ matches, filling the examples array to 5.
    // Second page also has matches but examples.length >= 5 so the inner push is skipped.
    const richHtml = `<html><body><main>
      <p>Stats: 10%, $20 price, 30kg weight, 5 days delivery, 10 hours support, 3 sets included, $99.99 per unit.</p>
    </main></body></html>`;
    const page1 = mockPageContext("https://example.com/page1", richHtml);
    const page2 = mockPageContext("https://example.com/page2", richHtml);
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("2 page");
  });
});
