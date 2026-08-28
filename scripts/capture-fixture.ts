import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createFetcher } from '../packages/core/src/fetcher';
import { classifyCapture } from '../packages/core/src/tests/fixture-io';
import type { FixtureProvenance } from '../packages/core/src/tests/fixture-io';

/**
 * Freeze one real page as a test fixture.
 *
 * The fetch goes through the scanner's own fetcher, so the fixture is the
 * bytes an audit would have seen — same user-agent, same redirect handling.
 * It runs once, by hand: fixtures are never re-fetched, which is what keeps
 * the corpus suite offline and deterministic.
 *
 * This file does flags and IO only. What the response turned out to be is
 * decided by `classifyCapture`, which the suite can re-run against the stored
 * bytes; a rule that lived here could not be checked after the fact.
 */

const OUT_DIR = path.resolve(__dirname, '../packages/core/test-data/corpus/real');
const MIN_BODY_BYTES = 200;

const args = process.argv.slice(2);
const rawUrl = args.find((a) => !a.startsWith('-'));
if (!rawUrl) {
  console.error('usage: npx tsx scripts/capture-fixture.ts <url> [--name=<name>] [--allow-small]');
  process.exit(1);
}

const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
const allowSmall = args.includes('--allow-small');
const nameFlag = args.find((a) => a.startsWith('--name='));
const name =
  nameFlag?.slice('--name='.length) ??
  new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');

async function main(): Promise<void> {
  const result = await createFetcher().fetch({ url });
  const kind = classifyCapture(result);

  // A wall or a shell is a legitimate fixture — this repo's subject is what an
  // agent actually receives — but it has to be asked for. Captured by
  // accident, under a name that promises an article, it is a fixture nobody
  // can interpret. `--allow-small` is the operator saying "yes, a non-page".
  if (kind !== 'page' && !allowSmall) {
    console.error(
      `${url} answered HTTP ${result.status} and reads as a ${kind}, not a page — ` +
        'pass --allow-small to keep it',
    );
    process.exit(1);
  }

  if (result.body.length < MIN_BODY_BYTES && !allowSmall) {
    console.error(`${url} returned ${result.body.length} bytes — pass --allow-small to keep it`);
    process.exit(1);
  }

  const gz = gzipSync(Buffer.from(result.body, 'utf8'), { level: 9 });
  const provenance: FixtureProvenance = {
    url: result.finalUrl || url,
    capturedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(result.body).digest('hex'),
    status: result.status,
    kind,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.html.gz`), gz);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), `${JSON.stringify(provenance, null, 2)}\n`);

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `${name}: HTTP ${result.status}, ${kind}, ${kb(result.body.length)} raw, ` +
      `${kb(gz.length)} gzipped`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
