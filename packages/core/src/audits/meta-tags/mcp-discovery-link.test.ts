import { describe, it, expect } from 'vitest';
import { McpDiscoveryLinkAudit } from './mcp-discovery-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('McpDiscoveryLinkAudit', () => {
  const audit = new McpDiscoveryLinkAudit();

  it('passes when an MCP discovery alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="application/json" href="/mcp.json" title="MCP Server">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/mcp.json');
  });

  it('fails when a JSON alternate link has an unrelated title', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="application/json" href="/data.json" title="Data">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No MCP discovery link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
