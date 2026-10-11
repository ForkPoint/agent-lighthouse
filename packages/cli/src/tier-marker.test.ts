import { describe, it, expect } from "vitest";
import { tierMarker } from "./tier-marker";
import { AuditTier } from "@forkpoint/agent-lighthouse-core";

describe("tierMarker", () => {
  it("marks an informative check as advisory", () => {
    expect(tierMarker(AuditTier.Informative)).toContain("(advisory)");
  });

  it("marks an experimental check", () => {
    expect(tierMarker(AuditTier.Experimental)).toContain("(experimental)");
  });

  it("says nothing for a scored check or an unknown tier", () => {
    expect(tierMarker(AuditTier.Scored)).toBe("");
    expect(tierMarker(undefined)).toBe("");
  });
});
