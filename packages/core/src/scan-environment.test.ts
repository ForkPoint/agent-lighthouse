import { describe, expect, it } from "vitest";
import {
  scanNow,
  scanRandom,
  scanRandomHex,
  seededRandom,
  withScanEnvironment,
} from "./scan-environment";

describe("scan environment", () => {
  it("reads the machine's clock and random numbers outside a scan", () => {
    const before = Date.now();
    expect(scanNow()).toBeGreaterThanOrEqual(before);
    expect(scanRandom()).toBeGreaterThanOrEqual(0);
  });

  it("gives work started inside a scan the scan's clock", async () => {
    const now = await withScanEnvironment({ now: () => 42 }, async () => {
      await Promise.resolve();
      return scanNow();
    });
    expect(now).toBe(42);
  });

  it("keeps an outer setting that an inner scope does not replace", () => {
    const seen = withScanEnvironment({ now: () => 7 }, () =>
      withScanEnvironment({ random: () => 0.5 }, () => [
        scanNow(),
        scanRandom(),
      ]),
    );
    expect(seen).toEqual([7, 0.5]);
  });

  it("repeats a seeded sequence and varies it with the seed", () => {
    const a = seededRandom("scan-1");
    const b = seededRandom("scan-1");
    const c = seededRandom("scan-2");
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("makes the same hex token from the same seed", () => {
    const token = () =>
      withScanEnvironment({ random: seededRandom("scan-1") }, () =>
        scanRandomHex(16),
      );
    expect(token()).toMatch(/^[0-9a-f]{32}$/);
    expect(token()).toBe(token());
  });
});
