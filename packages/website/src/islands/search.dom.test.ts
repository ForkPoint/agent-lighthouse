// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountSearch, type PagefindApi } from './search';

/**
 * The interaction layer, against a fixture that mirrors `SearchDialog.astro`:
 * a hidden trigger, a native `<dialog>`, an input, a live status line and an
 * empty results list.
 *
 * jsdom is confined to this file — `searchShortcut`, `excerptSegments` and
 * `resultHref` are pure and are tested without a DOM in `search.test.ts`.
 *
 * jsdom (29.1.1 here) parses `<dialog>` but implements none of its behaviour:
 * no `showModal`, no `close`, no `open`. The island calls the real API and
 * refuses to reveal its trigger where that API is missing, so the smallest
 * possible stand-in is installed here rather than a fallback being carried in
 * shipped code for the sake of a test. What it cannot stand in for — the modal
 * focus trap, the backdrop, Escape — is the browser's, and is exactly why this
 * is a `<dialog>` and not a div.
 */
function polyfillDialog(dialog: HTMLDialogElement): void {
  Object.defineProperty(dialog, 'open', {
    configurable: true,
    get: () => dialog.hasAttribute('open'),
  });
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => {
    if (!dialog.hasAttribute('open')) return;
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  };
}

const fixture = () => `
  <button id="search-trigger" type="button" hidden aria-haspopup="dialog">Search</button>
  <dialog id="search-dialog" aria-label="Search this site">
    <label for="search-input">Search 215 dossiers</label>
    <input id="search-input" type="search" />
    <p id="search-status" aria-live="polite"></p>
    <ul id="search-results"></ul>
    <form method="dialog"><button type="submit">Close</button></form>
  </dialog>
  <input id="elsewhere" type="search" />
`;

const trigger = () => document.querySelector<HTMLButtonElement>('#search-trigger')!;
const dialog = () => document.querySelector<HTMLDialogElement>('#search-dialog')!;
const input = () => document.querySelector<HTMLInputElement>('#search-input')!;
const status = () => document.querySelector<HTMLElement>('#search-status')!;
const results = () => [...document.querySelectorAll<HTMLAnchorElement>('#search-results a')];

/** One Pagefind hit, in the shape `result.data()` resolves to. */
const hit = (url: string, title: string, excerpt: string, category?: string) => ({
  data: async () => ({
    url,
    excerpt,
    meta: { title },
    ...(category ? { filters: { category: [category] } } : {}),
  }),
});

const HITS = [
  hit(
    '/audits/access-crawl-control/llms-txt/',
    'LLMs Txt',
    'the <mark>llms.txt</mark> proposal',
    'Access & Crawl Control',
  ),
  hit('/docs/quickstart/', 'Quickstart', 'run <mark>llms.txt</mark> checks'),
];

/** A loader that answers every query with `hits`, and records what was asked. */
const loaderFor = (hits: unknown[] = HITS) => {
  const search = vi.fn(async () => ({ results: hits as never }));
  return { load: async () => ({ search }) as PagefindApi, search };
};

/** Type into the dialog's box and let the search settle. */
const type = async (text: string) => {
  input().value = text;
  input().dispatchEvent(new Event('input', { bubbles: true }));
  await vi.waitFor(() => expect(status().textContent).not.toBe(''));
};

