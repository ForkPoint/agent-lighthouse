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

  describe('compaction', () => {
    it('shortens a signal heading to its first clause and drops the grade suffix', () => {
      const source = [
        '## Evidence',
        '',
        '### Signal: Markdown alternate representations of pages (.md URLs and Accept: text/markdown content negotiation) — grade A (llms-txt)',
        '',
        '**Evidence:** Anthropic documents it.',
      ].join('\n');
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('### Markdown alternate representations of pages');
      // The grade is on the page's own card, and the domain is an internal key.
      expect(markdown).not.toContain('grade A');
      expect(markdown).not.toContain('(llms-txt)');
      // `**Evidence:**` under a heading that already says Evidence.
      expect(markdown).not.toContain('**Evidence:**');
    });

    it('trims a signal heading that would be cut on a dangling word', () => {
      const long = `${'A'.repeat(46)} and ${'B'.repeat(40)}`;
      const { markdown } = publicDossier(`## Evidence\n\n### Signal: ${long} — grade B (x)\n\ntext\n`);
      const heading = /^### (.+)$/m.exec(markdown)![1]!;
      // The cut lands after "and"; a label must not end on a conjunction.
      expect(heading).not.toMatch(/\band\u2026$/);
      expect(heading.endsWith('\u2026')).toBe(true);
    });

    it('caps a signal heading that has no clause boundary', () => {
      const long = 'A'.repeat(40) + ' ' + 'B'.repeat(40);
      const { markdown } = publicDossier(`## Evidence\n\n### Signal: ${long} — grade B (x)\n\ntext\n`);
      const heading = /^### (.+)$/m.exec(markdown)![1]!;
      expect(heading.length).toBeLessThanOrEqual(61);
      expect(heading.endsWith('\u2026')).toBe(true);
    });

    it('drops the falsifiability protocol but keeps the mechanism before it', () => {
      const source =
        '## Evidence\n\n**Mechanism:** Serving markdown reduces tokens. FALSIFIABLE TEST: does any vendor say so?\n';
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('Serving markdown reduces tokens.');
      expect(markdown).not.toContain('FALSIFIABLE');
    });

    it('turns a sources run into a list and states a shared date once', () => {
      const source = [
        '## Evidence',
        '',
        'Body.',
        '',
        '**Sources:** [A](https://a.example) (verified 2026-08-20) · [B](https://b.example) (verified 2026-08-20)',
      ].join('\n');
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('**Sources** (all verified 2026-08-20):');
      expect(markdown).toContain('- [A](https://a.example)');
      expect(markdown).toContain('- [B](https://b.example)');
      expect(markdown).not.toContain('\u00b7');
    });

    it('keeps each date when the sources were verified on different days', () => {
      const source =
        '## Evidence\n\nBody.\n\n**Sources:** [A](https://a.example) (verified 2026-08-20) · [B](https://b.example) (verified 2026-08-21)\n';
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('**Sources:**');
      expect(markdown).toContain('[A](https://a.example) (verified 2026-08-20)');
      expect(markdown).toContain('[B](https://b.example) (verified 2026-08-21)');
    });

    it('drops a source listed twice on one line', () => {
      const source =
        '## Evidence\n\nBody.\n\n**Sources:** [A](https://a.example) (verified 2026-08-20) · [A again](https://a.example) (verified 2026-08-20)\n';
      const { markdown } = publicDossier(source);
      expect([...markdown.matchAll(/https:\/\/a\.example/g)]).toHaveLength(1);
    });

    it('puts a bare HTML tag in a code span and leaves one that already is', () => {
      const source = '## Evidence\n\nEmitting <link rel="alternate"> next to `<th scope="col">`.\n';
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('`<link rel="alternate">`');
      expect(markdown).not.toContain('``<th');
    });

    it('turns a bare URL into a labelled link', () => {
      const { markdown } = publicDossier(
        '## Evidence\n\nOpenAI documents it at https://openai.com/searchbot.json (verified 2026-08-21).\n',
      );
      expect(markdown).toContain('[openai.com/searchbot.json](https://openai.com/searchbot.json)');
      // Trailing sentence punctuation stays outside the link.
      expect(markdown).toContain('.json) (verified 2026-08-21).');
    });

    it('shortens a deep path into a readable label', () => {
      const { markdown } = publicDossier(
        '## Evidence\n\nSee https://developers.google.com/search/docs/appearance/ai-features here.\n',
      );
      expect(markdown).toContain('[developers.google.com/\u2026/ai-features](');
    });

    it('leaves a markdown link and a robots user-agent URL alone', () => {
      const source =
        '## Evidence\n\n[Bots](https://developers.openai.com/api/docs/bots) and `GPTBot/1.4; +https://openai.com/gptbot`.\n';
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('[Bots](https://developers.openai.com/api/docs/bots)');
      expect(markdown).not.toContain('[openai.com/gptbot]');
    });

    it('fences a single-quoted attribute so smart quotes cannot reach it', () => {
      const { markdown } = publicDossier(
        "## Evidence\n\nReadability keeps a div carrying role='table' in the tree.\n",
      );
      expect(markdown).toContain("`role='table'`");
    });

    it('leaves an ordinary quoted word unfenced', () => {
      const { markdown } = publicDossier("## Evidence\n\nThe 'menu' is not markup.\n");
      expect(markdown).not.toContain("`'menu'`");
    });

    it('leaves a comparison that is not a tag alone', () => {
      const { markdown } = publicDossier('## Evidence\n\nWhen a < b and 3 > 2.\n');
      expect(markdown).toContain('When a < b and 3 > 2.');
    });

    it('does not compact inside a code fence', () => {
      const source = [
        '## Evidence',
        '',
        '```html',
        '<link rel="alternate">',
        '```',
      ].join('\n');
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('\n<link rel="alternate">\n');
    });
  });

  describe('voice and shape', () => {
    it('breaks a paragraph that has run past 120 words', () => {
      const sentence = 'The vendor documents the behaviour for a named agent and states the consequence. ';
      const { markdown } = publicDossier(`## Evidence\n\n${sentence.repeat(12).trim()}\n`);
      const paragraphs = markdown.split('\n\n').filter((p) => !p.startsWith('#'));
      expect(paragraphs.length).toBeGreaterThan(1);
      for (const paragraph of paragraphs) {
        expect(paragraph.trim().split(/\s+/).length).toBeLessThanOrEqual(120);
      }
    });

    it('leaves a paragraph that is already short alone', () => {
      const source = '## Evidence\n\nGoogle states it plainly. That is the whole case.\n';
      expect(publicDossier(source).markdown).toContain(
        'Google states it plainly. That is the whole case.',
      );
    });

    it('never breaks inside a citation or a quotation', () => {
      const filler = 'The vendor documents this behaviour for one named agent today. ';
      const source = `## Evidence\n\n${filler.repeat(11)}It says "One sentence. And a second." (verified 2026-08-20). ${filler.repeat(4)}\n`;
      const { markdown } = publicDossier(source);
      expect(markdown).toContain('"One sentence. And a second."');
      expect(markdown).toContain('(verified 2026-08-20)');
    });

    it('puts a bare attribute in a code span so smart quotes cannot reach it', () => {
      const { markdown } = publicDossier('## Evidence\n\nEmit rel="alternate" on the link.\n');
      expect(markdown).toContain('`rel="alternate"`');
    });

    it('wraps a whole tag once rather than nesting spans inside it', () => {
      const { markdown } = publicDossier('## Evidence\n\nEmit <link rel="alternate" href="/a.md"> here.\n');
      expect(markdown).toContain('`<link rel="alternate" href="/a.md">`');
      // The nesting bug this guards: the tag wrapped, then its attributes
      // wrapped again inside the span that had just been created.
      expect(markdown).not.toMatch(/`[^`\n]*`[^`\n]*`[^`\n]*`/);
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

    // What compaction is worth, measured on the corpus rather than asserted.
    it('publishes no research scaffolding and no heading too long to be a label', () => {
      let longest = 0;
      for (const id of ids) {
        const { markdown } = publicDossier(read(id));
        expect(markdown, `${id}: falsifiability protocol`).not.toMatch(/FALSIFIABLE\s+(TEST|FORM)/);
        expect(markdown, `${id}: Evidence label`).not.toContain('**Evidence:**');
        expect(markdown, `${id}: sources run-on`).not.toMatch(/^\*\*Sources:\*\*.*·.*·.*·.*·/m);
        // A tag outside a code span renders as a run of escaped angle brackets.
        const outsideCode = markdown.replace(/```[\s\S]*?```|`[^`]*`/g, ' ');
        expect(outsideCode, `${id}: bare tag`).not.toMatch(/<\/?[a-z][a-z0-9]*[ />]/);
        for (const heading of markdown.matchAll(/^### (.+)$/gm)) {
          longest = Math.max(longest, heading[1]!.length);
        }
      }
      // The research names a signal in up to 175 characters. A label is shorter.
      expect(longest).toBeLessThanOrEqual(66);
    });

    // The research wrote to itself: capitals for emphasis and "I verified…" for
    // provenance. Neither belongs on a page addressed to a reader.
    //
    // The word lists are deliberately closed rather than a general "any run of
    // capitals" rule. The corpus is full of legitimate capitals — RFC 2119
    // keywords, audit statuses, enum values, hyphenated identifiers, and a long
    // tail of acronyms — and a rule broad enough to catch shouting catches all
    // of those too. These are the words the research actually shouted.
    const SHOUTED_EMPHASIS =
      /\b(?:SCORE|PREPENDS|WEAKEST|REFUTED|SUPPORTED|UNPROVEN|OPPOSITE|EVERY|ANY|SAME|BUT|AND|OR|WILL|CAN|BY|FAILS|PASSES|REMOVED|NAME|DESKTOP|IS|WAS|ONLY|NEVER|ALWAYS|MORE|LESS|BOTH|EACH|THIS|THAT|THESE)\b/;
    // Counting in capitals — "only TWO … while SIXTY-EIGHT" — is the other half.
    const SHOUTED_NUMBER =
      /\b(?:ZERO|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|FORTY|FIFTY|SIXTY|SEVENTY|EIGHTY|NINETY|HUNDRED|THOUSAND)[A-Z-]*\b/;
    // Likewise closed: `we` and `our` appear constantly inside vendor quotations
    // ("we recommend allowing PerplexityBot"), so only the author's own voice is
    // banned, in the forms the research actually used.
    const FIRST_PERSON =
      /(?:^|[^A-Za-z])I (?:confirmed|verified|fetched|sampled|checked|found|read|ran|tested|searched|could)|\bMy (?:own|probe|measurement|reading)\b|\bin my (?:probe|measurement|testing|reading)\b|\bour (?:fetcher|automated fetcher|probe|measurement)\b/;

    // The record is a working document, so it quotes source at the level the
    // researcher was reading it: pasted statements, array literals, and a
    // "Source-level:" label. A reader of the page wants the behaviour, not the
    // listing. One library symbol per claim survives, because it is what makes
    // the claim checkable — the pasted code around it does not.
    const PASTED_CODE = /\b(?:if|return|const|let|function)\s*\(?[^\n]{0,50}(?:===|=>|\)\s*(?:;|\{))/;
    const ARRAY_LITERAL = /=\s*\[\s*['"][^\]\n]{4,}\]/;
    const SOURCE_LABEL = /\bSource-level\b/;

    it('publishes the behaviour of a library, not its listing', () => {
      for (const id of ids) {
        const { markdown } = publicDossier(read(id));
        expect(markdown, `${id}: pasted code`).not.toMatch(PASTED_CODE);
        expect(markdown, `${id}: array literal`).not.toMatch(ARRAY_LITERAL);
        expect(markdown, `${id}: source-level label`).not.toMatch(SOURCE_LABEL);
      }
    });

    it('publishes no shouting and no first person', () => {
      for (const id of ids) {
        const { markdown } = publicDossier(read(id));
        const prose = markdown.replace(/```[\s\S]*?```|`[^`]*`/g, ' ');
        expect(prose, `${id}: first person`).not.toMatch(FIRST_PERSON);
        expect(prose, `${id}: shouted emphasis`).not.toMatch(SHOUTED_EMPHASIS);
        expect(prose, `${id}: shouted number`).not.toMatch(SHOUTED_NUMBER);
        for (const phrase of ['REAL, NOT INVENTED', 'THE ONLY', 'HONESTY CAVEAT', 'CLAIM UNDER TEST']) {
          expect(prose, `${id}: ${phrase}`).not.toContain(phrase);
        }
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
        // 70 since 2026-08-29: the four `openapi-*` content audits gained one,
        // to publish that an absent OpenAPI document is not a failure.
        'Example failure': 70,
      });
    });
  });
});
