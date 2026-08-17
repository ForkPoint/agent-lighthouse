import { describe, it, expect } from 'vitest';
import { LastUpdatedIndicatorAudit } from './last-updated-indicator';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('LastUpdatedIndicatorAudit', () => {
  const audit = new LastUpdatedIndicatorAudit();

  it('is not-applicable when no article content page is scanned', () => {
    const page = mockPageContext('https://example.com/', '<html><body><main><p>Home</p></main></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No article content pages');
  });

  it('passes when an update keyword sits next to a <time> element', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('next to a <time>');
  });

  it('passes when an update keyword has an adjacent text date', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Last updated January 15, 2025 by our team.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('adjacent date');
  });

  it('warns when an update keyword exists but no date is adjacent', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Our content team last updated this section for better clarity.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no clear date');
  });

  it('fails when no update indicator exists', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Our platform helps you build great products quickly.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No "last updated" indicator');
  });

  it('warns once when multiple update keywords exist but no date is adjacent to any', () => {
    // Two UPDATED_PATTERN matches in the text ("updated" and "modified") but neither has
    // an adjacent parseable date. The second match hits the `if (!keywordOnlyPage)` false
    // branch (line 80): keywordOnlyPage is already set so the assignment is skipped.
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>This section was updated and later modified for clarity, but no date is shown.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no clear date');
  });

  it('passes when a bare <time> element (no datetime attr) sits next to update text', () => {
    // time.attr('datetime') is undefined → ?? '' right side taken (line 121).
    // The context still contains "updated" → UPDATED_PATTERN matches → hit is set.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time>January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('next to a <time>');
  });

  it('short-circuits on the first matching <time> when multiple time elements are present', () => {
    // Two <time> elements: the first sits next to "Last updated" (sets hit) so the
    // second iteration of the each() fires the `if (hit) return` early-exit path.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>
        <p>Event date: <time datetime="2025-03-01">March 1, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('next to a <time>');
  });

  it('falls through to text search when the <time> element has no update keyword nearby', () => {
    // The <time> element's parent text is "Published:" — not "updated/modified/revised" —
    // so timeWithUpdateKeyword returns null (covers the false branch of UPDATED_PATTERN.test).
    // The text "Last updated January 15, 2025" then matches via the plain-text path.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>
        <p>Last updated January 15, 2025 by our editorial team.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('adjacent date');
  });
});
