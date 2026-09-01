import { describe, it, expect } from "vitest";
import { UniqueDataAudit } from "./unique-data";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";

describe("UniqueDataAudit", () => {
  const audit = new UniqueDataAudit();

  it("passes with 3+ citable statistics (%/currency/grouped-thousands)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>73% prefer it, it costs $2,500, and reaches 1,200 users.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("pass");
    expect(result.message).toContain("data points");
  });

  it("warns with only 1-2 data points", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Only 73% of users agreed.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("warn");
    expect(result.message).toContain("data point");
  });

  it("fails when only bare decimals are present (tightened pattern)", () => {
    const page = mockPageContext(
      "https://example.com/blog/post",
      `<html><body><main><p>Shoe size 9.5 and software version 2.0 are here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No numbers, percentages, or data points");
  });

  it("fails when no pages scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("fail");
    expect(result.message).toContain("No pages scanned");
  });
});
