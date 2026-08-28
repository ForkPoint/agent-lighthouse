import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BUCKET_WIDTH,
  HOSTNAME,
  bucketOf,
  buildSiteList,
  normalize,
  type SiteEntry,
} from './site-list';

const sites: SiteEntry[] = JSON.parse(
  readFileSync(resolve(__dirname, '../../test-data/sites/sites.json'), 'utf8'),
);

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
    // in bucket 0 and turned `rankBucket < 5000` into "everything". This checks
    // the committed artefact only — the generator-level guard is in the
    // buildSiteList block, because a width change leaves this file's buckets
    // looking plausible until someone regenerates.
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
    expect(built.find((s) => s.domain === 'a.com')?.source).toBe('tranco');
  });

  it.each([10, 99, 100, 150, 1000])(
    'keeps the seed bucket clear of every ranked bucket at limit %i',
    (limit) => {
      // The invariant, not the arithmetic. `bucketOf(limit)` satisfied this at
      // multiples of the width and collided everywhere else: at limit 150 the
      // seed bucket was 100 and so was the worst ranked bucket, and at limit 10
      // a hand-seeded domain sat in bucket 0 beside rank #1.
      const ranked = Array.from({ length: limit }, (_, i) => `r${String(i).padStart(5, '0')}.com`);
      const built = buildSiteList([{ domains: ranked, source: 'tranco' }], categoryOf, limit);
      const seeded = built.filter((s) => s.source === 'seed');
      const worstRanked = Math.max(...built.filter((s) => s.source !== 'seed').map((s) => s.rankBucket));

      expect(seeded.length).toBeGreaterThan(0);
      for (const site of seeded) {
        expect(site.rankBucket, `limit ${limit}, ${site.domain}`).toBeGreaterThan(worstRanked);
      }
    },
  );

  it('spreads ranked entries across more than one bucket', () => {
    // The generator-level counterpart to the committed-file check above: this
    // is what goes red if BUCKET_WIDTH is widened back to the limit.
    const ranked = Array.from({ length: 250 }, (_, i) => `r${String(i).padStart(5, '0')}.com`);
    const built = buildSiteList([{ domains: ranked, source: 'tranco' }], new Map(), 250);
    const buckets = [...new Set(built.map((s) => s.rankBucket))].sort((a, b) => a - b);
    expect(buckets).toEqual([0, 100, 200]);
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

  // `normalize` answers '' for a seed entry that is not a bare hostname, and
  // the seed map is keyed by its output. Carried through, that entry became
  // `{ domain: '' }` in the committed list and `https:///robots.txt` in the
  // nightly. No entry in `categories.json` trips it today; the guard is what
  // keeps that true.
  it('drops a seed entry whose domain did not survive normalization', () => {
    const built = buildSiteList(
      [{ domains: ['a.com'], source: 'tranco' }],
      new Map([
        ['', 'retail'],
        ['seeded.com', 'retail'],
      ]),
      10,
    );
    expect(built.map((s) => s.domain)).toEqual(['a.com', 'seeded.com']);
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
