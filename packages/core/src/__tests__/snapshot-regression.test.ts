import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runAudits } from '../audit-runner';
import { defaultConfig } from '../audit-config';
import { mockCheckContext, mockPageContext, mockFetchResult } from './test-utils';

describe('Snapshot Regression Tests', () => {
  const snapshotDir = path.join(__dirname, '../../test-data/snapshots');

  it('matches baseline results for Labs Homepage', async () => {
    if (!fs.existsSync(path.join(snapshotDir, 'labs-homepage.html'))) {
      return;
    }
    const html = fs.readFileSync(path.join(snapshotDir, 'labs-homepage.html'), 'utf-8');
    const llmsTxt = '# Labs Reference App\n\n> A reference app for testing the UCP scanner.';

    const labsUrl = 'http://localhost:7200';
    const pageCtx = mockPageContext(`${labsUrl}/`, html, 0);
    const ctx = mockCheckContext([pageCtx], {
      '/llms.txt': mockFetchResult(llmsTxt, 200),
      '/robots.txt': mockFetchResult('User-agent: *\nAllow: /', 200),
    });

    const { checks } = await runAudits(ctx, defaultConfig);

    const snapshotIds = new Set(['1.1', '8.1']);
    const resultsToSnapshot = checks
      .filter((c) => snapshotIds.has(c.id))
      .map((c) => ({
        id: c.id,
        status: c.status,
        score: c.score,
        explanation: c.explanation,
      }));

    expect(resultsToSnapshot).toMatchSnapshot();
  });
});
