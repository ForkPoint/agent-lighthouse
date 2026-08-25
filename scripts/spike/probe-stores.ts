/**
 * Spike step 4: false-positive rate of the shell rule on real storefronts.
 *
 * The 43 stores from the benchmark that answered cleanly. Any of these the rule
 * calls a shell is a false positive, and every false positive silences ~143
 * audits on a site that served real content.
 */
import * as fs from 'node:fs';
import { createFetcher, parseHtml, getWordCount, getMainContentText } from '../../packages/core/src/index';

const stores: string[] = JSON.parse(fs.readFileSync(`${__dirname}/stores-ok.json`, 'utf8'));

async function main() {
  const fetcher = createFetcher();
  const rows: Array<{ url: string; status: number; words: number; chars: number; simple: boolean; strict: boolean }> = [];
  for (const raw of stores) {
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    try {
      const res = await fetcher.fetch({ url });
      if (res.status !== 200 || !res.body) {
        console.log(`skip ${url} status=${res.status}`);
        rows.push({ url, status: res.status, words: -1, chars: -1, simple: false, strict: false });
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const $ = parseHtml(res.body);
      const words = getWordCount($);
      const chars = getMainContentText($).length;
      const simple = words <= 50 && chars <= 200;
      let emptyRoot = false;
      for (const sel of ['#root', '#__next', '#app', '#___gatsby', '[data-reactroot]']) {
        const n = $(sel).first();
        if (n.length && n.text().trim().length === 0) emptyRoot = true;
      }
      const nos = /enable\s+(javascript|js)|requires\s+javascript/i.test($('noscript').text());
      let sb = 0;
      $('script').each((_, el) => { sb += ($(el).html() ?? '').length; });
      const ratio = chars > 0 ? sb / chars : Infinity;
      const strict = simple && (emptyRoot || nos || ratio > 50);
      rows.push({ url, status: res.status, words, chars, simple, strict });
      if (simple) console.log(`FLAG ${url} words=${words} chars=${chars} strict=${strict}`);
    } catch (e) {
      console.log(`err ${url} ${e instanceof Error ? e.message : e}`);
      rows.push({ url, status: 0, words: -1, chars: -1, simple: false, strict: false });
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const scanned = rows.filter((r) => r.words >= 0);
  console.log(`\nscanned ${scanned.length} of ${rows.length}`);
  console.log(`simple rule flags: ${scanned.filter((r) => r.simple).length}`);
  console.log(`strict rule flags: ${scanned.filter((r) => r.strict).length}`);
  fs.writeFileSync(`${__dirname}/probe-stores.json`, JSON.stringify(rows, null, 2));
}
void main();
