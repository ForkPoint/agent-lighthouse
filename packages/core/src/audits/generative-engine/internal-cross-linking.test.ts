import { describe, it, expect } from 'vitest';
import { InternalCrossLinkingAudit } from './internal-cross-linking';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('InternalCrossLinkingAudit', () => {
  const audit = new InternalCrossLinkingAudit();

  it('passes when all pages have 2+ internal cross-links', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2+ internal cross-links');
  });

  it('warns when only some pages are well-linked', () => {
    const page1 = mockPageContext(
      'https://example.com/p1',
      `<html><body><a href="/a">A</a><a href="/b">B</a></body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/p2',
      `<html><body><p>No links here.</p></body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1 of 2');
  });

  it('fails when no page has 2+ internal cross-links', () => {
    const page = mockPageContext(
      'https://example.com/lonely',
      `<html><body><a href="https://external.com">External</a></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No scanned page has 2+ internal cross-links');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });
});
