import type { AuditMeta } from "./types";
import type { Audit } from "./audit";
import { CATEGORY_NAMES, Category } from "./contracts";

// The published category list lives in `contracts.ts`.
export { CATEGORY_IDS } from "./contracts";

import { ACCESS_CRAWL_CONTROL_AUDITS } from "./audits/access-crawl-control";
import { CONTENT_EXTRACTION_AUDITS } from "./audits/content-extraction";
import { MACHINE_DISCOVERY_AUDITS } from "./audits/machine-discovery";
import { STRUCTURED_DATA_AUDITS } from "./audits/structured-data";
import { ANSWER_READINESS_AUDITS } from "./audits/answer-readiness";
import { AGENT_INTERFACES_AUDITS } from "./audits/agent-interfaces";
import { AGENTIC_COMMERCE_AUDITS } from "./audits/agentic-commerce";
import { OPERABILITY_SAFETY_AUDITS } from "./audits/operability-safety";
import { AuditTier } from "./types";

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

type AuditClass = { new (): Audit; readonly meta: AuditMeta };

function reg(AuditClass: AuditClass): AuditRegistration {
  return {
    create: () => new AuditClass(),
    meta: AuditClass.meta,
  };
}

// ── The 8 v2 categories ─────────────────────────────────────────

/**
 * The v2 taxonomy (spec §3): 8 categories, each sourced verbatim from its
 * category `index.ts` registry so the registry has exactly one source of
 * truth — adding an audit to a category folder registers it here.
 *
 * Keyed by `Category`, so the type checker rejects a category that is
 * missing here or missing from `contracts.ts`. Order is `CATEGORY_IDS`, which
 * is what a raw scan iterates. The report's display order is owned by
 * `SECTION_GROUPS` / `CATEGORY_ORDER` in `@forkpoint/agent-lighthouse-report`'s
 * `sections.ts`, which groups the categories into sections; the two lists are
 * not required to agree.
 */
const AUDITS_BY_CATEGORY: Record<Category, readonly AuditClass[]> = {
  [Category.AccessCrawlControl]: ACCESS_CRAWL_CONTROL_AUDITS,
  [Category.ContentExtraction]: CONTENT_EXTRACTION_AUDITS,
  [Category.MachineDiscovery]: MACHINE_DISCOVERY_AUDITS,
  [Category.StructuredData]: STRUCTURED_DATA_AUDITS,
  [Category.AnswerReadiness]: ANSWER_READINESS_AUDITS,
  [Category.AgentInterfaces]: AGENT_INTERFACES_AUDITS,
  [Category.AgenticCommerce]: AGENTIC_COMMERCE_AUDITS,
  [Category.OperabilitySafety]: OPERABILITY_SAFETY_AUDITS,
};

const CATEGORY_AUDITS: ReadonlyArray<
  readonly [id: Category, audits: readonly AuditClass[]]
> = Object.values(Category).map((id) => [id, AUDITS_BY_CATEGORY[id]]);

/**
 * Evidence mass per category: Σ of the member audits' weights (spec §4).
 *
 * This replaces the old hand-tuned `CATEGORY_WEIGHTS` map. A category earns
 * influence over the overall score by carrying proven audits, so moving an
 * audit between categories moves its mass with it and nothing else changes.
 * Categories made entirely of informative/experimental audits have mass 0 and
 * cannot move the overall score.
 *
 * Not part of the `contracts` entry: it describes the installed registry, and
 * a saved report carries the mass it was scored with.
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
    CATEGORY_AUDITS.map(([id, audits]) => [
      id,
      audits.map((AuditClass) => reg(AuditClass)),
    ]),
  ),
};

/**
 * Narrow a scan to a subset of the registry.
 *
 * Two independent filters: `categories` restricts which categories run at all,
 * and `includeExperimental` decides whether experimental-tier audits are part
 * of the run. Experimental audits are excluded unless asked for — they carry
 * weight 0 either way, but running an unvalidated check on every scan is a
 * decision the operator makes, not a default.
 *
 * Returns the same object when there is nothing to filter, so the common path
 * allocates nothing.
 */
export function filterConfig(
  config: ScanConfig,
  opts: { categories?: string[]; includeExperimental?: boolean },
): ScanConfig {
  const wanted =
    opts.categories && opts.categories.length > 0
      ? new Set(opts.categories)
      : undefined;
  const dropExperimental =
    opts.includeExperimental !== true &&
    Object.values(config.audits).some((list) =>
      list.some((r) => r.meta.tier === AuditTier.Experimental),
    );
  if (!wanted && !dropExperimental) return config;

  const categories = config.categories.filter(
    (cat) => !wanted || wanted.has(cat.id),
  );
  const audits = Object.fromEntries(
    categories.map((cat) => [
      cat.id,
      (config.audits[cat.id] ?? []).filter(
        (registration) =>
          !dropExperimental ||
          registration.meta.tier !== AuditTier.Experimental,
      ),
    ]),
  );
  return { categories, audits };
}
