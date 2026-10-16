import { describe, expect, it } from "vitest";
import { getPreset, PRESETS, PresetName } from "./presets";

describe("getPreset", () => {
  it.each([undefined, null, "", "unknown"])(
    "uses the full scan for %s",
    (name) => {
      expect(getPreset(name)).toBe(PRESETS.full);
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
});
