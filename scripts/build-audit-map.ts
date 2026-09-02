#!/usr/bin/env node
/**
 * build-audit-map — Generator and validator for canonical docs/evidence/audit-map.json.
 *
 * Inspects:
 *   1. packages/core/src/audit-config.ts (defaultConfig.audits — all 215 active audits)
 *   2. docs/evidence/audits/ (active dossiers)
 *   3. docs/evidence/sunset/ (sunset dossiers)
 *   4. docs/evidence/merged/ (merged dossiers)
 *   5. packages/core/migration-map.json & docs/evidence/v2-audit-map.md (legacy v1 mappings)
 *
 * Modes:
 *   pnpm build:audit-map       Regenerates docs/evidence/audit-map.json and docs/evidence/audit-map.md
 *   pnpm check:audit-map       Validates that docs/evidence/audit-map.json is up-to-date with 0 drift
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { defaultConfig } from "../packages/core/src/audit-config";

const REPO_ROOT = path.resolve(__dirname, "..");
const AUDIT_MAP_JSON_PATH = path.resolve(
  REPO_ROOT,
  "docs/evidence/audit-map.json",
);
const AUDIT_MAP_MD_PATH = path.resolve(REPO_ROOT, "docs/evidence/audit-map.md");
const LEGACY_MIGRATION_MAP_PATH = path.resolve(
  REPO_ROOT,
  "packages/core/migration-map.json",
);

interface LegacyEntry {
  slug: string;
  status: "removed" | "renamed" | "merging";
  action?: string;
  reason?: string;
  to?: string;
  link: string;
  notes?: string;
}

interface ActiveAuditEntry {
  id: string;
  category: string;
  slug: string;
  title: string;
  tier: string;
  evidenceGrade: string;
  weight: number;
  scoreDisplayMode: string;
  dossier: string;
  requires: string[];
  legacyIds: string[];
}

interface DossierRecord {
  category: string;
  slug: string;
  path: string;
  targetId?: string;
  v1Id?: string;
}

interface AuditMapDataset {
  $schema?: string;
  version: number;
  summary: {
    totalActiveAudits: number;
    categories: Record<string, number>;
    totalSunsetDossiers: number;
    totalMergedDossiers: number;
    totalLegacyAudits: number;
  };
  categories: string[];
  audits: ActiveAuditEntry[];
  legacy: Record<string, LegacyEntry>;
  sunsetDossiers: DossierRecord[];
  mergedDossiers: DossierRecord[];
}

function walkMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  let results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkMarkdownFiles(full));
    } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
      results.push(
        path.relative(path.resolve(REPO_ROOT, "docs/evidence"), full),
      );
    }
  }
  return results.sort();
}

function generateAuditMap(): AuditMapDataset {
  const registeredAudits = Object.values(defaultConfig.audits).flat();

  // Prefer existing audit-map.json as source of truth for legacy mappings, falling back to packages/core/migration-map.json
  let rawLegacy: Record<string, LegacyEntry> = {};
  if (fs.existsSync(AUDIT_MAP_JSON_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(AUDIT_MAP_JSON_PATH, "utf8"));
      if (existing.legacy && Object.keys(existing.legacy).length > 0) {
        rawLegacy = existing.legacy;
      }
    } catch {
      // fallback to migration-map.json
    }
  }

  if (
    Object.keys(rawLegacy).length === 0 &&
    fs.existsSync(LEGACY_MIGRATION_MAP_PATH)
  ) {
    rawLegacy = JSON.parse(fs.readFileSync(LEGACY_MIGRATION_MAP_PATH, "utf8"));
  }

  const legacyMap: Record<string, LegacyEntry> = {};
  const legacyByTarget = new Map<string, string[]>();

  for (const [id, entry] of Object.entries(rawLegacy)) {
    const enriched: LegacyEntry = {
      slug: entry.slug,
      status: entry.status,
      action: entry.action || (entry.status === "removed" ? "sunset" : "move"),
      link: entry.link,
    };
    if (entry.to) enriched.to = entry.to;
    if (entry.reason) enriched.reason = entry.reason;
    if (entry.notes) {
      enriched.notes = entry.notes;
    }

    legacyMap[id] = enriched;

    if (enriched.to) {
      const list = legacyByTarget.get(enriched.to) ?? [];
      list.push(id);
      legacyByTarget.set(enriched.to, list);
    }
  }

  const categoryCounts: Record<string, number> = {};
  const activeAudits: ActiveAuditEntry[] = [];

  for (const reg of registeredAudits) {
    const m = reg.meta;
    categoryCounts[m.category] = (categoryCounts[m.category] ?? 0) + 1;
    activeAudits.push({
      id: m.id,
      category: m.category,
      slug: m.id.split("/")[1]!,
      title: m.title,
      tier: m.tier ?? "scored",
      evidenceGrade: m.evidenceGrade ?? "A",
      weight: m.weight,
      scoreDisplayMode: m.scoreDisplayMode,
      dossier: m.dossier ?? `docs/evidence/audits/${m.id}.md`,
      requires: m.requires ? [...m.requires] : [],
      legacyIds: legacyByTarget.get(m.id) ?? [],
    });
  }

  // Sort audits deterministically by id
  activeAudits.sort((a, b) => a.id.localeCompare(b.id));

  // Walk sunset and merged dossiers
  const sunsetPaths = walkMarkdownFiles(
    path.resolve(REPO_ROOT, "docs/evidence/sunset"),
  );
  const mergedPaths = walkMarkdownFiles(
    path.resolve(REPO_ROOT, "docs/evidence/merged"),
  );

  const sunsetDossiers: DossierRecord[] = sunsetPaths.map((p) => {
    const parts = p
      .replace(/^sunset\//, "")
      .replace(/\.md$/, "")
      .split("/");
    const category = parts.length > 1 ? parts[0]! : "general";
    const slug = parts[parts.length - 1]!;
    return { category, slug, path: `docs/evidence/${p}` };
  });

  const mergedDossiers: DossierRecord[] = mergedPaths.map((p) => {
    const parts = p
      .replace(/^merged\//, "")
      .replace(/\.md$/, "")
      .split("/");
    const category = parts.length > 1 ? parts[0]! : "general";
    const slug = parts[parts.length - 1]!;
    return { category, slug, path: `docs/evidence/${p}` };
  });

  const categories = Object.keys(defaultConfig.audits).sort();

  return {
    version: 4,
    summary: {
      totalActiveAudits: activeAudits.length,
      categories: categoryCounts,
      totalSunsetDossiers: sunsetDossiers.length,
      totalMergedDossiers: mergedDossiers.length,
      totalLegacyAudits: Object.keys(legacyMap).length,
    },
    categories,
    audits: activeAudits,
    legacy: legacyMap,
    sunsetDossiers,
    mergedDossiers,
  };
}

function generateMarkdownDocumentation(map: AuditMapDataset): string {
  const categoryRows = Object.entries(map.summary.categories)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, count]) => `| \`${cat}\` | ${count} |`)
    .join("\n");

  return `# Agent Lighthouse Audit Map

Canonical inventory and lifecycle map of all Agent Lighthouse audits.

This document serves as the human-readable index for [\`docs/evidence/audit-map.json\`](./audit-map.json),
which is the machine-readable single source of truth for all active, merged, and sunset audits.

## Summary

- **Total Active Shipping Audits:** ${map.summary.totalActiveAudits} across 8 categories
- **Historical v1 Legacy Audits:** ${map.summary.totalLegacyAudits} (181 carried forward, 26 sunset)
- **Sunset Dossiers Preserved:** ${map.summary.totalSunsetDossiers} under \`docs/evidence/sunset/\`
- **Merged Dossiers Preserved:** ${map.summary.totalMergedDossiers} under \`docs/evidence/merged/\`

## Active Audits by Category

| Category | Active Audits |
| :--- | :--- |
${categoryRows}

## Audit Lifecycle & Taxonomy

Agent Lighthouse audits follow strict evidence governance (defined in [\`docs/evidence/policy.md\`](./policy.md)):

1. **Active (\`audits/\`)**: Currently registered and evaluated audits under \`packages/core/src/audits/\`. Every active audit possesses an evidence dossier in \`docs/evidence/audits/<category>/<slug>.md\`.
2. **Sunset (\`sunset/\`)**: Audits permanently retired because vendor evidence demonstrated no consumer impact (Grade D/unproven). Their evidence and removal rationale are permanently preserved under \`docs/evidence/sunset/\` and \`docs/evidence/sunset/not-a-factor.md\`.
3. **Merged (\`merged/\`)**: Audits whose signals were consolidated into another audit. The source dossier is retained under \`docs/evidence/merged/\`.

## Machine-Readable Dataset

The full structured dataset with per-audit metadata, evidence grades, scoring tiers, weights, required evidence keys, and legacy v1 mappings is maintained in [\`audit-map.json\`](./audit-map.json).

To rebuild or validate the map:
\`\`\`bash
pnpm build:audit-map    # Rebuilds audit-map.json from codebase state
pnpm check:audit-map    # Validates audit-map.json against code and disk
\`\`\`
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isCheckMode = args.includes("--check");

  const dataset = generateAuditMap();
  const formattedJson = JSON.stringify(dataset, null, 2) + "\n";
  const formattedMd = generateMarkdownDocumentation(dataset);

  if (isCheckMode) {
    let hasError = false;

    if (!fs.existsSync(AUDIT_MAP_JSON_PATH)) {
      console.error(
        `❌ check:audit-map: ${AUDIT_MAP_JSON_PATH} does not exist.`,
      );
      hasError = true;
    } else {
      const existingJson = fs.readFileSync(AUDIT_MAP_JSON_PATH, "utf8");
      if (existingJson !== formattedJson) {
        console.error(
          `❌ check:audit-map: ${AUDIT_MAP_JSON_PATH} is out of date.\n` +
            'Run "pnpm build:audit-map" to synchronize.',
        );
        hasError = true;
      }
    }

    if (!fs.existsSync(AUDIT_MAP_MD_PATH)) {
      console.error(`❌ check:audit-map: ${AUDIT_MAP_MD_PATH} does not exist.`);
      hasError = true;
    } else {
      const existingMd = fs.readFileSync(AUDIT_MAP_MD_PATH, "utf8");
      if (existingMd !== formattedMd) {
        console.error(
          `❌ check:audit-map: ${AUDIT_MAP_MD_PATH} is out of date.\n` +
            'Run "pnpm build:audit-map" to synchronize.',
        );
        hasError = true;
      }
    }

    // Verify all active dossiers exist on disk
    for (const audit of dataset.audits) {
      const fullDossierPath = path.resolve(REPO_ROOT, audit.dossier);
      if (!fs.existsSync(fullDossierPath)) {
        console.error(
          `❌ check:audit-map: Dossier missing for ${audit.id} at ${audit.dossier}`,
        );
        hasError = true;
      }
    }

    if (hasError) {
      process.exit(1);
    } else {
      console.log(
        `check:audit-map: OK — ${dataset.summary.totalActiveAudits} active audits, ${dataset.summary.totalLegacyAudits} legacy mappings in agreement.`,
      );
      process.exit(0);
    }
  } else {
    fs.writeFileSync(AUDIT_MAP_JSON_PATH, formattedJson, "utf8");
    fs.writeFileSync(AUDIT_MAP_MD_PATH, formattedMd, "utf8");

    // Also update packages/core/migration-map.json with the enriched legacy mappings
    const cleanLegacy: Record<
      string,
      {
        slug: string;
        status: string;
        to?: string;
        link: string;
        reason?: string;
        note?: string;
      }
    > = {};
    for (const [id, entry] of Object.entries(dataset.legacy)) {
      cleanLegacy[id] = {
        slug: entry.slug,
        status: entry.status,
        ...(entry.to ? { to: entry.to } : {}),
        ...(entry.reason ? { reason: entry.reason } : {}),
        link: entry.link,
        ...(entry.notes ? { note: entry.notes } : {}),
      };
    }
    fs.writeFileSync(
      LEGACY_MIGRATION_MAP_PATH,
      JSON.stringify(cleanLegacy, null, 2) + "\n",
      "utf8",
    );

    console.log(`✅ Successfully generated ${AUDIT_MAP_JSON_PATH}`);
    console.log(`✅ Successfully generated ${AUDIT_MAP_MD_PATH}`);
    console.log(`✅ Synchronized ${LEGACY_MIGRATION_MAP_PATH}`);
    console.log(
      `   ${dataset.summary.totalActiveAudits} active audits, ${dataset.summary.totalSunsetDossiers} sunset dossiers, ${dataset.summary.totalMergedDossiers} merged dossiers, ${dataset.summary.totalLegacyAudits} legacy mappings.`,
    );
  }
}

main().catch((err) => {
  console.error("build-audit-map failed:", err);
  process.exit(1);
});
