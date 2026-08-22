import type { AuditMeta } from './types';
import type { Audit } from './audit';
import { CATEGORY_NAMES } from './constants';

import { ACCESS_CRAWL_CONTROL_AUDITS } from './audits/access-crawl-control';
import { CONTENT_EXTRACTION_AUDITS } from './audits/content-extraction';
import { MACHINE_DISCOVERY_AUDITS } from './audits/machine-discovery';
import { STRUCTURED_DATA_AUDITS } from './audits/structured-data';
import { ANSWER_READINESS_AUDITS } from './audits/answer-readiness';
import { AGENT_INTERFACES_AUDITS } from './audits/agent-interfaces';
import { AGENTIC_COMMERCE_AUDITS } from './audits/agentic-commerce';
import { OPERABILITY_SAFETY_AUDITS } from './audits/operability-safety';

// ── Category Config ─────────────────────────────────────────────

export interface CategoryConfig {
  id: string;
  name: string;
  /**
   * Evidence mass: the summed weight of the category's registered audits
   * (spec §4). Relative, not a percentage — `calculateOverallScore` normalizes
   * by the total mass, so a category with no scored audits weighs nothing.
   */
  weight: number;
}

// ── Audit Registration ──────────────────────────────────────────

export interface AuditRegistration {
  /** Construct an audit instance. */
  create: () => Audit;
  /** The audit's static meta (copied here for fast access without instantiation). */
  meta: AuditMeta;
}

export interface ScanConfig {
  categories: CategoryConfig[];
  /** categoryId → list of audit registrations */
  audits: Record<string, AuditRegistration[]>;
}

// ── Helper ──────────────────────────────────────────────────────

type AuditClass = typeof Audit;

function reg(AuditClass: AuditClass): AuditRegistration {
  return {
    create: () => new (AuditClass as unknown as new () => Audit)(),
    meta: AuditClass.meta,
  };
}

// ── The 8 v2 categories ─────────────────────────────────────────

/**
 * The v2 taxonomy (spec §3): 8 categories, each sourced verbatim from its
 * category `index.ts` registry so the registry has exactly one source of
 * truth — adding an audit to a category folder registers it here.
 *
 * Order is the canonical report order.
 */
const CATEGORY_AUDITS: ReadonlyArray<readonly [id: string, audits: readonly AuditClass[]]> = [
  ['access-crawl-control', ACCESS_CRAWL_CONTROL_AUDITS],
  ['content-extraction', CONTENT_EXTRACTION_AUDITS],
  ['machine-discovery', MACHINE_DISCOVERY_AUDITS],
  ['structured-data', STRUCTURED_DATA_AUDITS],
  ['answer-readiness', ANSWER_READINESS_AUDITS],
  ['agent-interfaces', AGENT_INTERFACES_AUDITS],
  ['agentic-commerce', AGENTIC_COMMERCE_AUDITS],
  ['operability-safety', OPERABILITY_SAFETY_AUDITS],
];

/**
 * Evidence mass per category: Σ of the member audits' weights (spec §4).
 *
 * This replaces the old hand-tuned `CATEGORY_WEIGHTS` map. A category earns
 * influence over the overall score by carrying proven audits, so moving an
 * audit between categories moves its mass with it and nothing else changes.
 * Categories made entirely of informative/experimental audits have mass 0 and
 * cannot move the overall score.
 */
export const CATEGORY_MASS: Record<string, number> = Object.fromEntries(
  CATEGORY_AUDITS.map(([id, audits]) => [
    id,
    audits.reduce((sum, AuditClass) => sum + AuditClass.meta.weight, 0),
  ]),
);

// ── Default Config ──────────────────────────────────────────────

export const defaultConfig: ScanConfig = {
  categories: CATEGORY_AUDITS.map(([id]) => ({
    id,
    name: CATEGORY_NAMES[id] ?? id,
    weight: CATEGORY_MASS[id] ?? 0,
  })),
  audits: Object.fromEntries(
    CATEGORY_AUDITS.map(([id, audits]) => [id, audits.map((AuditClass) => reg(AuditClass))]),
  ),
};
