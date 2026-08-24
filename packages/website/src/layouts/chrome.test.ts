import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

/** Every .astro file under src, so a hardcoded path cannot hide in one. */
function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(full);
    return entry.name.endsWith('.astro') ? [full] : [];
  });
}

describe('chrome', () => {
  it('never hardcodes a site-absolute href', () => {
    for (const file of astroFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      const offenders = [...source.matchAll(/href="\/(?!agent-lighthouse)[a-z]/g)];
      expect(offenders.length, `${file} hardcodes a root-relative href`).toBe(0);
    }
  });

  it('gives the base layout a skip link and a theme colour', () => {
    const base = readFileSync(resolve(SRC, 'layouts/Base.astro'), 'utf8');
    expect(base).toContain('skip');
    expect(base).toContain('color-scheme');
  });
});
