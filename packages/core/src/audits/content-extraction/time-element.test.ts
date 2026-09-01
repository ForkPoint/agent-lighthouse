import { describe, it, expect } from "vitest";
import { TimeElementAudit } from "./time-element";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("TimeElementAudit", () => {
  const audit = new TimeElementAudit();

  it('passes when a page uses <time datetime="">', () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><time datetime="2025-01-15">January 15, 2025</time></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.found).toContain("1 page(s)");
  });

  it('fails when no <time datetime=""> elements exist', () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>Jan 15, 2025</p></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No <time datetime");
  });

  it("fails when <time> is present but lacks the datetime attribute", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><time>January 15</time></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
  });
});
