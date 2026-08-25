import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EVIDENCE_DIR,
  POLICY_FILE,
  SOURCES_FILE,
  readPolicySource,
  readSourceRegistry,
  readSourceRegistryRaw,
  sourceTypeCounts,
} from './evidence';
import { resolveDocLink } from './doc-markdown';

const onDisk = (file: string) => readFileSync(resolve(__dirname, '../../../..', file), 'utf8');

describe('the registry reader', () => {
  it('names the file it reads, relative to the repository root', () => {
    expect(SOURCES_FILE).toBe('docs/evidence/sources.json');
  });

  it('serves the file byte for byte, so the site and the repository agree', () => {
    expect(readSourceRegistryRaw()).toBe(onDisk(SOURCES_FILE));
  });

  it('parses it into the dated document the page renders', () => {
    const registry = readSourceRegistry();

    expect(registry.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(registry.sources.length).toBeGreaterThan(500);
    expect(registry.sources[0]!.id.length).toBeGreaterThan(0);
  });
});

describe('sourceTypeCounts', () => {
  it('counts every type present and nothing else', () => {
    const registry = readSourceRegistry();
    const counts = sourceTypeCounts(registry.sources);

    expect(counts.length).toBeGreaterThan(1);
    expect(counts.reduce((total, entry) => total + entry.count, 0)).toBe(registry.sources.length);
    for (const entry of counts) expect(entry.count, entry.type).toBeGreaterThan(0);
    // Sorted, so the pills come out in a stable order build after build.
    expect(counts.map((entry) => entry.type)).toEqual([...counts.map((entry) => entry.type)].sort());
  });
});

describe('the policy source', () => {
  it('is read from the repository, not copied into this package', () => {
    expect(POLICY_FILE).toBe('docs/evidence/policy.md');
    expect(readPolicySource()).toBe(onDisk(POLICY_FILE));
  });

  // The reason this page cannot go through the dossier pipeline: that plugin
  // keys on an `audit:` field, and this file has no frontmatter at all.
  it('carries no frontmatter for a link plugin to key on', () => {
    expect(readPolicySource().startsWith('---')).toBe(false);
  });

  /**
   * The sweep: every relative link in the policy resolves to somewhere real.
   * `resolveDocLink` returns a site route or a GitHub URL for anything it
   * understands and the href untouched for anything it does not, so a link it
   * hands back unchanged is one that would ship as a 404.
   */
  it('leaves no relative link unresolved', () => {
    const hrefs = [...readPolicySource().matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]!);
    expect(hrefs.length, 'the policy has no links to check').toBeGreaterThan(0);

    for (const href of hrefs) {
      const resolved = resolveDocLink(href, EVIDENCE_DIR, new Set());
      expect(resolved, `${href} is still relative`).toMatch(/^(?:https?:|mailto:|#|\/)/);
    }
  });

  it('sends the registry the policy cites to the browsable sources page', () => {
    expect(resolveDocLink('./sources.json', EVIDENCE_DIR, new Set())).toBe('/agent-lighthouse/sources/');
  });
});
