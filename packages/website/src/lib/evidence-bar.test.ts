import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { barViolations, enforceEvidenceBar, publishedSections } from './evidence-bar';
import { publicDossier } from './dossier-public';
import { repoPath } from './markdown-slice';
import { auditList } from './registry';

const DOSSIER_DIR = repoPath('docs/evidence/audits');

/** A page that clears every rule, to be broken one rule at a time. */
function goodPage() {
  return {
    markdown:
      '## Evidence\n\n- **[A source](https://example.com/doc)** — vendor (verified 2026-08-24)\n',
    published: ['What it checks', 'Why it matters', 'Evidence', 'How it scores'],
  };
}

const SCORED = { id: 'x/y', tier: 'scored', dossierGrade: 'A', registryGrade: 'A' };

describe('barViolations', () => {
  it('passes a scored page that carries all six', () => {
    expect(barViolations(SCORED, goodPage())).toEqual([]);
  });

  it('names a grade the registry does not agree with', () => {
    const problems = barViolations({ ...SCORED, registryGrade: 'B' }, goodPage());
    expect(problems).toEqual(['frontmatter grade A does not match the registry\'s B']);
  });

  it('reports every missing section at once rather than the first', () => {
    const page = { ...goodPage(), published: [] };
    expect(barViolations(SCORED, page)).toHaveLength(4);
  });

  it('holds a scored page to the source, the stamp and the reasoning', () => {
    const page = { markdown: 'No source, no stamp.', published: ['What it checks', 'Why it matters', 'Evidence'] };
    expect(barViolations(SCORED, page)).toEqual([
      'is scored but cites no source a reader can open',
      'is scored but no source carries a `(verified <date>)` stamp',
      'is scored but publishes no grade reasoning — add a `## Scoring` section or a `**Grade: X** — …` line',
    ]);
  });

  it('exempts a non-scored tier from the last three rules', () => {
    const page = { markdown: 'No source, no stamp.', published: ['What it checks', 'Why it matters', 'Evidence'] };
    expect(barViolations({ ...SCORED, tier: 'informative' }, page)).toEqual([]);
  });

  // Both spellings the corpus uses. A stamp is a date attached to the act of
  // checking; which line carries it is a house-style question, not a bar.
  it.each([
    '**Sources:** [Doc](https://example.com) (verified 2026-08-24)',
    '- Quote — https://example.com (vendor-doc, URL verified 2026-08-24)',
  ])('accepts the stamp spelling %#', (line) => {
    expect(barViolations(SCORED, { ...goodPage(), markdown: line })).toEqual([]);
  });
});

describe('publishedSections', () => {
  it('reads the `## ` headings and ignores deeper ones', () => {
    expect(publishedSections('## One\n\ntext\n\n### Signal: x\n\n## Two\n')).toEqual(['One', 'Two']);
  });
});

describe('enforceEvidenceBar', () => {
  it('says nothing when every entry clears the bar', () => {
    expect(() => enforceEvidenceBar([{ subject: SCORED, page: goodPage() }])).not.toThrow();
  });

  it('names every failing dossier in one error', () => {
    const bad = { markdown: '', published: [] };
    expect(() =>
      enforceEvidenceBar([
        { subject: { ...SCORED, id: 'a/one' }, page: bad },
        { subject: { ...SCORED, id: 'a/two' }, page: bad },
      ]),
    ).toThrow(/2 dossier\(s\)[\s\S]*a\/one[\s\S]*a\/two/);
  });
});

describe('the whole corpus', () => {
  // The same check the dossier route runs at build time, repeated here so a
  // dossier edit that drops below the bar fails the test suite too, rather than
  // waiting for a website build nobody runs locally.
  it('clears the bar for every registered audit', () => {
    const failures: string[] = [];
    for (const audit of auditList()) {
      const source = readFileSync(`${DOSSIER_DIR}/${audit.id}.md`, 'utf8');
      const grade = /^evidence_grade:\s*['"]?([A-D])/m.exec(source)?.[1] ?? '';
      const { markdown } = publicDossier(source);
      const problems = barViolations(
        {
          id: audit.id,
          tier: audit.tier,
          dossierGrade: grade,
          registryGrade: audit.evidenceGrade,
        },
        { markdown, published: publishedSections(markdown) },
      );
      if (problems.length > 0) failures.push(`${audit.id}: ${problems.join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('reads a dossier for every audit', () => {
    const onDisk = readdirSync(DOSSIER_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => readdirSync(`${DOSSIER_DIR}/${entry.name}`).filter((f) => f.endsWith('.md')));
    expect(onDisk).toHaveLength(auditList().length);
  });
});
