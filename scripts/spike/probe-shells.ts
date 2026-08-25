/**
 * Spike step 1: find real client-rendered sites, by measurement not by hunch.
 *
 * Fetches each candidate once with the scanner's own fetcher and reports the
 * signals the proposed `rendered-body` heuristic would read. Nothing here
 * decides anything; it produces the corpus the spike then scans.
 */
import { createFetcher, parseHtml, getWordCount, getMainContentText } from '../../packages/core/src/index';

const CANDIDATES = [
  // suspected client-rendered
  'https://excalidraw.com',
  'https://www.tldraw.com',
  'https://photopea.com',
  'https://squoosh.app',
  'https://regex101.com',
  'https://jsonformatter.org',
  'https://bundlephobia.com',
  'https://open.spotify.com',
  'https://web.telegram.org',
  'https://codesandbox.io',
  'https://app.diagrams.net',
  'https://www.tradingview.com',
  'https://mail.proton.me',
  'https://app.slack.com',
  'https://music.youtube.com',
  // suspected server-rendered controls
  'https://developer.mozilla.org',
  'https://news.ycombinator.com',
  'https://en.wikipedia.org',
  'https://allbirds.com',
  'https://www.gov.uk',
];

interface Probe {
  url: string;
  status: number;
  contentType: string;
  words: number;
  chars: number;
  lowText: boolean;
  emptyRoot: boolean;
  noscriptJs: boolean;
  scriptTextRatio: number;
  wouldGate: boolean;
  error?: string;
}

const ROOT_SELECTORS = ['#root', '#__next', '#app', '#___gatsby', '[data-reactroot]', '#svelte'];

async function probe(url: string): Promise<Probe> {
  const fetcher = createFetcher();
  const base: Probe = {
    url,
    status: 0,
    contentType: '',
    words: 0,
    chars: 0,
    lowText: false,
    emptyRoot: false,
    noscriptJs: false,
    scriptTextRatio: 0,
    wouldGate: false,
  };
  try {
    const res = await fetcher.fetch({ url });
    base.status = res.status;
    base.contentType = res.contentType;
    if (res.status !== 200 || !res.body) return base;
    const $ = parseHtml(res.body);
    const words = getWordCount($);
    const text = getMainContentText($);
    const chars = text.length;

    let emptyRoot = false;
    for (const sel of ROOT_SELECTORS) {
      const node = $(sel).first();
      if (node.length && node.text().trim().length === 0) emptyRoot = true;
    }

    const noscriptText = $('noscript').text();
    const noscriptJs = /enable\s+(javascript|js)|requires\s+javascript|doesn't work properly without javascript/i.test(
      noscriptText,
    );

    let scriptBytes = 0;
    $('script').each((_, el) => {
      scriptBytes += ($(el).html() ?? '').length;
    });
    const scriptTextRatio = chars > 0 ? scriptBytes / chars : scriptBytes > 0 ? Infinity : 0;

    const lowText = words <= 50 && chars <= 200;
    base.words = words;
    base.chars = chars;
    base.lowText = lowText;
    base.emptyRoot = emptyRoot;
    base.noscriptJs = noscriptJs;
    base.scriptTextRatio = Math.round(scriptTextRatio * 10) / 10;
    base.wouldGate = lowText && (emptyRoot || noscriptJs || scriptTextRatio > 50);
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
  }
  return base;
}

async function main() {
  const rows: Probe[] = [];
  for (const url of CANDIDATES) {
    const p = await probe(url);
    rows.push(p);
    const flag = p.wouldGate ? 'GATE ' : p.lowText ? 'thin ' : '     ';
    console.log(
      `${flag}${p.url.padEnd(34)} ${String(p.status).padStart(3)} words=${String(p.words).padStart(5)} chars=${String(p.chars).padStart(6)} root=${p.emptyRoot ? 'Y' : 'n'} nos=${p.noscriptJs ? 'Y' : 'n'} ratio=${p.scriptTextRatio}${p.error ? ' err=' + p.error : ''}`,
    );
    await new Promise((r) => setTimeout(r, 500));
  }
  const out = process.argv[2] ?? 'probe-shells.json';
  const fs = await import('node:fs');
  fs.writeFileSync(out, JSON.stringify(rows, null, 2));
  console.log(`\n${rows.filter((r) => r.wouldGate).length} of ${rows.length} would gate`);
  console.log(`written: ${out}`);
}

void main();
