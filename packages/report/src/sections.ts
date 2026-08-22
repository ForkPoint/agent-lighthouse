/**
 * The 3 top-level section groups every surface rolls categories into.
 *
 * This is the single source of truth for grouping — previously duplicated as
 * `SECTION_GROUP_IDS` in the web report page and re-implemented ad-hoc in the
 * PDF and shared-report renderers. Surfaces resolve `key` to a localized label.
 */
export interface SectionGroupDef {
  /** Stable key; surfaces map this to a localized label/description. */
  key: string;
  categoryIds: string[];
}

export const SECTION_GROUPS: SectionGroupDef[] = [
  {
    key: 'agenticReadiness',
    categoryIds: [
      'agent-interfaces',
      'agentic-commerce',
      'machine-discovery',
      'access-crawl-control',
    ],
  },
  {
    key: 'aiSearchOptimization',
    categoryIds: ['answer-readiness', 'content-extraction'],
  },
  {
    key: 'technicalFoundation',
    categoryIds: ['structured-data', 'operability-safety'],
  },
];

/** English fallback labels for surfaces without an i18n layer (CLI, MCP). */
export const SECTION_GROUP_LABELS: Record<string, string> = {
  agenticReadiness: 'Agentic Readiness',
  aiSearchOptimization: 'AI Search Optimization',
  technicalFoundation: 'Technical Foundation',
};

/** Canonical category order (section groups flattened). */
export const CATEGORY_ORDER: string[] = SECTION_GROUPS.flatMap((g) => g.categoryIds);

// Coverage tags live in @forkpoint/agent-lighthouse-core (produced by the scanner, consumed here).
export { TAG_SKIPPED_PAGE_TYPE, TAG_SCAN_ERROR } from '@forkpoint/agent-lighthouse-core';
