import { describe, it, expect } from 'vitest';
import { AgentsJsonAudit } from './agents-json';
import { weightForGrade } from '../../scorer';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

const PATH = '/.well-known/agents.json';

function runWith(body: string, status = 200, contentType = 'application/json') {
  const audit = new AgentsJsonAudit();
  const ctx = mockCheckContext([], {
    [PATH]: mockFetchResult(body, status, contentType),
  });
  return audit.audit(ctx);
}

const VALID_DOCUMENT = JSON.stringify({
  $schema: 'https://raw.githubusercontent.com/wild-card-ai/agents-json/main/schema/agents.schema.json',
  info: { title: 'Site', version: '0.1.0' },
  sources: [{ id: 'api', path: '/openapi.json' }],
});

const HTML_SHELL = '<!doctype html><html><body>App</body></html>';

describe('AgentsJsonAudit', () => {
  const audit = new AgentsJsonAudit();

  describe('a published document', () => {
    it('passes only for a real agents.json document', () => {
      const result = runWith(VALID_DOCUMENT);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('agents.json document');
      expect(result.found).toContain('1 source(s)');
    });

    it('passes a flows-only document', () => {
      const body = JSON.stringify({
        info: { title: 'Site', version: '0.1.0' },
        flows: [{ id: 'search', name: 'Search content' }],
      });
      const result = runWith(body);
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 flow(s)');
    });

    it.each([
      ['an empty array', '[]'],
      ['an empty object', '{}'],
      ['an array of objects', '[{"name":"a"}]'],
      ['the invented shape the old guidance prescribed', '{"name":"Site","protocols":["rest"]}'],
      ['info without sources or flows', '{"info":{"title":"Site"}}'],
    ])('warns instead of passing on %s', (_label, body) => {
      const result = runWith(body);
      expect(result.status).toBe('warn');
      expect(result.status).not.toBe('pass');
      expect(result.message).toContain('info');
      expect(result.message).toContain('sources');
    });

    it('warns when the served body does not parse', () => {
      const result = runWith('not json {{{', 200, 'application/json');
      expect(result.status).toBe('warn');
      expect(result.message).toContain('does not parse');
    });
  });

  describe('absence', () => {
    it('reports not-applicable when agents.json is absent (404)', () => {
      const result = runWith('', 404, 'text/html');
      expect(result.status).toBe('na');
      expect(result.score).toBe(0);
      expect(result.found).toContain('404');
      expect(result.message).toContain('not a finding');
    });

    it('reports not-applicable when the path was not fetched', () => {
      const result = audit.audit(mockCheckContext([], {}));
      expect(result.status).toBe('na');
      expect(result.found).toContain('No agents.json published');
    });

    it('reports not-applicable on an empty 200 body', () => {
      const result = runWith('   ', 200, 'application/json');
      expect(result.status).toBe('na');
      expect(result.found).toContain('empty body');
    });
  });

  describe('the soft-404 signal', () => {
    it('names an HTML 200 at the well-known path as a soft-404, not invalid JSON', () => {
      const result = runWith(HTML_SHELL, 200, 'text/html');
      expect(result.status).toBe('warn');
      expect(result.message).toContain('HTML page');
      expect(result.message).toContain('404 is the honest answer');
      expect(result.message).not.toContain('not valid JSON');
    });

    it('sniffs the body, not the content type — HTML served as JSON is still HTML', () => {
      const result = runWith(HTML_SHELL, 200, 'application/json');
      expect(result.status).toBe('warn');
      expect(result.message).toContain('HTML page');
    });

    it('does not claim an HTML body when a real document is served as text/html', () => {
      const result = runWith(VALID_DOCUMENT, 200, 'text/html');
      expect(result.status).toBe('warn');
      expect(result.message).toContain('text/html');
      expect(result.message).toContain('media type');
      expect(result.message).not.toContain('HTML page');
      expect(result.found).toContain('Valid agents.json document');
    });
  });

  it('never returns fail for any input', () => {
    const fixtures: Array<[string, number, string]> = [
      ['', 404, 'text/html'],
      ['', 500, 'text/html'],
      [HTML_SHELL, 200, 'text/html'],
      [HTML_SHELL, 200, 'application/json'],
      ['not json {{{', 200, 'application/json'],
      ['[]', 200, 'application/json'],
      ['{}', 200, 'application/json'],
      [VALID_DOCUMENT, 200, 'application/json'],
      [VALID_DOCUMENT, 200, 'text/html'],
    ];
    for (const [body, status, contentType] of fixtures) {
      expect(runWith(body, status, contentType).status).not.toBe('fail');
    }
    expect(audit.audit(mockCheckContext([], {})).status).not.toBe('fail');
  });

  describe('meta', () => {
    const meta = AgentsJsonAudit.meta;

    it('stays grade C, informative, weight 0', () => {
      expect(meta.evidenceGrade).toBe('C');
      expect(meta.tier).toBe('informative');
      expect(meta.scoreDisplayMode).toBe('informative');
      expect(meta.weight).toBe(0);
      expect(meta.weight).toBe(weightForGrade('C', 'informative'));
      expect(meta.defaultPriority).toBe('low');
    });

    it('carries no deprecation notice — the audit is not retired', () => {
      expect(meta.deprecated).toBeUndefined();
    });

    it('reads true on every status the audit can return', () => {
      // `title` renders on `pass` and `na`, so it may not assert the file exists.
      expect(meta.title).not.toMatch(/exists/i);
      // `failureTitle` renders only on `warn` here, all of which are
      // "published, but unusable" cases.
      expect(meta.failureTitle).toContain('published');
    });

    it('points at a live primary source, not the dead agentsjson.org domain', () => {
      expect(meta.guidance?.docsUrl).toBe('https://github.com/wild-card-ai/agents-json');
      expect(JSON.stringify(meta)).not.toContain('agentsjson.org');
    });

    it('describes the real spec shape and not the invented one', () => {
      const code = meta.guidance?.code ?? '';
      expect(code).toContain('info');
      expect(code).toContain('sources');
      expect(code).not.toContain('rate_limits');
      expect(code).not.toContain('protocols');
      expect(code).not.toContain('authentication');
    });

    it('never instructs a non-publisher to create the file', () => {
      const fix = meta.guidance?.fix ?? '';
      expect(fix).not.toMatch(/create a \/\.well-known\/agents\.json/i);
      expect(fix).toContain('Nothing to do if the site does not publish this file');
    });
  });
});
