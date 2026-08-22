import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfig } from './audit-config';

interface Entry {
  slug: string;
  status: 'removed' | 'renamed' | 'merging';
  reason?: string;
  to?: string;
  /** Where the signal lives *today*; `to` may already be registered (survivor row) or land in Plan 4. */
  interim?: string;
  link: string;
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

// v2 audits that deliberately absorb more than one v1 row: a consolidation
// points several `renamed` entries at a single merged audit. Every other
// landed id stays 1:1, so this list is the allow-list for shared targets and
// grows one line per fold as Plan 4 lands them.
const CONSOLIDATION_TARGETS = [
  'access-crawl-control/ai-bot-directives',
  'operability-safety/security-header-hygiene',
  'machine-discovery/llms-txt-structure',
  'machine-discovery/discovery-index-coverage',
  'machine-discovery/llms-txt-exists',
  'machine-discovery/rss-feed',
  'machine-discovery/ai-file-delivery',
  'machine-discovery/in-content-links',
  'access-crawl-control/robots-directives',
  'access-crawl-control/canonical',
];

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
    expect(entries).toHaveLength(REMOVED_IDS.length + SURVIVING_COUNT);
    expect(surviving).toHaveLength(SURVIVING_COUNT);
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
      expect(['renamed', 'merging'], `entry ${id} status`).toContain(entry.status);
      expect(entry.slug, `entry ${id} slug`).toMatch(ID_RE);
      expect(entry.to, `entry ${id} to`).toMatch(ID_RE);
      expect(entry.link, `entry ${id} link`).toMatch(/^docs\/evidence\/audits\/.+\.md$/);
    }
  });

  // A "merging" entry's `to` is where the signal ends up: usually an already
  // registered survivor audit, sometimes a Plan-4 target that only lands later.
  // Either way the entry must say where this audit's own check is readable
  // today, so consumers can resolve `interim ?? to` to something live.
  it('gives every merging entry an interim id that is registered today', () => {
    const merging = surviving.filter(([, e]) => e.status === 'merging');
    expect(merging.length).toBeGreaterThan(0);
    for (const [id, entry] of merging) {
      expect(entry.interim, `entry ${id} interim`).toMatch(ID_RE);
      expect(registeredIds, `entry ${id} interim is registered`).toContain(entry.interim);
      expect(entry.to, `entry ${id} merges into a different id`).not.toBe(entry.interim);
    }
  });

  it('points every "renamed" entry at a registered v2 audit', () => {
    for (const [id, entry] of surviving.filter(([, e]) => e.status === 'renamed')) {
      expect(registeredIds, `entry ${id} target is registered`).toContain(entry.to);
      expect(entry.interim, `entry ${id} needs no interim`).toBeUndefined();
    }
  });

  it('reaches every registered v2 audit from some entry', () => {
    // Each landed audit is either the direct rename target of a v1 id, or the
    // interim home of one or more ids that fold into another audit in Plan 4.
    const reachable = new Set(
      surviving.flatMap(([, e]) => [e.status === 'merging' ? e.interim! : e.to!]),
    );
    const unreachable = registeredIds.filter((id) => !reachable.has(id));
    expect(unreachable).toEqual([]);
  });

  it('keys the map by v1 numeric id and only shares a landed audit across a known consolidation', () => {
    for (const [id] of entries) expect(id).toMatch(/^\d+\.\d+$/);
    const landed = surviving.map(([, e]) => (e.status === 'merging' ? e.interim! : e.to!));
    const counts = new Map<string, number>();
    for (const id of landed) counts.set(id, (counts.get(id) ?? 0) + 1);
    const shared = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
    expect(shared.sort()).toEqual([...CONSOLIDATION_TARGETS].sort());
  });

  it('links every surviving entry to the dossier of the audit it resolves to', () => {
    for (const [id, entry] of surviving) {
      const landed = entry.status === 'merging' ? entry.interim! : entry.to!;
      expect(entry.link, `entry ${id} link`).toBe(`docs/evidence/audits/${landed}.md`);
    }
  });
});
