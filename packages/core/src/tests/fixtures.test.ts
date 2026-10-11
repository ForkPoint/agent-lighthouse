import { describe, it, expect } from "vitest";
import { unreachableContext, bareSiteContext } from "./fixtures";
import { scanReadTheSite } from "#core/scan-evidence";
import { EvidenceKey, PageType } from "#core/types";

describe("unreachableContext", () => {
  it("is not judgeable, and says why", () => {
    const ctx = unreachableContext();
    expect(scanReadTheSite(ctx.evidence)).toBe(false);
    expect(ctx.evidence.reasons[EvidenceKey.OriginReachable]).toContain(
      "ENOTFOUND",
    );
  });

  it("claims no page types, having fetched no pages", () => {
    const ctx = unreachableContext();
    expect(ctx.pages).toHaveLength(0);
    expect(ctx.evidence.usablePageTypes.size).toBe(0);
    expect(ctx.evidence.met[EvidenceKey.RenderedBody]).toBe(false);
  });
});

describe("bareSiteContext", () => {
  it("is judgeable and served readable text", () => {
    const ctx = bareSiteContext();
    expect(scanReadTheSite(ctx.evidence)).toBe(true);
    expect(ctx.evidence.met[EvidenceKey.RenderedBody]).toBe(true);
    expect(ctx.evidence.usablePageTypes.has(PageType.Homepage)).toBe(true);
  });

  it("adopted no optional convention", () => {
    const ctx = bareSiteContext();
    expect(ctx.rootFiles).toEqual({});
    expect(ctx.pages[0]!.jsonLd).toHaveLength(0);
    expect(ctx.pages[0]!.headLinks).toHaveLength(0);
  });
});
