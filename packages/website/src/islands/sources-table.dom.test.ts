// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSourcesTable, previewOf, REGISTRY_URL, type SourceRecord } from './sources-table';

/**
 * The interaction layer, against a fixture that mirrors what
 * `pages/sources.astro` renders: hidden controls, a hidden table shell, a live
 * status line, and an empty `<tbody>` for the fetched rows to land in.
 *
 * jsdom is confined to this file — `filterSources`, `sourceTypes` and
 * `previewOf` are pure and are tested without a DOM in `sources-table.test.ts`.
 */
const LONG =
  'Normative path: `https://{agent-server-domain}/.well-known/agent-card.json`, following RFC 8615. ' +
  'Three discovery mechanisms are defined: Well-Known URI, Curated Registries, and Direct Configuration.';

const SOURCES: SourceRecord[] = [
  {
    id: 'a2a-agent-discovery',
    title: 'A2A Protocol — Agent Discovery',
    url: 'https://a2a-protocol.org/latest/topics/agent-discovery/',
    type: 'spec',
    publisher: 'Linux Foundation / A2A Project',
    verified: true,
    keyFindings: LONG,
  },
  {
    id: 'vercel-ai-crawlers',
    title: 'The rise of the AI crawler',
    url: 'https://vercel.com/blog/the-rise-of-the-ai-crawler',
    type: 'study',
    publisher: 'Vercel',
    verified: false,
    keyFindings: 'GPTBot made 569 million requests in one month.',
  },
];

const fixture = () => `
  <section id="sources-controls" hidden aria-label="Filter sources">
    <label for="source-search">Search sources</label>
    <input id="source-search" type="search" />
    <div role="group" aria-label="Filter by source type">
      <button type="button" data-filter="type" data-value="all" aria-pressed="true">All types</button>
      <button type="button" data-filter="type" data-value="spec" aria-pressed="false">spec</button>
      <button type="button" data-filter="type" data-value="study" aria-pressed="false">study</button>
    </div>
  </section>
  <p id="sources-status" hidden aria-live="polite"></p>
  <div id="sources-table" hidden>
    <div id="sources-scroll" role="region" aria-label="Source registry" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Source</th><th scope="col">Publisher</th><th scope="col">Type</th>
            <th scope="col">Verified</th><th scope="col">Key findings</th>
          </tr>
        </thead>
        <tbody id="sources-rows"></tbody>
      </table>
    </div>
  </div>
  <p id="sources-empty" hidden>No sources match your search.</p>
`;

const rows = () => [...document.querySelectorAll<HTMLElement>('#sources-rows tr')];
const visible = () => rows().filter((row) => !row.hidden).map((row) => row.dataset['sourceId']);
const status = () => document.querySelector('#sources-status')!.textContent;
const pill = (value: string) =>
  document.querySelector<HTMLElement>(`[data-filter="type"][data-value="${value}"]`)!;
const search = () => document.querySelector<HTMLInputElement>('#source-search')!;

const type = (text: string) => {
  search().value = text;
  search().dispatchEvent(new Event('input', { bubbles: true }));
};

/** A `fetch` that answers the registry URL, and nothing else. */
const serve = (body: unknown, ok = true) =>
  vi.fn(async (url: string) => {
    expect(url).toBe(REGISTRY_URL);
    return {
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
    } as Response;
  });

describe('previewOf', () => {
  it('leaves a short finding alone', () => {
    expect(previewOf('Short enough.', 40)).toBe('Short enough.');
  });

  it('cuts a long one at a word boundary and marks the cut', () => {
    const preview = previewOf(LONG, 60);

    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(61);
    expect(LONG.startsWith(preview.slice(0, -1))).toBe(true);
    expect(preview).not.toMatch(/ …$/);
  });
});

