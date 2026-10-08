import { describe, it, expect } from "vitest";
import { OgImageAltAudit } from "./og-image-alt";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

const doc = (head: string) =>
  `<html lang="en"><head>${head}</head><body></body></html>`;

describe("OgImageAltAudit", () => {
  const audit = new OgImageAltAudit();

  it("passes when og:image and og:image:alt are both present", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(
          '<meta property="og:image" content="https://example.com/i.png"><meta property="og:image:alt" content="A dashboard screenshot">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("A dashboard screenshot");
  });

  it("fails when og:image is set but og:image:alt is missing", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta property="og:image" content="https://example.com/i.png">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("og:image:alt is missing");
  });

  it("warns when there is no og:image (alt not applicable)", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", doc("")),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("No og:image");
  });

  it("warns when there are no pages", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.Warn);
  });
});
