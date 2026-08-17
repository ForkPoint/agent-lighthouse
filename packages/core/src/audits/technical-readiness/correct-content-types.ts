import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';

export class CorrectContentTypesAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.10',
    category: 'technical-readiness',
    title: 'Correct Content-Types',
    failureTitle: 'Correct Content-Types',
    description:
      'AI agents use Content-Type headers to determine how to parse your files. Incorrect MIME types cause JSON files to be treated as plain text (breaking schema parsing) or XML to be treated as HTML (breaking sitemap crawling). Fix Content-Type headers to match each file format.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Incorrect Content-Type headers cause AI agents to misparse your files. JSON served as text/html breaks structured data extraction, XML sitemaps served as text/plain prevent crawl discovery, and llms.txt served as application/octet-stream triggers downloads instead of being read. This silently breaks the AI data pipeline.',
      fix: 'Configure your web server or CDN to serve each file with the correct MIME type: application/json for JSON files, application/xml for XML sitemaps, and text/plain for llms.txt.',
      code: 'llms.txt:        Content-Type: text/plain\nopenapi.json:    Content-Type: application/json\nai-catalog.json: Content-Type: application/json\nsitemap.xml:     Content-Type: application/xml',
      effort: 'easy',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type',
      tags: ['headers', 'ai-files', 'configuration'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    const expectations: Array<{
      path: string;
      expectedType: string;
      label: string;
    }> = [
      { path: '/llms.txt', expectedType: 'text/plain', label: 'llms.txt' },
      {
        path: '/.well-known/ai-catalog.json',
        expectedType: 'application/json',
        label: 'ai-catalog.json',
      },
      {
        path: '/openapi.json',
        expectedType: 'application/json',
        label: 'openapi.json',
      },
      {
        path: '/sitemap.xml',
        expectedType: 'application/xml',
        label: 'sitemap.xml',
      },
    ];

    const correct: string[] = [];
    const incorrect: Array<{ label: string; expected: string; actual: string }> = [];
    let checked = 0;

    for (const { path, expectedType, label } of expectations) {
      const file = ctx.rootFiles[path];
      if (!file || file.status !== 200) continue;
      checked++;

      const ct = file.contentType.toLowerCase().split(';')[0].trim();
      if (ct.includes(expectedType)) {
        correct.push(label);
      } else {
        incorrect.push({ label, expected: expectedType, actual: ct });
      }
    }

    if (checked === 0) {
      return this.warn(
        'No AI/data files found to verify Content-Type headers.',
        'JSON files served as application/json, XML as application/xml, llms.txt as text/plain',
        'No applicable files found',
        undefined,
        page?.url,
      );
    }

    if (incorrect.length === 0) {
      return this.pass(
        `All checked files have correct Content-Type headers: ${correct.join(', ')}`,
        'JSON files served as application/json, XML as application/xml, llms.txt as text/plain',
        `Correct: ${correct.join(', ')}`,
        page?.url,
      );
    }

    const details = incorrect
      .map((i) => `${i.label}: expected ${i.expected}, got ${i.actual}`)
      .join('; ');

    return this.fail(
      `Incorrect Content-Type on some files: ${details}`,
      'JSON files served as application/json, XML as application/xml, llms.txt as text/plain',
      `Incorrect: ${details}`,
      {
        priority: 'medium',
        description:
          'AI agents use Content-Type headers to determine how to parse your files. Incorrect MIME types cause JSON files to be treated as plain text (breaking schema parsing) or XML to be treated as HTML (breaking sitemap crawling). Fix Content-Type headers to match each file format.',
        code: incorrect.map((i) => `${i.label}: Content-Type: ${i.expected}`).join('\n'),
      },
      page?.url,
    );
  }
}
