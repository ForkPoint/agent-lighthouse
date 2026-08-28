import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUCKET_WIDTH,
  bucketOf,
  buildSiteList,
  normalize,
  type SiteEntry,
} from './site-list';

const sites: SiteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../test-data/sites/sites.json'), 'utf8'),
);

const HOSTNAME = /^[a-z0-9.-]+\.([a-z]{2,}|xn--[a-z0-9]+)$/;

describe('the site list', () => {
  it('holds enough sites to be worth scanning', () => {
    expect(sites.length).toBeGreaterThan(500);
  });

  it('carries a bare hostname per entry, never a URL', () => {
    // Every entry, not a leading slice: the first thousand are all Tranco,
    // which already ships bare hostnames, so a slice would never reach the
    // CrUX rows that arrive as `https://example.com` and need stripping.
    for (const site of sites) {
      expect(site.domain, site.domain).not.toMatch(/^https?:\/\//);
      expect(site.domain, site.domain).toMatch(HOSTNAME);
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

  it('draws on both ranked sources, not just the first one read', () => {
    const sources = new Set(sites.map((s) => s.source));
    expect(sources).toContain('tranco');
    expect(sources).toContain('crux');
  });

  it('never claims a ranked source for a domain that was only seeded', () => {
    // A seed carry-over stamped `tranco` would be scanned as a top-ranked site.
    const seeded = sites.filter((s) => s.source === 'seed');
    expect(seeded.length).toBeGreaterThan(0);
    for (const site of seeded) {
      expect(site.category, site.domain).not.toBe('unknown');
    }
  });

  it('spreads entries over rank buckets so a top slice selects a slice', () => {
    // The bucket once had width equal to the limit, which put all 1913 entries
    // in bucket 0 and turned `rankBucket < 5000` into "everything".
    const buckets = new Set(sites.map((s) => s.rankBucket));
    expect(buckets.size).toBeGreaterThan(1);
    const head = sites.filter((s) => s.rankBucket < BUCKET_WIDTH);
    expect(head.length).toBeGreaterThan(0);
    expect(head.length).toBeLessThan(sites.length);
  });

  it('ranks seed carry-overs below every domain that made the cut', () => {
    const ranked = sites.filter((s) => s.source !== 'seed');
    const worstRanked = Math.max(...ranked.map((s) => s.rankBucket));
    for (const site of sites.filter((s) => s.source === 'seed')) {
      expect(site.rankBucket, site.domain).toBeGreaterThan(worstRanked);
    }
  });

  it('is ordered by domain, so a regeneration diffs to real changes only', () => {
    const domains = sites.map((s) => s.domain);
    expect(domains).toEqual([...domains].sort((a, b) => a.localeCompare(b)));
  });
});

describe('normalize', () => {
  it('strips a scheme from a CrUX origin', () => {
    expect(normalize('https://playhop.com')).toBe('playhop.com');
    expect(normalize('http://example.com')).toBe('example.com');
  });

  it('strips a trailing path and a www prefix', () => {
    expect(normalize('https://www.bbc.co.uk/news')).toBe('bbc.co.uk');
    expect(normalize('www.example.com')).toBe('example.com');
  });

  it('lowercases a host', () => {
    expect(normalize('WWW.Example.COM')).toBe('example.com');
  });

  it('keeps punycode TLDs, which both sources carry', () => {
    expect(normalize('xn--80asehdb.xn--p1ai')).toBe('xn--80asehdb.xn--p1ai');
    expect(normalize('https://xn--12c1ezaww.com')).toBe('xn--12c1ezaww.com');
  });

  it("rejects the CrUX header row and anything else that is not a host", () => {
    expect(normalize('origin')).toBe('');
    expect(normalize('')).toBe('');
    expect(normalize('   ')).toBe('');
    expect(normalize('localhost')).toBe('');
  });
});

describe('bucketOf', () => {
  it('rounds a rank index down to the bucket width', () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(BUCKET_WIDTH - 1)).toBe(0);
    expect(bucketOf(BUCKET_WIDTH)).toBe(BUCKET_WIDTH);
    expect(bucketOf(999)).toBe(900);
  });
});

describe('buildSiteList', () => {
  const categoryOf = new Map([
    ['a.com', 'news'],
    ['offlist.com', 'forum'],
  ]);

  it('prefers the better-ranked source when a domain appears in both', () => {
    const built = buildSiteList(
      [
        { domains: ['a.com', 'b.com'], source: 'tranco' },
        { domains: ['b.com', 'c.com'], source: 'crux' },
      ],
      categoryOf,
      10,
    );
    expect(built.find((s) => s.domain === 'b.com')?.source).toBe('tranco');
    expect(built.find((s) => s.domain === 'c.com')?.source).toBe('crux');
  });

  it("marks a seed carry-over 'seed' and ranks it past the cut", () => {
    const built = buildSiteList([{ domains: ['a.com'], source: 'tranco' }], categoryOf, 10);
    const carried = built.find((s) => s.domain === 'offlist.com');
    expect(carried?.source).toBe('seed');
    expect(carried?.rankBucket).toBe(bucketOf(10));
    expect(built.find((s) => s.domain === 'a.com')?.source).toBe('tranco');
  });

  it('returns entries ordered by domain, whatever order the sources arrive in', () => {
    // The committed-file order test above cannot catch a change here until the
    // list is regenerated, so the generator's own ordering is pinned too.
    const built = buildSiteList(
      [
        { domains: ['zebra.com', 'apple.com'], source: 'tranco' },
        { domains: ['mango.com'], source: 'crux' },
      ],
      new Map(),
      10,
    );
    expect(built.map((s) => s.domain)).toEqual(['apple.com', 'mango.com', 'zebra.com']);
  });

  it('honours the limit', () => {
    const built = buildSiteList(
      [{ domains: ['a.com', 'b.com', 'c.com'], source: 'tranco' }],
      new Map(),
      2,
    );
    expect(built.map((s) => s.domain)).toEqual(['a.com', 'b.com']);
  });
});
