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

/** The route template for a dossier, read as source (see the test that uses it). */
const DOSSIER_TEMPLATE = resolve(__dirname, 'pages/audits/[category]/[slug].astro');

/** A dossier's markdown body — everything after the closing frontmatter fence. */
function dossierBody(id: string): string {
  const raw = readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8');
  return raw.replace(/^---\n[\s\S]*?\n---\n/, '');
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

  it('opens every dossier body with a human title, never the audit id', () => {
    for (const id of dossierIds()) {
      const raw = readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8');
      const audit = /^audit:\s*(\S+)/m.exec(raw)![1]!;
      const heading = /^#\s+(.+)$/m.exec(dossierBody(id));
      expect(heading, `${id} has no top-level heading`).not.toBeNull();
      expect(heading![1]!.trim(), `${id} titles itself with its own id`).not.toBe(audit);
    }
  });

  // Read as source rather than rendered: proving this needs a full Astro build, and the
  // test suite must stay build-free. The two facts below are what the route depends on.
  it('leaves the dossier heading to the markdown, not the route template', () => {
    const template = readFileSync(DOSSIER_TEMPLATE, 'utf8');
    expect(template, 'the markdown body already supplies the <h1>').not.toMatch(/<h1[\s>]/);
    expect(template, 'the <title> comes from the body heading').toMatch(/headings/);
  });

  it('keeps every tier it does declare inside the schema enum', () => {
    for (const id of dossierIds()) {
      const tier = /^tier:\s*(\S+)/m.exec(readFileSync(resolve(DOSSIERS, `${id}.md`), 'utf8'));
      if (!tier) continue;
      expect(['scored', 'informative', 'experimental'], id).toContain(tier[1]);
    }
  });
});
