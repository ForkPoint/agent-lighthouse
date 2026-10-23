import { describe, expect, it } from "vitest";
import { getRegistrySummary } from "@forkpoint/agent-lighthouse-core";
import { formatRegistrySummary } from "./registry";

describe("formatRegistrySummary", () => {
  const summary = getRegistrySummary();
  const text = formatRegistrySummary(summary);

  it("states the version and every total from the summary", () => {
    expect(text).toContain(`Agent Lighthouse core ${summary.version}`);
    expect(text).toContain(
      `${summary.audits} audits in ${summary.categories} categories`,
    );
    for (const [tier, count] of Object.entries(summary.tiers))
      expect(text).toContain(`${count} ${tier}`);
  });

  it("lists every category once", () => {
    for (const category of summary.byCategory)
      expect(text.split(category.name)).toHaveLength(2);
  });
});
