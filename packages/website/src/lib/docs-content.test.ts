import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultConfig } from '@forkpoint/agent-lighthouse-core';

const REPO = resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(resolve(REPO, file), 'utf8');

describe('docs/SCORING.md', () => {
  it('states the weight law and every tier', () => {
    const scoring = read('docs/SCORING.md');
    expect(scoring).toContain('weightForGrade');
    // The two weights the law can produce (packages/core/src/scorer.ts).
    for (const weight of ['1.0', '0.6']) expect(scoring).toContain(weight);
    for (const tier of ['scored', 'informative', 'experimental']) expect(scoring).toContain(tier);
    for (const grade of ['A', 'B', 'C', 'D']) expect(scoring).toMatch(new RegExp(`\\b${grade}\\b`));
  });
});

describe('docs/CLI.md', () => {
  it('documents every flag the CLI accepts', () => {
    const cli = read('docs/CLI.md');
    // The entry point is main.ts, and it quotes flags with double quotes — the
    // pattern accepts either quote style so a restyle cannot silently empty it.
    const source = read('packages/cli/src/main.ts');
    const flags = [...source.matchAll(/["']--([a-z-]+)["']/g)].map((m) => `--${m[1]}`);
    expect(flags.length).toBeGreaterThan(0);
    for (const flag of new Set(flags)) expect(cli, `undocumented flag ${flag}`).toContain(flag);
  });
});

describe('docs/CONFIG.md', () => {
  it('names every category id', () => {
    const config = read('docs/CONFIG.md');
    for (const category of defaultConfig.categories) expect(config).toContain(category.id);
  });
});
