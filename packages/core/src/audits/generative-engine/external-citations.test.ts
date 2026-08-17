import { describe, it, expect } from 'vitest';
import { ExternalCitationsAudit } from './external-citations';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ExternalCitationsAudit', () => {
  const audit = new ExternalCitationsAudit();

  it('passes when a page has 2+ external links', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <a href="https://research.google/pubs">Research</a>
        <a href="https://w3.org/standards">W3C</a>
        <a href="/internal">Internal</a>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2+ external links');
  });

  it('warns when a page has only 1 external link', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <a href="https://research.google/pubs">Research</a>
        <a href="/internal">Internal</a>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no page has 2+ external citations');
  });

  it('fails when no external links exist', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><a href="/internal">Internal</a></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No external links found');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('skips anchors with empty href (covers early-return branch)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <a href="">empty href anchor</a>
        <a href="https://external1.com">External 1</a>
        <a href="https://external2.com">External 2</a>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('ignores invalid hrefs that cause URL parsing to throw', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <a href=":::invalid:::">Bad link</a>
        <a href="https://external1.com">External 1</a>
        <a href="https://external2.com">External 2</a>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2+ external links');
  });

  it('stops adding to examples once 5 have been collected (covers examples >= 5 branch)', () => {
    const page1 = mockPageContext(
      'https://example.com/p1',
      `<html><body>
        <a href="https://a.com">A</a>
        <a href="https://b.com">B</a>
        <a href="https://c.com">C</a>
        <a href="https://d.com">D</a>
        <a href="https://e.com">E</a>
      </body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/p2',
      `<html><body>
        <a href="https://f.com">F</a>
        <a href="https://g.com">G</a>
      </body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('external link');
  });
});
