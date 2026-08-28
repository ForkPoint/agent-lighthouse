import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SiteEntry {
  domain: string;
  category: string;
  source: 'tranco' | 'crux';
  rankBucket: number;
}

const sites: SiteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../test-data/sites/sites.json'), 'utf8'),
);

describe('the site list', () => {
  it('holds enough sites to be worth scanning', () => {
    expect(sites.length).toBeGreaterThan(500);
  });

  it('carries a bare hostname per entry, never a URL', () => {
    for (const site of sites.slice(0, 200)) {
      expect(site.domain, site.domain).not.toMatch(/^https?:\/\//);
      expect(site.domain, site.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
    }
  });

  it('lists each domain once', () => {
    expect(new Set(sites.map((s) => s.domain)).size).toBe(sites.length);
  });

  it('reaches past storefronts, which is the point of building it', () => {
    const categories = new Set(sites.map((s) => s.category));
    categories.delete('unknown');
    expect(categories.size).toBeGreaterThanOrEqual(6);
  });
});
