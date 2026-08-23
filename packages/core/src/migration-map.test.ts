import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfig } from './audit-config';
import { NEW_IN_V2, MIGRATED_COUNT } from './tests/new-in-v2';

interface Entry {
  slug: string;
  /**
   * `merging` is extinct in the data as of Plan 4 Task 8 — every fold has
   * landed, so every surviving row is a plain `renamed`. The union (and
   * `interim`) still admit it so the vocabulary is available if a later wave
   * needs the same transitional state; the extinction test below is what keeps
   * it from reappearing unnoticed.
   */
  status: 'removed' | 'renamed' | 'merging';
  reason?: string;
  to?: string;
  /** Only ever set on a `merging` row: where the signal lived until its fold landed. */
  interim?: string;
  link: string;
  /** Historical record on a row whose route to its target is not obvious from `slug`/`to`. */
  note?: string;
}

const map = JSON.parse(
  readFileSync(join(__dirname, '..', 'migration-map.json'), 'utf8'),
) as Record<string, Entry>;

// The 26 v1 audits removed in this major release (18 in the v1.0.0 sunset
// wave, 8 added by the 2026-08-21 grading pass).
const REMOVED_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
  '1.18', '1.23', '7.22', '8.14', '8.15', '8.16', '8.19', '8.20',
];

// The 181 v1 audits that survive into v2 — every non-sunset row of
// docs/evidence/v2-audit-map.md, one entry each.
const SURVIVING_COUNT = 181;

// Pinned end state of the v2 migration wave. 26 + 181 = 207, the full v1 audit
// set; the map is closed, so any later change to any of the three has to be a
// deliberate edit here rather than silent drift.
const TOTAL_COUNT = 207;

// The audits reachable from the migration map: the 148 Plan 4 closed on. Every
// surviving entry's `to` must be one of them, and every one of them must be
// some entry's `to`. Plan 5 grows the registry past this number with audits
// that have no v1 predecessor; those are named in NEW_IN_V2 and excluded from
// the reachability assertions below, because there is no v1 id that could
// point at them.
const REGISTRY_COUNT = MIGRATED_COUNT;

// `to` targets that are deliberately allowed not to be registered, each with a
// written rationale. Empty by design: every one of the 181 surviving entries
// points at a landed, registered v2 audit. The one deferral Plan 4 carries —
// 5.23's runtime half, reading a live MCP `tools/list` response — is a deferred
// *part of a signal*, not a deferred target: 5.23 still resolves to the
// registered agent-interfaces/openapi-operation-ids, whose dossier records what
// was left out. If a later wave ever ships an entry whose `to` has no audit
// behind it, it gets named here with its reason rather than weakening the
// registration assertion below.
const DOCUMENTED_DEFERRALS: string[] = [];

// v2 audits that deliberately absorb more than one v1 row: a consolidation
// points several `renamed` entries at a single merged audit. Every other
// landed id stays 1:1, so this table is the allow-list for shared targets and
// grows one line per fold as Plan 4 lands them.
//
// The value is the fold size — how many v1 rows land on that audit. Comparing
// only the set of shared ids let a sixth accidental row point at an existing
// target and still pass; the count is what actually pins the fold.
const CONSOLIDATION_TARGETS: Record<string, number> = {
  'access-crawl-control/ai-bot-directives': 5,
  'access-crawl-control/canonical': 2,
  'access-crawl-control/robots-directives': 3,
  'agent-interfaces/ai-catalog-exists': 2,
  'agent-interfaces/mcp-endpoint': 3,
  'agent-interfaces/openapi-exists': 2,
  // 5.3 (its own row) plus 5.23, whose naming rule folded in here on 2026-08-22.
  'agent-interfaces/openapi-operation-ids': 2,
  'agent-interfaces/search-endpoint': 2,
  'answer-readiness/core-open-graph': 3,
  'answer-readiness/dates-on-content': 2,
  'answer-readiness/meta-description': 2,
  'answer-readiness/review-signals': 2,
  'content-extraction/semantic-lists': 3,
  'content-extraction/server-responsiveness': 2,
  'machine-discovery/ai-file-delivery': 2,
  'machine-discovery/discovery-index-coverage': 2,
  'machine-discovery/in-content-links': 2,
  'machine-discovery/llms-txt-exists': 2,
  'machine-discovery/llms-txt-structure': 2,
  'machine-discovery/rss-feed': 2,
  'operability-safety/form-actionability': 2,
  'operability-safety/landmark-unique': 2,
  'operability-safety/security-header-hygiene': 4,
  'structured-data/review-schema': 2,
};

// v2 identity: `category/slug`. Slugs carry digits and dots (json-ld-1-1,
// llms-full-txt, ai-plugin.json-style names), so the pattern is deliberately
// wider than the v1 `[a-z-]+` shape.
const ID_RE = /^[a-z0-9_-]+\/[a-z0-9._-]+$/;

const entries = Object.entries(map);
const surviving = entries.filter(([, e]) => e.status !== 'removed');
const registeredIds = Object.values(defaultConfig.audits)
  .flat()
  .map((r) => r.meta.id);