const press = (key: string, over: Partial<KeyboardEventInit> & { on?: Element } = {}) => {
  const { on, ...init } = over;
  (on ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
};

describe('mountSearch', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture();
    polyfillDialog(dialog());
  });

  it('reveals the trigger it has just wired up', () => {
    expect(trigger().hidden).toBe(true);
    mountSearch(loaderFor().load);

    expect(trigger().hidden).toBe(false);
  });

  it('leaves the trigger hidden where the browser has no dialog to open', () => {
    // The fixture is rebuilt without the stand-in, which is what an engine
    // predating `<dialog>` looks like. A button that throws is worse than none,
    // and every page the dialog searches is reachable without it.
    document.body.innerHTML = fixture();
    mountSearch(loaderFor().load);

    expect(trigger().hidden).toBe(true);
  });

  it('opens from the button and puts focus in the box', () => {
    mountSearch(loaderFor().load);
    trigger().click();

    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it('opens on the shortcuts, and not on a slash being typed', () => {
    mountSearch(loaderFor().load);

    press('/', { on: document.querySelector('#elsewhere')! });
    expect(dialog().open).toBe(false);

    press('/');
    expect(dialog().open).toBe(true);

    dialog().close();
    press('k', { metaKey: true });
    expect(dialog().open).toBe(true);
  });

  it('gives focus back to the trigger when it closes', () => {
    mountSearch(loaderFor().load);
    trigger().click();
    dialog().close();

    expect(document.activeElement).toBe(trigger());
  });

  it('gives focus back to whatever the shortcut interrupted, when that is not the page', () => {
    // What the browser does for a modal `<dialog>` of its own accord, kept
    // rather than overridden: a reader who pressed `/` mid-page resumes there.
    mountSearch(loaderFor().load);
    const elsewhere = document.querySelector<HTMLInputElement>('#elsewhere')!;
    elsewhere.focus();

    press('k', { metaKey: true, on: elsewhere });
    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(input());

    dialog().close();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('asks Pagefind only once the dialog is open', async () => {
    const { load, search } = loaderFor();
    const loading = vi.fn(load);
    mountSearch(loading);

    expect(loading).not.toHaveBeenCalled();

    trigger().click();
    await vi.waitFor(() => expect(loading).toHaveBeenCalledTimes(1));
    expect(search).not.toHaveBeenCalled();

    await type('llms');
    expect(search).toHaveBeenCalledWith('llms');
    // The module is loaded once, however much is typed after it.
    await type('llms.txt');
    expect(loading).toHaveBeenCalledTimes(1);
  });

  it('lists the results as links, with their category', async () => {
    mountSearch(loaderFor().load);
    trigger().click();
    await type('llms');

    expect(results().map((link) => link.getAttribute('href'))).toEqual([
      '/agent-lighthouse/audits/access-crawl-control/llms-txt/',
      '/agent-lighthouse/docs/quickstart/',
    ]);
    expect(results()[0]!.textContent).toContain('LLMs Txt');
    expect(results()[0]!.textContent).toContain('Access & Crawl Control');
  });

  it('rebuilds the excerpt out of nodes, never out of the markup it was given', async () => {
    mountSearch(
      loaderFor([
        hit('/audits/x/y/', 'Hostile', 'before <img src=x onerror="boom()"> <mark>match</mark> after'),
      ]).load,
    );
    trigger().click();
    await type('match');

    const excerpt = results()[0]!.querySelector('p')!;
    expect(excerpt.querySelector('mark')!.textContent).toBe('match');
    // The excerpt is the one HTML string Pagefind hands back. Its tags are
    // dropped rather than parsed: no element from it reaches the document.
    expect(excerpt.querySelector('img')).toBeNull();
    expect(excerpt.textContent).toBe('before  match after');
  });

  it('announces the count, and says plainly when there is nothing', async () => {
    mountSearch(loaderFor().load);
    trigger().click();

    // The live region is in the accessibility tree from the moment the dialog
    // is: it is never `hidden`, and it is empty until there is something to say.
    expect(status().hasAttribute('hidden')).toBe(false);
    expect(status().textContent).toBe('');

    await type('llms');
    expect(status().textContent).toBe('2 results for “llms”.');
  });

  it('says there is nothing rather than leaving a blank list', async () => {
    mountSearch(loaderFor([]).load);
    trigger().click();
    await type('nothing');

    expect(status().textContent).toBe('No results for “nothing”.');
    expect(results()).toHaveLength(0);
  });

  it('clears itself when the box is emptied', async () => {
    mountSearch(loaderFor().load);
    trigger().click();
    await type('llms');

    input().value = '';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(status().textContent).toBe(''));
    expect(results()).toHaveLength(0);
  });

  it('never lets a slower earlier query overwrite a newer one', async () => {
    // "llms" resolves after "robots" does, which is the ordinary case on a slow
    // connection: the reader must be left looking at what they last typed.
    const search = vi.fn(async (term: string) => {
      if (term === 'llms') await new Promise((resolve) => setTimeout(resolve, 30));
      return { results: [hit(`/audits/x/${term}/`, term, term)] as never };
    });
    mountSearch(async () => ({ search }) as PagefindApi);
    trigger().click();

    input().value = 'llms';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    input().value = 'robots';
    input().dispatchEvent(new Event('input', { bubbles: true }));

    await vi.waitFor(() => expect(status().textContent).toBe('1 result for “robots”.'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(status().textContent).toBe('1 result for “robots”.');
    expect(results()).toHaveLength(1);
    expect(results()[0]!.getAttribute('href')).toBe('/agent-lighthouse/audits/x/robots/');
  });

  it('says so when the index is not there, rather than listing nothing', async () => {
    // The failure this site has twice been corrected for: an empty list that
    // looks like "no results" when it means "search is broken".
    mountSearch(async () => {
      throw new Error('404');
    });
    trigger().click();

    await vi.waitFor(() => expect(status().textContent).toContain('Search is unavailable'));
    expect(status().querySelector('a')!.getAttribute('href')).toBe('/agent-lighthouse/audits/');

    // And it keeps saying so, instead of going quiet once something is typed.
    await type('llms');
    expect(status().textContent).toContain('Search is unavailable');
    expect(results()).toHaveLength(0);
  });
});
