import { describe, it, expect } from 'vitest';
import { SequentialHeadingsAudit } from './sequential-headings';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('SequentialHeadingsAudit', () => {
  const audit = new SequentialHeadingsAudit();

  it('passes when headings follow a sequential hierarchy', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><h1>Title</h1><h2>Section</h2><h3>Subsection</h3></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('No heading skips');
  });

  it('warns when fewer than 2 headings exist', () => {
    const page = mockPageContext('https://example.com', '<html><body><h1>Only one</h1></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('fewer than 2 headings');
  });

  it('fails when a single page skips a heading level', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><h1>Title</h1><h3>Skipped to h3</h3></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('heading level skips');
    expect(result.found).toContain('h1 -> h3');
  });

  it('warns when only a minority of pages have skips', () => {
    const good = mockPageContext(
      'https://example.com/a',
      '<html><body><h1>Title</h1><h2>Section</h2></body></html>',
    );
    const bad = mockPageContext(
      'https://example.com/b',
      '<html><body><h1>Title</h1><h3>Skip</h3></body></html>',
    );
    const result = audit.audit(mockCheckContext([good, bad]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2');
  });
});
