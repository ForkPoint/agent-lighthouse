import { describe, it, expect } from "vitest";
import { DocumentTitleAudit } from "./document-title";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("DocumentTitleAudit", () => {
  it("registers under the document-title id with its dossier and grade", () => {
    expect(DocumentTitleAudit.meta.id).toBe(
      "operability-safety/document-title",
    );
    expect(DocumentTitleAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/document-title.md",
    );
    expect(DocumentTitleAudit.meta.evidenceGrade).toBe("A");
    expect(DocumentTitleAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(DocumentTitleAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: document-title");
  });

  it("fails when the `document-title` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(DocumentTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DocumentTitleAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DocumentTitleAudit, ctx).status).toBe("na");
  });

  // Ported from the former _a11y.test.ts (aggregation cases).
  it("fails when any constituent rule has a violation on any page", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": { status: "pass", nodes: [] },
      }),
      pageWithA11y("https://example.com/p", {
        "document-title": {
          status: "fail",
          nodes: [{ target: "html", summary: "no title" }],
        },
      }),
    ]);
    const result = runA11yAudit(DocumentTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("html");
  });

  it("caps collected failing selectors at 5 even when more nodes fail", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": {
          status: "fail",
          nodes: [
            { target: "#a", summary: "" },
            { target: "#b", summary: "" },
            { target: "#c", summary: "" },
            { target: "#d", summary: "" },
            { target: "#e", summary: "" },
            { target: "#f", summary: "" }, // 6th — must be dropped
          ],
        },
      }),
    ]);
    const result = runA11yAudit(DocumentTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#a");
    expect(result.found).not.toContain("#f");
  });

  it('falls back to "see report" in found when a failing rule has no nodes', () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "document-title": { status: "fail", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(DocumentTitleAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("see report");
  });
});
