import { describe, it, expect } from 'vitest';
import { DirectDefinitionsAudit } from './direct-definitions';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('DirectDefinitionsAudit', () => {
  const audit = new DirectDefinitionsAudit();

  it('is not-applicable when no article content page is scanned', () => {
    const page = mockPageContext('https://example.com/', '<html><body><main><p>Home</p></main></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No article content pages');
  });

  it('passes when <dfn> markup is present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p><dfn>Unified content preparation</dfn> structures content for agents.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('<dfn>');
  });

  it('passes when a bold-colon sentence definition is present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p><strong>Term:</strong> the process of structuring site content for both humans and AI agents.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('bold-colon');
  });

  it('fails when no definition-style formatting is present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>We write about many topics relevant to building modern software products.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No definition-style formatting');
  });

  it('does not count bold elements without a colon or with only short text after the colon', () => {
    // Tests two uncovered branches in the $('strong, b').each callback:
    //   1. label without ':' → early return (line 70 true branch)
    //   2. label with ':' but < 6 words after → boldColonDefs not incremented (line 73 false branch)
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p><strong>Plain label</strong> — this is not a definition pattern at all.</p>
        <p><strong>Weight:</strong> 200g.</p>
        <p>We write about many topics for modern software products today.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No definition-style formatting');
  });

  it('passes when a <dl> contains a sentence-length <dd>', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <dl>
          <dt>Short spec</dt>
          <dd>200g</dd>
          <dt>Unified Content Preparation</dt>
          <dd>The process of structuring site content for consumption by both humans and AI agents.</dd>
        </dl>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('<dl>');
  });
});
