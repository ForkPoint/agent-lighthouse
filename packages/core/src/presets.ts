export const PresetName = {
  Ecommerce: "ecommerce",
  Saas: "saas",
  Content: "content",
  Quick: "quick",
  Full: "full",
} as const;

export type PresetName = (typeof PresetName)[keyof typeof PresetName];

/**
 * A preset is a name recorded in the run header. It does not change which
 * audits run or how they score: evidence mass decides weights, and
 * `--categories` narrows a scan.
 */
export interface PresetOptions {
  name: PresetName;
}

export const PRESETS: Record<PresetName, PresetOptions> = {
  [PresetName.Ecommerce]: { name: PresetName.Ecommerce },
  [PresetName.Saas]: { name: PresetName.Saas },
  [PresetName.Content]: { name: PresetName.Content },
  [PresetName.Quick]: { name: PresetName.Quick },
  [PresetName.Full]: { name: PresetName.Full },
};

export function getPreset(name?: string | null): PresetOptions {
  if (!name) return PRESETS.full;
  const key = name.toLowerCase() as PresetName;
  return PRESETS[key] ?? PRESETS.full;
}
