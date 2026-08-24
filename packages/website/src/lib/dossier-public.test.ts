import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PAGE_ORDER, publicDossier } from './dossier-public';
import { repoPath } from './markdown-slice';

const DOSSIER_DIR = repoPath('docs/evidence/audits');

/** Every dossier on disk, as `<category>/<slug>`. */
function dossierIds(): string[] {
  return readdirSync(DOSSIER_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readdirSync(`${DOSSIER_DIR}/${entry.name}`)
        .filter((file) => file.endsWith('.md'))
        .map((file) => `${entry.name}/${file.replace(/\.md$/, '')}`),
    )
    .sort();
}

function read(id: string): string {
  return readFileSync(`${DOSSIER_DIR}/${id}.md`, 'utf8');
}

describe('publicDossier', () => {
  describe('the whitelist', () => {
    it('publishes the page contract and withholds the build record', () => {
      const result = publicDossier(read('access-crawl-control/agent-governance'));

      expect(result.published).toEqual([
        'What it checks',
        'Why it matters',
        'Evidence',
        'Limits',
        'How it scores',
      ]);
      expect(result.withheld).toEqual(
        expect.arrayContaining([
          'Code review findings (2026-08-20, 11-agent pass)',
          'Pass-rule correction (contradiction sweep, 2026-08-24)',
          'Review history',
        ]),
      );
    });

    // The prototype the design was measured against: 1600 words in the file,
    // and the page contract is a minority of them.
    it('publishes well under half of the prototype file', () => {
      const source = read('access-crawl-control/agent-governance');
      const { markdown } = publicDossier(source);
      const words = (text: string) => text.trim().split(/\s+/).length;
      expect(words(markdown) / words(source)).toBeLessThan(0.5);
    });

    it('fails closed on a heading it does not know', () => {
      const source = '## What it checks\n\nA.\n\n## Internal ritual\n\nB.\n';
      const result = publicDossier(source);
      expect(result.published).toEqual(['What it checks']);
      expect(result.withheld).toEqual(['Internal ritual']);
      expect(result.markdown).not.toContain('ritual');
    });

    it('discards the working title and the intro strip above the first section', () => {
      const result = publicDossier(read('access-crawl-control/agent-governance'));
      expect(result.markdown).not.toContain('# agent-governance');
      // The strip carries `review verdict` and a stale v1 category name.
      expect(result.markdown).not.toContain('review verdict');
      expect(result.markdown).not.toContain('crawler-permissions');
    });
  });

  describe('supersede', () => {
    it('keeps the dated evidence section and withholds the placeholder above it', () => {
      const source = read('access-crawl-control/agent-governance');
      const result = publicDossier(source);
      // `## Evidence` is a 30-word disclaimer; `## Evidence (2026-08-21)` is the
      // research that replaced it. Publishing both would print the disclaimer
      // above the evidence it was superseded by.
      expect(source).toContain('No dedicated evidence signal was researched');
      expect(result.markdown).not.toContain('No dedicated evidence signal was researched');
      expect(result.withheld).toContain('Evidence');
    });

    it('prefers a later date over file order', () => {
      const source = [
        '## Evidence (2026-08-21)',
        '',
        'Later.',
        '',
        '## Evidence',
        '',
        'Earlier, but undated.',
      ].join('\n');
      expect(publicDossier(source).markdown).toContain('Later.');
      expect(publicDossier(source).markdown).not.toContain('Earlier');
    });

    it('falls back to file order when neither section is dated', () => {
      const source = '## Scoring\n\nFirst.\n\n## Scoring\n\nSecond.\n';
      expect(publicDossier(source).markdown).toContain('Second.');
      expect(publicDossier(source).markdown).not.toContain('First.');
    });
  });

  describe('labelled blocks', () => {
    it('promotes the mechanism out of the evidence into "Why it matters"', () => {
      const result = publicDossier(read('access-crawl-control/agent-governance'));
      expect(result.markdown).toMatch(
        /## Why it matters\n\nEach major AI vendor operates separate robots\.txt product tokens/,
      );
      expect(result.markdown).not.toContain('**Mechanism claim:**');
    });

    it('promotes the counter-evidence into "Limits"', () => {
      const result = publicDossier(read('access-crawl-control/agent-governance'));
      expect(result.published).toContain('Limits');
      expect(result.markdown).toContain('The A grade covers the *capability*');
      expect(result.markdown).not.toContain('**Counter-evidence:**');
    });

    it('promotes the grade reasoning into "How it scores", without the letter', () => {
      const result = publicDossier(read('access-crawl-control/agent-governance'));
      expect(result.markdown).toContain(
        '## How it scores\n\nThis is a ratified standard (RFC 9309)',
      );
      // The grade letter is already in the page's own metadata strip.
      expect(result.markdown).not.toContain('**Grade: A**');
    });

    it('names the signal each promoted block came from when there are several', () => {
      const result = publicDossier(read('agent-interfaces/webmcp-registered-tools'));
      expect(result.markdown).toContain('**webmcp-well-known-manifest** —');
      expect(result.markdown).toContain('**agent-surface-soft-404-validation** —');
    });

    it('withholds Consumers and Recommended tier everywhere', () => {
      for (const id of dossierIds()) {
        const { markdown } = publicDossier(read(id));
        expect(markdown, id).not.toContain('Recommended tier');
        expect(markdown, id).not.toContain('**Consumers:**');
      }
    });

    it('leaves a section it does not have a promotion target for alone', () => {
      // No `Evidence` section, so nothing is promoted out of anything.
      const result = publicDossier('## What it checks\n\n**Mechanism:** A claim.\n');
      expect(result.markdown).toContain('**Mechanism:** A claim.');
    });
  });

  describe('frontmatter overrides', () => {
    it('publishes a section named by public_extra, after the contract', () => {
      const source = '## What it checks\n\nA.\n\n## The GEO-benchmark rebuild\n\nB.\n';
      const result = publicDossier(source, { publicExtra: ['The GEO-benchmark rebuild'] });
      expect(result.published).toEqual(['What it checks', 'The GEO-benchmark rebuild']);
      expect(result.markdown).toContain('## The GEO-benchmark rebuild');
    });

    it('withholds a section named by public_omit', () => {
      const source = '## What it checks\n\nA.\n\n## Example failure\n\nB.\n';
      const result = publicDossier(source, { publicOmit: ['Example failure'] });
      expect(result.published).toEqual(['What it checks']);
      expect(result.withheld).toContain('Example failure');
    });
  });

  describe('fences', () => {
    it('does not treat a heading inside a code fence as a section boundary', () => {
      const source = [
        '## What it checks',
        '',
        '```sh',
        '## not a heading',
        '```',
        '',
        'Still the same section.',
      ].join('\n');
      const result = publicDossier(source);
      expect(result.published).toEqual(['What it checks']);
      expect(result.markdown).toContain('Still the same section.');
      expect(result.withheld).toEqual([]);
    });

    it('does not promote a label that is inside a code fence', () => {
      const source = ['## Evidence', '', '```md', '**Mechanism:** example', '```'].join('\n');
      const result = publicDossier(source);
      expect(result.published).toEqual(['Evidence']);
      expect(result.markdown).toContain('**Mechanism:** example');
    });
  });

  describe('the whole corpus', () => {
    const ids = dossierIds();

    it('publishes the three unconditional sections for every dossier', () => {
      for (const id of ids) {
        const { published, markdown } = publicDossier(read(id));
        expect(markdown.trim(), id).not.toBe('');
        for (const name of ['What it checks', 'Why it matters', 'Evidence']) {
          expect(published, id).toContain(name);
        }
        // The 2026-08-20 research pass left this sentence in dossiers whose
        // evidence had not been written yet. None survives; if one reappears,
        // an audit is publishing an evidence section that says there is none.
        expect(markdown, id).not.toContain('No dedicated evidence signal');
      }
    });

    it('never publishes the internal process vocabulary', () => {
      // The design's provenance rule: the record stays in the repository, the
      // page does not name the tooling that produced it.
      const banned = [
        '11-agent pass',
        'review verdict',
        'Plan 4, Task',
        'REWORK-TODO',
        'TODO(redeem)',
        'contradiction sweep',
        'Competitor coverage',
        'code review',
        'Code review',
        'redemption',
        'Recommended tier',
        '**Consumers:**',
        'No dedicated evidence signal',
      ];
      for (const id of ids) {
        const { markdown } = publicDossier(read(id));
        for (const phrase of banned) expect(markdown, `${id}: ${phrase}`).not.toContain(phrase);
      }
    });

    it('prints its sections in the page-contract order', () => {
      for (const id of ids) {
        const { published } = publicDossier(read(id));
        const contract = published.filter((name) =>
          (PAGE_ORDER as readonly string[]).includes(name),
        );
        const ranked = contract.map((name) => (PAGE_ORDER as readonly string[]).indexOf(name));
        expect([...ranked].sort((a, b) => a - b), id).toEqual(ranked);
      }
    });

    // The counts are pinned so that a corpus edit which quietly empties a
    // section, or a whitelist edit which quietly opens one, shows up here.
    it('publishes the expected number of each contract section', () => {
      const counts: Record<string, number> = {};
      for (const id of ids) {
        for (const name of publicDossier(read(id)).published) {
          counts[name] = (counts[name] ?? 0) + 1;
        }
      }
      expect(counts).toEqual({
        // The page contract's first three are unconditional: every audit says
        // what it looks for, why that matters, and on whose evidence.
        'What it checks': 215,
        'Why it matters': 215,
        Evidence: 215,
        Limits: 148,
        // Every scored audit publishes its grade reasoning; the shortfall is
        // in the informative and experimental tiers, which the bar exempts.
        'How it scores': 190,
        'Example failure': 66,
      });
    });
  });
});