describe('mountSourcesTable', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mount = async (body: unknown = { accessed: '2026-08-20', sources: SOURCES }, ok = true) => {
    vi.stubGlobal('fetch', serve(body, ok));
    await mountSourcesTable();
  };

  it('fetches the registry rather than reading it out of the page', async () => {
    const fetcher = serve({ accessed: '2026-08-20', sources: SOURCES });
    vi.stubGlobal('fetch', fetcher);

    expect(document.querySelector('#sources-rows')!.children).toHaveLength(0);
    await mountSourcesTable();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(SOURCES.length);
  });

  it('reveals the table and the controls it has just wired up', async () => {
    await mount();

    expect(document.querySelector<HTMLElement>('#sources-table')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('#sources-controls')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('#sources-status')!.hidden).toBe(false);
  });

  it('announces the count from the live region', async () => {
    await mount();

    expect(status()).toBe('Showing 2 of 2 sources.');
  });

  it('gives each row a row header carrying the title, the link and the id', async () => {
    await mount();

    const head = rows()[0]!.querySelector('th')!;
    expect(head.getAttribute('scope')).toBe('row');
    const link = head.querySelector('a')!;
    expect(link.getAttribute('href')).toBe(SOURCES[0]!.url);
    expect(link.textContent).toBe(SOURCES[0]!.title);
    expect(head.querySelector('code')!.textContent).toBe(SOURCES[0]!.id);
  });

  it('spells out the verified flag rather than printing a raw boolean', async () => {
    await mount();

    const cells = (index: number) => [...rows()[index]!.querySelectorAll('td')].map((c) => c.textContent);
    expect(cells(0)![2]).toBe('Yes');
    expect(cells(1)![2]).toBe('No');
  });

  it('collapses a long finding behind a preview and keeps a short one plain', async () => {
    await mount();

    const long = rows()[0]!.querySelectorAll('td')[3]!;
    const details = long.querySelector('details')!;
    expect(details).not.toBeNull();
    expect(details.querySelector('summary')!.textContent!.endsWith('…')).toBe(true);
    expect(details.querySelector('p')!.textContent).toContain('Direct Configuration');

    const short = rows()[1]!.querySelectorAll('td')[3]!;
    expect(short.querySelector('details')).toBeNull();
    expect(short.textContent).toBe(SOURCES[1]!.keyFindings);
  });

  it('renders a finding’s backtick spans as code, never as markup', async () => {
    await mount({
      accessed: '2026-08-20',
      sources: [{ ...SOURCES[1]!, keyFindings: 'Reads `<script>` at `/llms.txt`.' }],
    });

    const cell = rows()[0]!.querySelectorAll('td')[3]!;
    expect([...cell.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      '<script>',
      '/llms.txt',
    ]);
    // The angle brackets came in as text, so nothing in the registry can inject
    // an element into the page.
    expect(cell.querySelector('script')).toBeNull();
    expect(cell.textContent).toBe('Reads <script> at /llms.txt.');
  });

  it('hides the rows a search does not match, and recounts what is left', async () => {
    await mount();

    type('vercel');
    expect(visible()).toEqual(['vercel-ai-crawlers']);
    expect(status()).toBe('Showing 1 of 2 sources.');
    expect(rows()[0]!.hidden).toBe(true);
  });

  it('searches the key findings, which is where the detail is', async () => {
    await mount();

    type('rfc 8615');
    expect(visible()).toEqual(['a2a-agent-discovery']);
  });

  it('moves the pressed state to the clicked pill and off its siblings', async () => {
    await mount();

    pill('study').click();

    expect(pill('study').getAttribute('aria-pressed')).toBe('true');
    expect(pill('all').getAttribute('aria-pressed')).toBe('false');
    expect(visible()).toEqual(['vercel-ai-crawlers']);
  });

  it('combines the type facet with the search box, and shows the empty state', async () => {
    await mount();
    const empty = () => document.querySelector<HTMLElement>('#sources-empty')!.hidden;
    expect(empty()).toBe(true);

    pill('spec').click();
    type('vercel');

    expect(visible()).toEqual([]);
    expect(status()).toBe('Showing 0 of 2 sources.');
    expect(empty()).toBe(false);
  });

  it('says so, and offers the raw file, when the registry cannot be fetched', async () => {
    await mount({}, false);

    expect(status()).toContain('could not be loaded');
    expect(document.querySelector('#sources-status a')!.getAttribute('href')).toBe(REGISTRY_URL);
    // Nothing half-rendered is left on screen.
    expect(document.querySelector<HTMLElement>('#sources-table')!.hidden).toBe(true);
    expect(rows()).toHaveLength(0);
  });
});
