import { describe, it, expect } from "vitest";
import { planAudits } from "../audit-runner";
import { defaultConfig } from "../audit-config";
import { unreachableContext } from "./fixtures";

/**
 * The one absolute rule in the registry: a scan that could not read the site
 * says nothing about it.
 *
 * There is deliberately no exemption list here, and adding one is a visible
 * change to this file rather than a line in a meta somewhere. Every law this
 * project has lost, it lost to an exemption that looked reasonable on the day
 * it was added.
 */
describe("an unread scan verdicts nothing", () => {
  it("leaves no audit runnable", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);

    const registered = defaultConfig.categories.reduce(
      (sum, cat) => sum + (defaultConfig.audits[cat.id]?.length ?? 0),
      0,
    );

    expect(plan.runnable.map((entry) => entry.reg.meta.id)).toEqual([]);
    expect(plan.skipped).toHaveLength(registered);
  });

  it("gives every skipped audit a reason a reader can act on", () => {
    const plan = planAudits(unreachableContext(), defaultConfig);
    for (const stub of plan.skipped) {
      expect(stub.status, stub.id).toBe("na");
      expect(stub.explanation, stub.id).toMatch(/^Not assessed: /);
      expect(stub.score, stub.id).toBe(0);
    }
  });
});
