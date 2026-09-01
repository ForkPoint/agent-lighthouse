import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function findAuditSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findAuditSources(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && entry.name !== 'index.ts') {
      out.push(fullPath);
    }
  }
  return out;
}

describe('Phase 3 Contract — No direct pageType reads in audit sources', () => {
  it('enforces that no production audit reads .pageType directly', () => {
    const auditsDir = path.resolve(__dirname, '../audits');
    const sources = findAuditSources(auditsDir);
    const offending: string[] = [];

    for (const file of sources) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/\.pageType\b/.test(content)) {
        offending.push(path.relative(auditsDir, file));
      }
    }

    expect(offending).toEqual([]);
  });
});
