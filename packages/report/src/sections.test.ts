import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@forkpoint/agent-lighthouse-core';
import { CATEGORY_ORDER, SECTION_GROUPS } from './sections';

/** The categories the scanner registry can emit — the single source of truth. */
const REGISTRY_CATEGORY_IDS = defaultConfig.categories.map((c) => c.id);

describe('SECTION_GROUPS ↔ core taxonomy', () => {
  // buildReportView keeps only categories listed in CATEGORY_ORDER (which is
  // SECTION_GROUPS flattened). A category the scanner produces but the groups
  // never name is dropped from every report surface — web, PDF, CLI, MCP —
  // while coverage and topFixes still count its checks, so the report
  // contradicts itself. Renaming a category in core must therefore be mirrored
  // here, and this test is what makes that failure loud.
  it('names every scored category that core can emit', () => {
    const missing = REGISTRY_CATEGORY_IDS.filter((id) => !CATEGORY_ORDER.includes(id));
    expect(missing).toEqual([]);
  });

  it('names no category core does not know about', () => {
    const unknown = CATEGORY_ORDER.filter((id) => !REGISTRY_CATEGORY_IDS.includes(id));
    expect(unknown).toEqual([]);
  });

  it('lists each category exactly once across the groups', () => {
    expect(new Set(CATEGORY_ORDER).size).toBe(CATEGORY_ORDER.length);
    expect(SECTION_GROUPS.flatMap((g) => g.categoryIds)).toEqual(CATEGORY_ORDER);
  });
});
