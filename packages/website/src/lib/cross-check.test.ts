import { describe, it, expect } from "vitest";
import { crossCheck } from "./cross-check";
import { auditList, categoryList } from "./registry";

describe("crossCheck", () => {
  it("passes when both sides carry the same ids", () => {
    expect(() => crossCheck(["a/b"], ["a/b"])).not.toThrow();
  });

  it("names an audit that has no dossier", () => {
    expect(() => crossCheck(["a/b", "a/c"], ["a/b"])).toThrow(/a\/c/);
  });

  it("names a dossier that has no audit", () => {
    expect(() => crossCheck(["a/b"], ["a/b", "a/orphan"])).toThrow(/a\/orphan/);
  });
});

describe("registry", () => {
  it("reads the live registry rather than a snapshot", () => {
    const audits = auditList();
    expect(audits.length).toBeGreaterThan(200);
    const one = audits.find(
      (a) => a.id === "agentic-commerce/offer-truth-consistency",
    );
    expect(one?.evidenceGrade).toBe("B");
    expect(one?.tier).toBe("scored");
  });

  it("groups every audit under a known category", () => {
    const categories = new Set(categoryList().map((c) => c.id));
    for (const audit of auditList())
      expect(categories.has(audit.category), audit.id).toBe(true);
  });
});
