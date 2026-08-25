import { describe, it, expect } from 'vitest';
import { DOC_SECTIONS } from './markdown-slice';
import { documentationNav } from './doc-nav';

/**
 * The documentation sidebar.
 *
 * Both the docs route and the policy route render it, so an entry lost here
 * silently strands a published page with no link pointing at it.
 */

describe('documentationNav', () => {
  it('lists every docs section, in order', () => {
    const nav = documentationNav();
    expect(nav.slice(0, DOC_SECTIONS.length).map((e) => e.label)).toEqual(
      DOC_SECTIONS.map((s) => s.title),
    );
  });

  // The evidence pair is a destination, not the next step of the quickstart path.
  it('appends the two evidence pages after the docs sections', () => {
    const nav = documentationNav();
    expect(nav.slice(DOC_SECTIONS.length)).toEqual([
      { label: 'Evidence policy', href: '/agent-lighthouse/policy/' },
      { label: 'Source registry', href: '/agent-lighthouse/sources/' },
    ]);
  });

  it('prefixes every href with the site base path exactly once', () => {
    for (const entry of documentationNav()) {
      expect(entry.href, entry.label).toMatch(/^\/agent-lighthouse\/[^/].*\/$/);
      expect(entry.href.startsWith('/agent-lighthouse/agent-lighthouse/'), entry.label).toBe(false);
    }
  });

  it('labels every entry', () => {
    for (const entry of documentationNav()) {
      expect(entry.label).toBeTruthy();
    }
  });

  it('produces no duplicate destinations', () => {
    const hrefs = documentationNav().map((e) => e.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
