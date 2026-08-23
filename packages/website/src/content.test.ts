import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditPath } from './lib/routes';

const DOSSIERS = resolve(__dirname, '../../../docs/evidence/audits');

/** Every dossier file on disk, as `<category>/<slug>`. */
function dossierIds(): string[] {
  const out: string[] = [];
  for (const category of readdirSync(DOSSIERS, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    for (const file of readdirSync(resolve(DOSSIERS, category.name))) {
      if (file.endsWith('.md')) out.push(`${category.name}/${file.replace(/\.md$/, '')}`);
    }
  }
  return out.sort();
}

/**
 * The frontmatter keys `src/content.config.ts` marks required. `tier` is absent:
 * only the v2-native dossiers record one, so the schema keeps it optional and
 * the registry stays the authoritative source for an audit's tier.
 */
const REQUIRED_KEYS = [
  'audit:',
  'category:',
  'source_file:',
  'slug:',
  'evidence_grade:',
  'disposition:',
  'reviewed:',
];

describe('dossier content', () => {
  it('finds one dossier per audit directory entry', () => {
    expect(dossierIds().length).toBeGreaterThan(200);
  });

  it('gives every dossier a route derived from its id', () => {
    expect(auditPath('agentic-commerce/offer-truth-consistency')).toBe(
      '/agent-lighthouse/audits/agentic-commerce/offer-truth-consistency/',
    );
  });

  it('carries the frontmatter fields the collection schema requires', () => {
    for (const id of dossierIds()) {
      const raw = readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8');
      const front = /^---\n([\s\S]*?)\n---/.exec(raw);
      expect(front, id).not.toBeNull();
      const block = front![1]!;
      for (const key of REQUIRED_KEYS) {
        expect(block.includes(key), `${id} missing ${key}`).toBe(true);
      }
    }
  });

  it('keeps every tier it does declare inside the schema enum', () => {
    for (const id of dossierIds()) {
      const tier = /^tier:\s*(\S+)/m.exec(readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8'));
      if (!tier) continue;
      expect(['scored', 'informative', 'experimental'], id).toContain(tier[1]);
    }
  });
});
