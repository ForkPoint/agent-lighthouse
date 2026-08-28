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
 * decided by `classifyCapture`, which the suite re-runs against the stored
 * response; a rule that lived here could not be checked after the fact.
 */

const OUT_DIR = path.resolve(__dirname, '../packages/core/test-data/corpus/real');
const MIN_BODY_BYTES = 200;

const USAGE =
  'usage: npx tsx scripts/capture-fixture.ts <url> ' +
  '[--name=<name>] [--allow-non-page] [--allow-small] [--force]';

const args = process.argv.slice(2);
const rawUrl = args.find((a) => !a.startsWith('-'));
if (!rawUrl) {
  console.error(USAGE);
  process.exit(1);
}

const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
const allowNonPage = args.includes('--allow-non-page');
const allowSmall = args.includes('--allow-small');
const force = args.includes('--force');
const nameFlag = args.find((a) => a.startsWith('--name='));

/**
 * Host plus path: two pages of one site are two fixtures, and a name built
 * from the host alone would silently overwrite the first with the second.
 */
function defaultName(target: string): string {
  const parsed = new URL(target);
  const host = parsed.hostname.replace(/^www\./, '').replace(/\./g, '-');
  const slug = parsed.pathname
    .replace(/\/+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return slug ? `${host}--${slug}` : host;
}

const name = nameFlag?.slice('--name='.length) ?? defaultName(url);

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const htmlPath = path.join(OUT_DIR, `${name}.html.gz`);
  if (fs.existsSync(htmlPath) && !force) {
    refuse(`${name} already exists — pass --force to replace it, or --name= to capture it apart`);
  }

  const result = await createFetcher().fetch({ url });

  // A transport failure is not a response. The fetcher reports a timeout or a
  // DNS failure as status 0 with an empty body, which `classifyCapture` reads
  // as a wall — freezing one would put a fixture in the corpus that is
  // indistinguishable from a real refusal and that no audit can learn from.
  // No flag opens this: the operator cannot consent to evidence nobody has.
  if (result.error || result.status === 0) {
    refuse(`${url} never answered (${result.error ?? 'status 0'}) — nothing to capture`);
  }

  const kind = classifyCapture(result);

  // A wall or a shell is a legitimate fixture — this repo's subject is what an
  // agent actually receives — but it has to be asked for. Captured by
  // accident, under a name that promises an article, it is a fixture nobody
  // can interpret. The two gates stay separate: "I meant a non-page" and "I
  // meant something this small" are different claims, and one flag covering
  // both let a 0-byte file through on the strength of the other.
  if (kind !== 'page' && !allowNonPage) {
    refuse(
      `${url} answered HTTP ${result.status} and reads as a ${kind}, not a page — ` +
        'pass --allow-non-page to keep it',
    );
  }

  if (result.body.length < MIN_BODY_BYTES && !allowSmall) {
    refuse(`${url} returned ${result.body.length} bytes — pass --allow-small to keep it`);
  }

  const gz = gzipSync(Buffer.from(result.body, 'utf8'), { level: 9 });
  const provenance: FixtureProvenance = {
    url: result.finalUrl || url,
    capturedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(result.body).digest('hex'),
    status: result.status,
    kind,
    headers: result.headers,
    contentType: result.contentType,
    ...(result.redirectChain ? { redirectChain: result.redirectChain } : {}),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(htmlPath, gz);
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
