import { describe, it, expect } from "vitest";
import { defaultConfig } from "../audit-config";
import { bareSiteContext } from "./fixtures";

/**
 * What a site that has done nothing wrong is told.
 *
 * A snapshot rather than an assertion, because unlike the unreachable fixture
 * there is no single right answer here: a page with no `<main>` really is
 * harder to extract from, and `https-enabled` really does pass. What this buys
 * is that no later change can move a verdict about a bare site without a
 * reviewer seeing exactly which one moved and saying why.
 *
 * Audits are constructed and called directly, not planned, so this records what
 * each audit decides rather than what the gate lets through.
 */
describe("a bare but real site", () => {
  it("is told this, and only this", async () => {
    const rows: string[] = [];
    const registeredIds: string[] = [];
    for (const cat of defaultConfig.categories) {
      for (const reg of defaultConfig.audits[cat.id] ?? []) {
        const result = await reg.create().audit(bareSiteContext());
        registeredIds.push(reg.meta.id);
        rows.push(
          `${result.status.padEnd(4)} ${String(reg.meta.weight).padEnd(3)} ${reg.meta.id}`,
        );
      }
    }
    expect(rows.map((row) => row.trim().split(/\s+/).at(-1)).sort()).toEqual(
      registeredIds.sort(),
    );
    expect(rows.sort().join("\n")).toMatchSnapshot();
  });
});
