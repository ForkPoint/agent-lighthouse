import { describe, it, expect } from "vitest";
import { FrameTitleAudit } from "./frame-title";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("FrameTitleAudit", () => {
  it("registers under the frame-title id with its dossier and grade", () => {
    expect(FrameTitleAudit.meta.id).toBe("operability-safety/frame-title");
    expect(FrameTitleAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/frame-title.md",
    );
    expect(FrameTitleAudit.meta.evidenceGrade).toBe("C");
    expect(FrameTitleAudit.meta.tier).toBe("informative");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "frame-title": { status: "pass", nodes: [] },
        "frame-title-unique": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(FrameTitleAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: frame-title, frame-title-unique",
    );
  });

  it("fails when the `frame-title` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "frame-title": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "frame-title-unique": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(FrameTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `frame-title-unique` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "frame-title": { status: "pass", nodes: [] },
        "frame-title-unique": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(FrameTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "frame-title": { status: "pass", nodes: [] },
        "frame-title-unique": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(FrameTitleAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "frame-title": { status: "inapplicable", nodes: [] },
        "frame-title-unique": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(FrameTitleAudit, ctx).status).toBe("na");
  });
});