describe('migration-map.json', () => {
  it('covers every v1 audit id — 26 removed plus 181 carried into v2', () => {
    expect(REMOVED_IDS).toHaveLength(26);
    expect(REMOVED_IDS.length + SURVIVING_COUNT).toBe(TOTAL_COUNT);
    expect(entries).toHaveLength(TOTAL_COUNT);
    expect(surviving).toHaveLength(SURVIVING_COUNT);
  });

  // Exact per-status census, not just a total: a row flipped from `renamed` to
  // `removed` (or back) keeps the total at 207 and would otherwise slip through.
  it('splits the 207 entries exactly 26 removed / 181 renamed', () => {
    const census = new Map<string, number>();
    for (const [, entry] of entries) census.set(entry.status, (census.get(entry.status) ?? 0) + 1);
    expect(Object.fromEntries(census)).toEqual({ removed: 26, renamed: 181 });
  });

  it('has exactly the known removed ids under status "removed"', () => {
    const removed = entries.filter(([, e]) => e.status === 'removed').map(([id]) => id);
    expect(removed.sort()).toEqual([...REMOVED_IDS].sort());
  });

  it.each(REMOVED_IDS)('entry %s is removed with a sunset rationale link', (id) => {
    const entry = map[id]!;
    expect(entry.status).toBe('removed');
    expect(entry.reason).toBe('not-a-factor');
    expect(entry.slug).toMatch(ID_RE);
    expect(entry.link).toContain('docs/evidence/sunset/NOT-A-FACTOR.md#');
  });

  // The anchor is what a consumer follows to read why their check disappeared;
  // a slug/anchor mismatch would land them on the wrong section.
  it.each(REMOVED_IDS)('entry %s anchors at its own slug', (id) => {
    const entry = map[id]!;
    expect(entry.link.split('#')[1]).toBe(entry.slug.replace('/', ''));
  });

  it('gives every surviving entry a v1 slug, a v2 target and a dossier link', () => {
    for (const [id, entry] of surviving) {
      expect(entry.status, `entry ${id} status`).toBe('renamed');
      expect(entry.slug, `entry ${id} slug`).toMatch(ID_RE);
      expect(entry.to, `entry ${id} to`).toMatch(ID_RE);
      expect(entry.link, `entry ${id} link`).toMatch(/^docs\/evidence\/audits\/.+\.md$/);
    }
  });

  // "merging" was the transitional status for an audit whose signal still lived
  // under its own id because its fold target had not landed yet, with `interim`
  // naming that temporary home. Plan 4 Task 8 landed the last fold, so the
  // status is extinct and `interim ?? to` collapses to `to` for every consumer.
  // This inverts the old "every merging entry has a registered interim" check:
  // there is nothing left to be transitional.
  it('has no "merging" entries left — every fold has landed', () => {
    // Scanned across every entry, not just the surviving ones, so the status
    // cannot reappear anywhere in the file.
    const merging = entries.filter(([, e]) => e.status === 'merging').map(([id]) => id);
    expect(merging).toEqual([]);
    const withInterim = entries.filter(([, e]) => e.interim !== undefined).map(([id]) => id);
    expect(withInterim).toEqual([]);
  });

  it('points every "renamed" entry at a registered v2 audit', () => {
    const label = ([id, e]: (typeof surviving)[number]) => `${id} -> ${e.to}`;
    const unregistered = surviving.filter(([, e]) => !registeredIds.includes(e.to!)).map(label);
    // Anything unregistered has to be a named, documented deferral. That list
    // is empty, so this reads as: all 181 targets have landed in the registry.
    const allowed = surviving.filter(([, e]) => DOCUMENTED_DEFERRALS.includes(e.to!)).map(label);
    expect(unregistered).toEqual(allowed);
  });

  // The registry is pinned here too, so a migration-map entry and an audit
  // registration can never drift apart without one of the two tests failing.
  it('registers the 148 migrated audits plus the new-in-v2 additions', () => {
    expect(registeredIds).toHaveLength(REGISTRY_COUNT + NEW_IN_V2.length);
    expect(new Set(surviving.map(([, e]) => e.to!)).size).toBe(REGISTRY_COUNT);
  });

  // Plan-3 deferral: a link is only a migration path if the file is really
  // there. Paths are repo-relative, so they resolve from the repo root — two
  // levels above packages/core/src.
  it('has the dossier of every surviving entry on disk', () => {
    const repoRoot = join(__dirname, '..', '..', '..');
    const missing = surviving
      .map(([id, e]) => [id, e.link] as const)
      .filter(([, link]) => !existsSync(join(repoRoot, link)))
      .map(([id, link]) => `${id}: ${link}`);
    expect(missing).toEqual([]);
  });

  it('reaches every migrated v2 audit from some entry', () => {
    // With the folds landed, every migrated audit is the `to` of at least one
    // v1 id — a 1:1 rename, or one of a consolidation's several sources. Audits
    // introduced in v2 have no such id and are excluded by name.
    const reachable = new Set(surviving.map(([, e]) => e.to!));
    const unreachable = registeredIds
      .filter((id) => !reachable.has(id))
      .filter((id) => !NEW_IN_V2.includes(id));
    expect(unreachable).toEqual([]);
  });

  it('keys the map by v1 numeric id and only shares a landed audit across a known consolidation', () => {
    for (const [id] of entries) expect(id).toMatch(/^\d+\.\d+$/);
    const landed = surviving.map(([, e]) => e.to!);
    const counts = new Map<string, number>();
    for (const id of landed) counts.set(id, (counts.get(id) ?? 0) + 1);
    const shared = Object.fromEntries([...counts].filter(([, n]) => n > 1));
    expect(shared).toEqual(CONSOLIDATION_TARGETS);
  });

  it('links every surviving entry to the dossier of the audit it resolves to', () => {
    for (const [id, entry] of surviving) {
      expect(entry.link, `entry ${id} link`).toBe(`docs/evidence/audits/${entry.to}.md`);
    }
  });
});
