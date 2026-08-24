import { describe, it, expect } from 'vitest';
import type { CategoryResult, CheckResult, ScanReport } from '@forkpoint/agent-lighthouse-core';
import { generateHtmlReport } from './html-generator';

// ── Fixtures ────────────────────────────────────────────────────

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'c',
    category: 'agent-interfaces',
    title: 'title',
    description: 'desc',
    status: 'pass',
    score: 1,
    scoreDisplayMode: 'binary',
    priority: 'medium',
    impact: '',
    fix: '',
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  const checks = over.checks ?? [];
  return {
    name: over.id,
    weight: 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    ...over,
    checks,
  };
}

function report(categories: CategoryResult[], over: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: 's1',
    url: 'https://x.test/',
    domain: 'x.test',
    overallScore: 42,
    scoreTier: 'needs-work',
    categories,
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: 'https://x.test/', pageType: 'homepage' }],
    scannedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1234,
    ...over,
  };
}

const NOT_A_FACTOR_LINK =
  'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/NOT-A-FACTOR.md#accessibilityskip-nav';

// ── Tests ───────────────────────────────────────────────────────

describe('generateHtmlReport', () => {
  it('renders the deprecation notice and badge for a sunset audit', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({
              id: 'accessibility-skip-nav',
              status: 'fail',
              deprecated: {
                notice: 'No consumer reads this signal.',
                link: NOT_A_FACTOR_LINK,
              },
            }),
          ],
        }),
      ]),
    );

    expect(html).toContain('Deprecated — no longer a factor');
    expect(html).toContain('docs/evidence/sunset/NOT-A-FACTOR.md#accessibilityskip-nav');
    expect(html).toContain('No consumer reads this signal.');
  });

  // Final-review finding I2: the ai-bot-directives per-bot table lives entirely
  // in `found`, so the report must keep its newlines and must render
  // `details.found`.
  it('preserves newlines in a multi-line found value and renders details.found', () => {
    const table = 'GPTBot: allowed\nClaudeBot: allowed\nPerplexityBot: blocked';
    const html = generateHtmlReport(
      report([
        cat({
          id: 'access-crawl-control',
          checks: [
            check({
              id: 'access-crawl-control/ai-bot-directives',
              status: 'warn',
              displayValue: table,
              details: { found: table },
            }),
          ],
        }),
      ]),
    );

    // The summary line keeps the newlines instead of collapsing the table.
    expect(html).toMatch(/class="[^"]*whitespace-pre-line[^"]*"[^>]*>GPTBot: allowed\nClaudeBot/);
    // details.found equals displayValue here, so the evidence block is
    // suppressed — the table renders exactly once, not duplicated.
    expect(html).not.toContain('What we found:');
    expect(
      html.match(/whitespace-pre-line[^>]*>GPTBot: allowed\nClaudeBot: allowed\nPerplexityBot: blocked/g),
    ).toHaveLength(1);
  });

  it('renders details.found as its own block when it differs from displayValue', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'access-crawl-control',
          checks: [
            check({
              id: 'access-crawl-control/ai-bot-directives',
              status: 'warn',
              displayValue: '1 of 2 documented AI bots allowed',
              details: { found: 'GPTBot: allowed\nClaudeBot: blocked' },
            }),
          ],
        }),
      ]),
    );

    expect(html).toContain('What we found:');
    expect(html).toMatch(/whitespace-pre-line[^>]*>GPTBot: allowed\nClaudeBot: blocked/);
  });

  it('omits the deprecation block for a check without a notice', () => {
    const html = generateHtmlReport(
      report([cat({ id: 'agent-interfaces', checks: [check({ id: 'live', status: 'pass' })] })]),
    );

    expect(html).not.toContain('Deprecated — no longer a factor');
    expect(html).not.toContain('NOT-A-FACTOR.md');
  });
});

describe('tier badges', () => {
  it('badges an advisory check and leaves a scored one unbadged', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({
              id: 'structured-data/claimreview-advisory',
              title: 'Advisory check',
              tier: 'informative',
              scoreDisplayMode: 'informative',
              status: 'fail',
              score: 0,
            }),
            check({ id: 'agent-interfaces/scored', title: 'Scored check', tier: 'scored' }),
          ],
        }),
      ]),
    );
    expect(html).toContain('Advisory — not scored');
    expect(html.match(/Advisory — not scored/g)).toHaveLength(1);
    expect(html).toContain('1 Advisory');
  });

  it('badges an experimental check with its own label', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [check({ title: 'Trial check', tier: 'experimental' })],
        }),
      ]),
    );
    expect(html).toContain('Experimental — not scored');
  });
});

describe('evidence link', () => {
  it('links a check at its published evidence dossier', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({
              details: {
                evidenceUrl:
                  'https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-endpoint/',
              },
            }),
          ],
        }),
      ]),
    );
    expect(html).toContain(
      '<a href="https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-endpoint/"',
    );
    expect(html).toContain('Why this audit exists — the evidence');
  });

  it('escapes an evidence URL rather than letting it close the attribute', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [check({ details: { evidenceUrl: 'https://x.test/"><script>alert(1)</script>' } })],
        }),
      ]),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('renders no evidence link when the check carries no evidence URL', () => {
    const html = generateHtmlReport(
      report([cat({ id: 'agent-interfaces', checks: [check()] })]),
    );
    expect(html).not.toContain('Why this audit exists');
  });
});
