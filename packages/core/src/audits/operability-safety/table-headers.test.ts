import { describe, it, expect } from "vitest";
import { TableHeadersAudit } from "./table-headers";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("TableHeadersAudit", () => {
  it("registers under the table-headers id with its dossier and grade", () => {
    expect(TableHeadersAudit.meta.id).toBe("operability-safety/table-headers");
    expect(TableHeadersAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/table-headers.md",
    );
    expect(TableHeadersAudit.meta.evidenceGrade).toBe("B");
    expect(TableHeadersAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "pass", nodes: [] },
        "th-has-data-cells": { status: "pass", nodes: [] },
        "td-headers-attr": { status: "pass", nodes: [] },
        "scope-attr-valid": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: td-has-header, th-has-data-cells, td-headers-attr, scope-attr-valid",
    );
  });

  it("fails when the `td-has-header` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "th-has-data-cells": { status: "pass", nodes: [] },
        "td-headers-attr": { status: "pass", nodes: [] },
        "scope-attr-valid": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `th-has-data-cells` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "pass", nodes: [] },
        "th-has-data-cells": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "td-headers-attr": { status: "pass", nodes: [] },
        "scope-attr-valid": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `td-headers-attr` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "pass", nodes: [] },
        "th-has-data-cells": { status: "pass", nodes: [] },
        "td-headers-attr": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "scope-attr-valid": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("fails when the `scope-attr-valid` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "pass", nodes: [] },
        "th-has-data-cells": { status: "pass", nodes: [] },
        "td-headers-attr": { status: "pass", nodes: [] },
        "scope-attr-valid": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "pass", nodes: [] },
        "th-has-data-cells": { status: "pass", nodes: [] },
        "td-headers-attr": { status: "pass", nodes: [] },
        "scope-attr-valid": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TableHeadersAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "inapplicable", nodes: [] },
        "th-has-data-cells": { status: "inapplicable", nodes: [] },
        "td-headers-attr": { status: "inapplicable", nodes: [] },
        "scope-attr-valid": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TableHeadersAudit, ctx).status).toBe("na");
  });

  // Ported from the former _a11y.test.ts (aggregation cases).
  it("returns na when every constituent rule is inapplicable / unseen", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "td-has-header": { status: "inapplicable", nodes: [] },
        "th-has-data-cells": { status: "inapplicable", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TableHeadersAudit, ctx);
    expect(result.status).toBe("na");
  });
});
