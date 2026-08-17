export type PresetName = 'ecommerce' | 'saas' | 'content' | 'quick' | 'full';

export interface PresetOptions {
  name: PresetName;
  description: string;
  categoryFilter?: string[];
  customWeights?: Record<string, number>;
  maxPages?: number;
}

export const PRESETS: Record<PresetName, PresetOptions> = {
  ecommerce: {
    name: 'ecommerce',
    description: 'Optimized for storefronts with heavy focus on Schema.org Product, SKU, GTIN, stock status, and WebMCP actions.',
    customWeights: {
      'structured-data': 25,
      'agent-tools': 25,
      'crawler-permissions': 15,
      'content-discoverability': 10,
      'answer-engine': 10,
      'generative-engine': 5,
      'meta-tags': 5,
      'semantic-html': 5,
    },
  },
  saas: {
    name: 'saas',
    description: 'Optimized for software and developer tools focusing on OpenAPI discovery, llms.txt, API permissions, and bot crawling.',
    customWeights: {
      'agent-tools': 30,
      'content-discoverability': 20,
      'crawler-permissions': 20,
      'technical-readiness': 15,
      'answer-engine': 15,
    },
  },
  content: {
    name: 'content',
    description: 'Optimized for blogs and publications focusing on llms.txt, RSS feeds, article markup, author credentials, and citations.',
    customWeights: {
      'content-discoverability': 25,
      'generative-engine': 25,
      'answer-engine': 20,
      'semantic-html': 15,
      'meta-tags': 15,
    },
  },
  quick: {
    name: 'quick',
    description: 'Fast single-page scan checking only root files (robots.txt, llms.txt, sitemaps) and the homepage.',
    maxPages: 1,
  },
  full: {
    name: 'full',
    description: 'Default comprehensive scan executing all 10 audit categories.',
  },
};

export function getPreset(name?: string | null): PresetOptions {
  if (!name) return PRESETS.full;
  const key = name.toLowerCase() as PresetName;
  return PRESETS[key] ?? PRESETS.full;
}
