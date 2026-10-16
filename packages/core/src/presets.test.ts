import { describe, expect, it } from "vitest";
import { getPreset, PRESETS, PresetName } from "./presets";

describe("getPreset", () => {
  it.each([undefined, null, "", "unknown"])(
    "uses the full scan for %s",
    (name) => {
      expect(getPreset(name)).toBe(PRESETS.full);
      expect(getPreset(name).categoryFilter).toBeUndefined();
    },
  );

  it.each([
    PresetName.Ecommerce,
    PresetName.Saas,
    PresetName.Content,
    PresetName.Quick,
    PresetName.Full,
  ] as const)("accepts %s in mixed case", (name) => {
    expect(getPreset(name)).toBe(PRESETS[name]);
    expect(getPreset(name.toUpperCase())).toBe(PRESETS[name]);
  });

  it.each(["ecommerce", "saas", "content"] as const)(
    "allocates 100 weight points for %s",
    (name) => {
      const weights = Object.values(getPreset(name).customWeights!);
      expect(weights.every((weight) => weight > 0)).toBe(true);
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100);
    },
  );
});
