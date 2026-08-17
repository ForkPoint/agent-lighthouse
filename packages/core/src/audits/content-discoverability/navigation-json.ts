import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import type { FetchResult } from '../../fetcher';

function isOk(result: FetchResult): boolean {
  return result.status === 200;
}

export class NavigationJsonAudit extends Audit {
  static override meta: AuditMeta = {
    id: '1.21',
    category: 'content-discoverability',
    title: 'navigation.json present',
    failureTitle: 'navigation.json present',
    description:
      'A navigation.json file gives AI agents a machine-readable map of your site hierarchy, helping them navigate your site like a human would.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Without a machine-readable navigation structure, AI agents must infer your site hierarchy from HTML parsing, which is error-prone and incomplete. A navigation.json gives agents a clear map of your site, enabling accurate multi-step browsing.',
      fix: 'Create a /navigation.json file at your site root with a JSON structure representing your site menu hierarchy. Include labels, URLs, and nested children for submenus.',
      code: '{\n  "name": "Your Site",\n  "items": [\n    { "label": "Home", "url": "/" },\n    { "label": "Products", "url": "/products", "children": [\n      { "label": "Product A", "url": "/products/a" },\n      { "label": "Product B", "url": "/products/b" }\n    ]},\n    { "label": "About", "url": "/about" }\n  ]\n}',
      effort: 'easy',
      tags: ['navigation', 'structured-data', 'discoverability'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const result = ctx.rootFiles['/navigation.json'];

    if (!result || !isOk(result)) {
      return this.fail(
        'No navigation.json found at the site root.',
        'GET /navigation.json returns 200 with valid JSON',
        result ? `HTTP ${result.status}` : 'No response',
        {
          priority: 'medium',
          description:
            'A navigation.json file gives AI agents a machine-readable map of your site hierarchy. This helps agents navigate your site like a human would, following logical paths through menus and sections.',
          code: `{\n  "name": "Your Site",\n  "items": [\n    { "label": "Home", "url": "/" },\n    { "label": "Products", "url": "/products", "children": [\n      { "label": "Product A", "url": "/products/a" },\n      { "label": "Product B", "url": "/products/b" }\n    ]},\n    { "label": "About", "url": "/about" }\n  ]\n}`,
        },
      );
    }

    try {
      JSON.parse(result.body);
    } catch {
      return this.fail(
        'navigation.json exists but contains invalid JSON.',
        'Valid JSON content',
        'Invalid JSON',
        {
          priority: 'medium',
          description:
            'Your navigation.json has invalid JSON syntax, so AI agents cannot parse it. Validate the JSON and fix any syntax errors (missing commas, unquoted keys, etc.).',
          code: `{\n  "name": "Your Site",\n  "items": [\n    { "label": "Home", "url": "/" },\n    { "label": "About", "url": "/about" }\n  ]\n}`,
        },
      );
    }

    return this.pass(
      'navigation.json exists with valid JSON.',
      'HTTP 200 with valid JSON',
      'Valid JSON',
    );
  }
}
