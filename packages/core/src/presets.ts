export const PresetName = {
  Ecommerce: "ecommerce",
  Saas: "saas",
  Content: "content",
  Quick: "quick",
  Full: "full",
} as const;

export type PresetName = (typeof PresetName)[keyof typeof PresetName];

export interface PresetOptions {
  name: PresetName;
  description: string;
  categoryFilter?: string[];
  customWeights?: Record<string, number>;
  maxPages?: number;
}

export const PRESETS: Record<PresetName, PresetOptions> = {
  [PresetName.Ecommerce]: {
    name: PresetName.Ecommerce,
    description:
      "Optimized for storefronts with heavy focus on Schema.org Product, SKU, GTIN, stock status, and WebMCP actions.",
    customWeights: {
      "agent-interfaces": 30,
      "structured-data": 20,
      "agentic-commerce": 5,
      "access-crawl-control": 15,
      "machine-discovery": 10,
      "answer-readiness": 15,
      "content-extraction": 5,
    },
  },
  [PresetName.Saas]: {
    name: PresetName.Saas,
    description:
      "Optimized for software and developer tools focusing on OpenAPI discovery, llms.txt, API permissions, and bot crawling.",
    customWeights: {
      "agent-interfaces": 30,
      "machine-discovery": 20,
      "access-crawl-control": 20,
      "operability-safety": 15,
      "answer-readiness": 15,
    },
  },
  [PresetName.Content]: {
    name: PresetName.Content,
    description:
      "Optimized for blogs and publications focusing on llms.txt, RSS feeds, article markup, author credentials, and citations.",
    customWeights: {
      "answer-readiness": 60,
      "machine-discovery": 25,
      "content-extraction": 15,
    },
  },
  [PresetName.Quick]: {
    name: PresetName.Quick,
    description:
      "Fast single-page scan checking only root files (robots.txt, llms.txt, sitemaps) and the homepage.",
    maxPages: 1,
  },
  [PresetName.Full]: {
    name: PresetName.Full,
    description: "Default comprehensive scan executing all 8 audit categories.",
  },
};

export function getPreset(name?: string | null): PresetOptions {
  if (!name) return PRESETS.full;
  const key = name.toLowerCase() as PresetName;
  return PRESETS[key] ?? PRESETS.full;
}
