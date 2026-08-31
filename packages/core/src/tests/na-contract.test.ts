import { describe, it, expect } from "vitest";
import { expectNotApplicableOnEmpty } from "./na-contract";

describe("expectNotApplicableOnEmpty", () => {
  it("rejects an audit that verdicts on a scan that read nothing", async () => {
    const passing = { audit: () => ({ status: "pass" as const, score: 1 }) };
    await expect(expectNotApplicableOnEmpty(passing)).rejects.toThrow(
      /vacuous pass/,
    );
  });

  it("accepts an audit that declines", async () => {
    const declining = { audit: () => ({ status: "na" as const, score: 0 }) };
    await expect(
      expectNotApplicableOnEmpty(declining),
    ).resolves.toBeUndefined();
  });

  // The fixture must not claim evidence it does not hold. The version this
  // replaces set `judgeable: true` with zero pages, so the helper's own name
  // was the only thing describing the scan.
  it("runs the audit against a scan that admits it read nothing", async () => {
    let sawJudgeable: boolean | undefined;
    await expectNotApplicableOnEmpty({
      audit: (ctx) => {
        sawJudgeable = ctx.evidence.judgeable;
        return { status: "na" as const, score: 0 };
      },
    });
    expect(sawJudgeable).toBe(false);
  });
});
