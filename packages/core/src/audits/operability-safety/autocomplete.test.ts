import { describe, it, expect } from "vitest";
import { AutocompleteAudit } from "./autocomplete";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";

describe("AutocompleteAudit", () => {
  it("registers under the autocomplete id with its dossier and grade", () => {
    expect(AutocompleteAudit.meta.id).toBe("operability-safety/autocomplete");
    expect(AutocompleteAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/autocomplete.md",
    );
    expect(AutocompleteAudit.meta.evidenceGrade).toBe("A");
    expect(AutocompleteAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "autocomplete-valid": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AutocompleteAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: autocomplete-valid",
    );
  });

  it("fails when the `autocomplete-valid` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "autocomplete-valid": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AutocompleteAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "autocomplete-valid": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AutocompleteAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "autocomplete-valid": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AutocompleteAudit, ctx).status).toBe("na");
  });
});
