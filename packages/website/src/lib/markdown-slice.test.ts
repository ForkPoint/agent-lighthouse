import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sliceSection, DOC_SECTIONS, readDocSource } from './markdown-slice';

const REPO = resolve(__dirname, '../../../..');

describe('sliceSection', () => {
  it('returns the body under a heading', () => {
    const md = '# Title\n\n## One\n\nfirst\n\n## Two\n\nsecond\n';
    expect(sliceSection(md, '## One').trim()).toBe('first');
  });

  it('throws when the heading is gone', () => {
    expect(() => sliceSection('## Other\n', '## One')).toThrow(/## One/);
  });

  it('returns the tail when the heading is the last section', () => {
    const md = '## One\n\nfirst\n\n## Two\n\nlast\n';
    expect(sliceSection(md, '## Two').trim()).toBe('last');
  });

  it('returns an empty body when the next heading follows immediately', () => {
    const md = '## One\n## Two\n\nsecond\n';
    expect(sliceSection(md, '## One')).toBe('');
  });

  // A `## ` inside a fenced block is a shell or YAML comment, or a markdown
  // example — not the start of the next section. Stopping there truncates the
  // page silently: the heading is still found and the slice is still non-empty,
  // so nothing downstream can tell that the rest of the body went missing.
  it('does not stop at a `## ` line inside a fenced code block', () => {
    const md = [
      '## One',
      '',
      '```bash',
      '## not a heading, a shell comment',
      '```',
      '',
      'still the first section',
      '',
      '## Two',
      '',
      'second',
      '',
    ].join('\n');

    const body = sliceSection(md, '## One');
    expect(body).toContain('## not a heading, a shell comment');
    expect(body).toContain('still the first section');
    expect(body).not.toContain('second');
  });

  it('tracks tilde fences and fences longer than three characters', () => {
    const tildes = '## One\n\n~~~\n## inside tildes\n~~~\n\ntail\n\n## Two\n\nsecond\n';
    expect(sliceSection(tildes, '## One')).toContain('tail');
    expect(sliceSection(tildes, '## One')).not.toContain('second');

    // A four-backtick fence is closed only by four or more backticks, so the
    // three-backtick line inside it is content and the block runs on.
    const long = '## One\n\n````md\n```\n## inside nested fence\n```\n````\n\ntail\n\n## Two\n\nsecond\n';
    expect(sliceSection(long, '## One')).toContain('tail');
    expect(sliceSection(long, '## One')).not.toContain('second');
  });

  it('does not take a heading that is only an example inside a fence', () => {
    const md = '# Title\n\n```md\n## One\n```\n\n## One\n\nthe real body\n';
    expect(sliceSection(md, '## One').trim()).toBe('the real body');
  });
});

describe('DOC_SECTIONS', () => {
  it('names a real file for every section', () => {
    for (const section of DOC_SECTIONS) {
      expect(() => readFileSync(resolve(REPO, section.file), 'utf8'), section.slug).not.toThrow();
    }
  });

  // A README edit that renames a heading must fail here, not empty a page.
  it('finds every heading it slices', () => {
    for (const section of DOC_SECTIONS) {
      if (!section.heading) continue;
      const source = readFileSync(resolve(REPO, section.file), 'utf8');
      expect(() => sliceSection(source, section.heading!), `${section.slug} → ${section.heading}`).not.toThrow();
    }
  });
});

describe('readDocSource', () => {
  it('gives every section prose to render', () => {
    for (const section of DOC_SECTIONS) {
      expect(readDocSource(section).trim().length, `${section.slug} renders nothing`).toBeGreaterThan(80);
    }
  });

  it('slices the section the heading names, and nothing after it', () => {
    const quickstart = readDocSource(DOC_SECTIONS.find((s) => s.slug === 'quickstart')!);

    expect(quickstart).toContain('npx @forkpoint/agent-lighthouse');
    // The heading line itself, and the section that follows, stay out.
    expect(quickstart).not.toContain('## ⚡ Quickstart');
    expect(quickstart).not.toContain('What Agent Lighthouse Checks');
  });

  it('drops the rule the README separates its sections with', () => {
    for (const section of DOC_SECTIONS) {
      if (!section.heading) continue;
      expect(readDocSource(section).trimEnd(), section.slug).not.toMatch(/\n-{3,}$/);
    }
  });

  it('leaves a whole file with the `# ` heading the page takes its title from', () => {
    for (const section of DOC_SECTIONS) {
      if (section.heading) continue;
      expect(readDocSource(section), section.slug).toMatch(/^# \S/);
    }
  });

  it('gives every section a distinct slug and its own route', () => {
    expect(new Set(DOC_SECTIONS.map((s) => s.slug)).size).toBe(DOC_SECTIONS.length);
    expect(DOC_SECTIONS).toHaveLength(12);
  });
});
