import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BADGE_BANDS,
  BADGE_LINK,
  DEFAULT_SCORE,
  DEFAULT_URL,
  badgeColor,
  badgeImageUrl,
  badgeMarkdown,
} from './badge-generator';

describe('badgeColor', () => {
  it('maps each score band to its colour', () => {
    expect(badgeColor(95)).toBe('22c55e');
    expect(badgeColor(90)).toBe('22c55e');
    expect(badgeColor(89)).toBe('4f46e5');
    expect(badgeColor(70)).toBe('4f46e5');
    expect(badgeColor(69)).toBe('f59e0b');
    expect(badgeColor(50)).toBe('f59e0b');
    expect(badgeColor(49)).toBe('ef4444');
    expect(badgeColor(0)).toBe('ef4444');
  });
});

describe('badgeMarkdown', () => {
  it('encodes the score and links the scanned site', () => {
    const md = badgeMarkdown(87, 'https://example.com');
    expect(md).toContain('Agent%20Lighthouse-87%2F100-4f46e5');
    expect(md).toContain('https://example.com');
  });
});

/**
 * `docs/BADGE.md` is the published contract, so it is read here rather than
 * transcribed: the bands the site renders and the snippet it generates are
 * compared against the file itself. If the doc changes, this fails, which is
 * the point — the site must not teach a badge the doc does not.
 */
const BADGE_DOC = readFileSync(resolve(__dirname, '../../../../docs/BADGE.md'), 'utf8');

describe('docs/BADGE.md', () => {
  it('is the source of the bands the site renders', () => {
    const rows = [...BADGE_DOC.matchAll(/^\|\s*(\d+)-(\d+)\s*\|\s*`([0-9a-f]{6})`\s*\|\s*([^|]+?)\s*\|$/gm)];

    expect(rows, 'the score table moved or changed shape').toHaveLength(BADGE_BANDS.length);
    expect(rows.map((row) => ({ min: Number(row[1]), max: Number(row[2]), color: row[3], meaning: row[4] }))).toEqual([
      ...BADGE_BANDS,
    ]);
  });

  it('publishes the exact snippet the generator produces', () => {
    const documented = /^\[!\[Agent Lighthouse\]\((\S+)\)\]\((\S+)\)$/m.exec(BADGE_DOC);
    expect(documented, 'the doc no longer shows a markdown badge').not.toBeNull();

    const [line, image, link] = documented!;
    // The doc's example is a score of 87, which is the generator's default.
    expect(image).toBe(badgeImageUrl(DEFAULT_SCORE));
    expect(link).toBe(BADGE_LINK);
    expect(badgeMarkdown(DEFAULT_SCORE, DEFAULT_URL).split('\n')[0]).toBe(line);
  });
});
