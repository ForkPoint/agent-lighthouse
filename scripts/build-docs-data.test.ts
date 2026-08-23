import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAuditList, buildCategoryPills, renderIndexHtml } from './build-docs-data';
import { defaultConfig } from '../packages/core/src';

describe('buildAuditList', () => {
  const list = buildAuditList();

  it('emits one record per registered audit', () => {
    // Derived from the registry: a graduation must not need this number retyped.
    const registered = Object.values(defaultConfig.audits).reduce((n, regs) => n + regs.length, 0);
    expect(list).toHaveLength(registered);
  });

  it('uses v2 slug ids and names a dossier for each', () => {
    expect(list.every((a) => /^[a-z-]+\/[a-z0-9-]+$/.test(a.id))).toBe(true);
    expect(list.every((a) => a.dossier.startsWith('docs/evidence/audits/'))).toBe(true);
  });

  it('carries the tier and evidence grade the report surfaces use', () => {
    expect(
      list.every((a) => a.tier === 'scored' || a.tier === 'informative' || a.tier === 'experimental'),
    ).toBe(true);
    expect(list.every((a) => ['A', 'B', 'C', 'D'].includes(a.evidenceGrade))).toBe(true);
    expect(list.some((a) => a.tier !== 'scored')).toBe(true);
  });
});

describe('buildCategoryPills', () => {
  it('covers all 8 categories and every audit exactly once', () => {
    const list = buildAuditList();
    const pills = buildCategoryPills(list);
    expect(pills).toHaveLength(8);
    expect(pills.reduce((n, p) => n + p.count, 0)).toBe(list.length);
  });
});

describe('renderIndexHtml', () => {
  const html = readFileSync(resolve(__dirname, '../packages/website/index.html'), 'utf8');
  const out = renderIndexHtml(html, buildAuditList());

  // This guarded against the v1 count (207) surviving a regeneration. It was
  // written as a bare literal, which stopped meaning that the day the v2
  // registry itself reached 207 audits. Every place the page quotes a count is
  // read instead, and all of them must agree with the live registry.
  it('quotes one audit count, and it is the live one', () => {
    const live = buildAuditList().length;
    const quoted = [
      ...out.matchAll(/(\d+) AI-agent readiness checks/g),
      ...out.matchAll(/Audit Directory \((\d+)\)/g),
      ...out.matchAll(/Audit Explorer \((\d+)\)/g),
      ...out.matchAll(/Explore all (\d+) audits/g),
      ...out.matchAll(/(\d+) pure deterministic rules/g),
      ...out.matchAll(/(\d+)-audit scan/g),
      ...out.matchAll(/id="audit-count-badge"[^>]*>(\d+)/g),
    ].map((match) => Number(match[1]));

    expect(quoted.length).toBeGreaterThan(0);
    expect([...new Set(quoted)]).toEqual([live]);
    expect(out).toContain(`${live} audits`);
  });

  // Guidance tags legitimately still contain words like "crawler-permissions",
  // so this checks the pill markup rather than the whole document.
  it('replaces the v1 category pills with the 8 v2 ones', () => {
    const pills = [...out.matchAll(/data-cat="([a-z-]+)"/g)].map((m) => m[1]);
    expect(pills).toEqual([
      'all',
      'access-crawl-control',
      'content-extraction',
      'machine-discovery',
      'structured-data',
      'answer-readiness',
      'agent-interfaces',
      'agentic-commerce',
      'operability-safety',
    ]);
  });

  it('escapes every angle bracket so the HTML parser cannot end the script early', () => {
    const script = out.slice(out.indexOf('window.EMBEDDED_AUDITS'));
    const array = script.slice(0, script.indexOf('\n    let activeCategory'));
    // A `<!--` followed by a `<script` puts the parser in the double-escaped
    // state, where the real closing tag stops closing anything.
    expect(array).not.toContain('<');
  });

  it('counts the categories in the hero', () => {
    expect(out).toContain('>8</div>\n          <div class="text-xs text-slate-400 mt-0.5">Audit Categories</div>');
  });

  it('embeds the live registry', () => {
    expect(out).toContain('"machine-discovery/llms-txt-exists"');
    expect(out).toContain('data-cat="machine-discovery"');
  });
});
