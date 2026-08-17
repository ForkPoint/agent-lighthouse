import { describe, it, expect } from 'vitest';
import { CodeLanguageAudit } from './code-language';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('CodeLanguageAudit', () => {
  const audit = new CodeLanguageAudit();

  it('warns when there are no <pre><code> blocks', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>No code</p></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No code blocks found');
  });

  it('passes when all code blocks have language annotations', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><pre><code class="language-javascript">const x = 1;</code></pre></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
  });

  it('warns when a majority but not all code blocks are annotated', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <pre><code class="language-js">a</code></pre>
        <pre><code class="language-py">b</code></pre>
        <pre><code>c</code></pre>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('2/3');
  });

  it('fails when no code block has a language annotation', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><pre><code>plain code</code></pre></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.found).toContain('0/1');
  });
});
