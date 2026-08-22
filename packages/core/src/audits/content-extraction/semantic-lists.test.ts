import { describe, it, expect } from 'vitest';
import { SemanticListsAudit } from './semantic-lists';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const page = (body: string, url = 'https://example.com/guide') =>
  mockPageContext(url, `<html><body>${body}</body></html>`, 1);

const run = (...bodies: string[]) =>
  new SemanticListsAudit().audit(mockCheckContext(bodies.map((b, i) => page(b, `https://example.com/p${i}`))));

describe('SemanticListsAudit', () => {
  describe('applicability', () => {
    it('is not applicable when nothing on the page is list-shaped', () => {
      expect(run('<main><p>Just a paragraph of prose.</p></main>').status).toBe('na');
    });

    it('is not applicable when no pages were scanned', () => {
      const result = new SemanticListsAudit().audit(mockCheckContext([]));
      expect(result.status).toBe('na');
    });

    it('ignores a breadcrumb <ol> — the canonical false pass', () => {
      const result = run(
        '<nav><ol class="breadcrumb"><li>Home</li><li>Docs</li><li>Guide</li></ol></nav><main><p>Prose.</p></main>',
      );
      expect(result.status).toBe('na');
    });

    it('ignores a BreadcrumbList-marked <ol> outside nav', () => {
      const result = run(
        '<main><ol itemscope itemtype="https://schema.org/BreadcrumbList"><li>Home</li><li>Docs</li><li>Guide</li></ol><p>Prose.</p></main>',
      );
      expect(result.status).toBe('na');
    });

    it('ignores a pagination <ol>', () => {
      const result = run('<main><ol class="pagination"><li>1</li><li>2</li><li>3</li></ol><p>Prose.</p></main>');
      expect(result.status).toBe('na');
    });
  });

  describe('semantic lists versus pseudo-lists', () => {
    it('does not count a navigation <ul> as a content list', () => {
      const result = run(
        `<nav><ul><li>Home</li><li>Docs</li></ul></nav>
         <main><div class="feature">Fast</div><div class="feature">Safe</div><div class="feature">Cheap</div></main>`,
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('1 pseudo-list');
    });

    it('passes when the content lists are all semantic', () => {
      const result = run('<main><ul><li>One</li><li>Two</li><li>Three</li></ul></main>');
      expect(result.status).toBe('pass');
    });

    it('fails on div-based pseudo-lists with no semantic list at all', () => {
      const result = run(
        `<main><div class="item">Item one</div><div class="item">Item two</div><div class="item">Item three</div></main>`,
      );
      expect(result.status).toBe('fail');
    });

    it('warns when semantic and pseudo lists are mixed', () => {
      const result = run(
        `<main>
           <ul><li>One</li><li>Two</li></ul>
           <div class="wrap"><div class="row">A</div><div class="row">B</div><div class="row">C</div></div>
         </main>`,
      );
      expect(result.status).toBe('warn');
    });

    it('counts manually numbered prose steps as a pseudo-list', () => {
      const result = run(
        `<main><p>1. Create an account</p><p>2. Add your API key</p><p>3. Ship it</p></main>`,
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('pseudo-list');
    });
  });

  // Absorbed from 6.13 (definition-elements): <dl>/<dfn> becomes one dimension
  // of this audit instead of a standalone warn-if-absent verdict.
  describe('definition elements (absorbs 6.13)', () => {
    it('counts a paired <dl> as a semantic list and reports it', () => {
      const result = run('<main><dl><dt>Widget</dt><dd>A thing that does work.</dd></dl></main>');
      expect(result.status).toBe('pass');
      expect(result.found).toContain('definition');
    });

    it('treats a <dl> with no <dt>/<dd> pair as broken grouping markup', () => {
      const result = run('<main><dl><div>Widget</div><div>A thing.</div></dl></main>');
      expect(result.status).toBe('fail');
    });

    it('never warns merely because a site has no glossary', () => {
      const result = run('<main><ul><li>One</li><li>Two</li></ul></main>');
      expect(result.status).toBe('pass');
      expect(result.found).toContain('0 definition');
    });

    it('reports an inline <dfn> without requiring a list', () => {
      const result = run('<main><ul><li>One</li><li>Two</li></ul><p>A <dfn>widget</dfn> is a thing.</p></main>');
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 definition');
    });
  });

  // Absorbed from 9.6 (numbered-steps): an <ol> counts as procedural only when
  // it is a real step list, and its absence is never a failure of its own.
  describe('ordered step lists (absorbs 9.6)', () => {
    it('reports a 3-item content <ol> as a step list', () => {
      const result = run(
        '<main><h2>How to get started</h2><ol><li>Create an account</li><li>Add a key</li><li>Call the API</li></ol></main>',
      );
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 step list');
    });

    it('does not fail a page that simply has no procedural content', () => {
      const result = run('<main><ul><li>One</li><li>Two</li></ul></main>');
      expect(result.status).toBe('pass');
      expect(result.found).toContain('0 step list');
    });
  });

  describe('multi-page aggregation', () => {
    it('aggregates the ratio across every scanned page', () => {
      const result = run(
        '<main><ul><li>One</li><li>Two</li></ul></main>',
        '<main><div class="i">a</div><div class="i">b</div><div class="i">c</div></main>',
        '<main><div class="j">a</div><div class="j">b</div><div class="j">c</div></main>',
      );
      expect(result.status).toBe('fail');
      expect(result.found).toContain('1 semantic list');
    });
  });
});
