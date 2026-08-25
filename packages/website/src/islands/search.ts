import { withBase } from '../lib/routes';

/**
 * Site search: the client half of the header's search dialog.
 *
 * Pagefind indexes the built HTML during `pnpm build` (`pagefind --site dist`),
 * so what is searchable is exactly what the pages print — see the
 * `data-pagefind-body` regions in `layouts/Doc.astro` and on the four standalone
 * routes. Nothing here reads the registry, and nothing here is imported by a
 * page's frontmatter: the index is fetched, in pieces, only once a reader opens
 * the dialog.
 *
 * The module imports `withBase` and nothing else. `pagefind.js` is a *generated*
 * asset — it exists in `dist/`, never in `src/` — so it is loaded through a
 * dynamic `import()` of a runtime string, behind the `PagefindLoader` seam that
 * lets the tests drive both the working and the missing index.
 */

/* -------------------------------------------------------------------------- */
/* The keyboard shortcut                                                       */
/* -------------------------------------------------------------------------- */

/** Elements where a bare `/` is a character the reader is typing, not a command. */
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Should this keystroke open the search dialog?
 *
 * `⌘K` / `Ctrl+K` opens from anywhere, including from inside a field — it is
 * unambiguous, and it is the chord readers already expect. A bare `/` opens only
 * when it is not being typed into something: the audit explorer and the source
 * registry both have their own filter boxes, and swallowing a slash there would
 * make a regex or a path impossible to type.
 */
export function searchShortcut(event: KeyboardEvent): boolean {
  if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) return true;
  if (event.key !== '/') return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = event.target as (Element & { isContentEditable?: boolean }) | null;
  if (!target) return true;
  return !TYPING_TAGS.has(target.tagName) && target.isContentEditable !== true;
}

/* -------------------------------------------------------------------------- */
/* The excerpt                                                                 */
/* -------------------------------------------------------------------------- */

/** One run of excerpt text, and whether Pagefind marked it as the match. */
export interface ExcerptSegment {
  text: string;
  mark: boolean;
}

/** The five references Pagefind's escaper can emit, plus the numeric forms. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X';
      const code = Number.parseInt(hex ? name.slice(2) : name.slice(1), hex ? 16 : 10);
      // A reference outside Unicode's range stays literal rather than throwing.
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Split Pagefind's excerpt into plain and marked runs.
 *
 * `result.data().excerpt` is the one thing Pagefind hands back as an HTML
 * string: the matched words come wrapped in `<mark>`. Rather than put that
 * string into an `innerHTML` sink — this file has no such sink, and the rest of
 * the site builds its results from `createElement`/`textContent` — the string is
 * parsed here into segments, every tag is dropped, and the caller rebuilds it
 * from real text nodes and real `<mark>` elements. Pure, so the parsing is
 * tested without a DOM.
 */
export function excerptSegments(html: string): ExcerptSegment[] {
  const segments: ExcerptSegment[] = [];
  const push = (raw: string, mark: boolean) => {
    // Any other tag is dropped, not trusted: only `<mark>` survives, and it
    // survives as an element this module creates, not as parsed markup.
    const text = decodeEntities(raw.replace(/<[^>]*>/g, ''));
    if (text !== '') segments.push({ text, mark });
  };

  let last = 0;
  for (const match of html.matchAll(/<mark>([\s\S]*?)<\/mark>/g)) {
    push(html.slice(last, match.index), false);
    push(match[1] ?? '', true);
    last = match.index + match[0].length;
  }
  push(html.slice(last), false);
  return segments;
}

/* -------------------------------------------------------------------------- */
/* Result addresses                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Where a result lives, as an href this site can follow.
 *
 * Pagefind builds its urls from the paths inside `dist/`, which knows nothing of
 * the base path: `dist/audits/x/y/index.html` is recorded as `/audits/x/y/`.
 * Every link on this site goes through `routes.ts`, and so does this one — the
 * base path stays in one place rather than being repeated as a Pagefind flag.
 */
export function resultHref(url: string): string {
  const base = withBase('');
  return url.startsWith(base) ? url : withBase(url);
}

/* -------------------------------------------------------------------------- */
/* Pagefind's shape                                                            */
/* -------------------------------------------------------------------------- */

/** The fields of a Pagefind fragment this dialog reads. */
interface PagefindFragment {
  url: string;
  excerpt: string;
  meta?: Record<string, string | undefined>;
  filters?: Record<string, string[] | undefined>;
}

interface PagefindHit {
  data: () => Promise<PagefindFragment>;
}

/** The generated module's surface, as much of it as is used here. */
export interface PagefindApi {
  search: (term: string) => Promise<{ results: PagefindHit[] }>;
  init?: () => Promise<void>;
}

/** How the dialog gets hold of Pagefind. Swapped out under test. */
export type PagefindLoader = () => Promise<PagefindApi>;

/** Where the build puts the generated bundle, under the site's base path. */
export const PAGEFIND_URL = withBase('pagefind/pagefind.js');

/**
 * The real loader: one dynamic import, on first open.
 *
 * `pagefind.js` is written by the Pagefind step of `pnpm build`, after Astro has
 * emitted the HTML it indexes, so it cannot be resolved at build time — hence
 * the `@vite-ignore`, which tells Vite to leave the specifier alone instead of
 * trying to bundle a file that does not exist yet, and the single narrow cast,
 * which is confined to this function rather than smeared across the module.
 */
const loadPagefind: PagefindLoader = async () => {
  const module = (await import(/* @vite-ignore */ PAGEFIND_URL)) as unknown as PagefindApi;
  await module.init?.();
  return module;
};

/* -------------------------------------------------------------------------- */
/* The dialog                                                                  */
/* -------------------------------------------------------------------------- */

/** How many results the dialog lists. Pagefind ranks; the tail is noise. */
const RESULT_LIMIT = 10;

/** Build one result: a link with its title, its category, and its excerpt. */
function resultItem(fragment: PagefindFragment): HTMLLIElement {
  const item = document.createElement('li');

  const link = document.createElement('a');
  link.href = resultHref(fragment.url);
  link.className =
    'block rounded-lg border border-transparent px-3 py-2.5 hover:border-brand/50 hover:bg-surface-raised focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand';

  const title = document.createElement('span');
  title.className = 'block text-sm font-semibold text-white';
  // `meta.title` is the first heading inside the page's indexed region; a page
  // that somehow reached the index without one falls back to its address.
  title.textContent = fragment.meta?.['title'] ?? fragment.url;
  link.append(title);

  // The category filter is set on the dossier's own badge strip, so it is only
  // ever present on the 215 dossiers — which are exactly the results a reader
  // needs help telling apart.
  const category = fragment.filters?.['category']?.[0];
  if (category) {
    const tag = document.createElement('span');
    tag.className = 'mt-0.5 block text-xs text-slate-400';
    tag.textContent = category;
    link.append(tag);
  }

  const excerpt = document.createElement('p');
  excerpt.className = 'mt-1 text-xs leading-relaxed text-slate-300';
  for (const segment of excerptSegments(fragment.excerpt)) {
    if (!segment.mark) {
      excerpt.append(document.createTextNode(segment.text));
      continue;
    }
    const mark = document.createElement('mark');
    mark.className = 'bg-brand/30 text-white';
    mark.textContent = segment.text;
    excerpt.append(mark);
  }
  link.append(excerpt);

  item.append(link);
  return item;
}

/**
 * Bind the search dialog to the page. The only DOM-touching export.
 *
 * `load` is the seam the tests use; in the browser it is the dynamic import
 * above. Resolves once the dialog is wired, which is before any searching
 * happens — the index is fetched on first open, not on page load.
 */
export function mountSearch(load: PagefindLoader = loadPagefind): void {
  const trigger = document.querySelector<HTMLButtonElement>('#search-trigger');
  const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
  const input = document.querySelector<HTMLInputElement>('#search-input');
  const status = document.querySelector<HTMLElement>('#search-status');
  const list = document.querySelector<HTMLElement>('#search-results');
  if (!trigger || !dialog || !input || !status || !list) return;

  // `<dialog>` is doing the work here — the modal backdrop, Escape, and keeping
  // Tab inside the dialog are all its behaviour, not this module's. A browser
  // without it would get a button that throws, so the button simply stays
  // hidden there, the way the audit explorer's controls stay hidden without
  // JavaScript: the site is entirely navigable without search.
  if (typeof dialog.showModal !== 'function') return;

  let pagefind: Promise<PagefindApi> | undefined;
  /** The most recent query, so a slow response cannot overwrite a newer one. */
  let latest = 0;
  let opener: HTMLElement | null = null;

  const fail = () => {
    list.replaceChildren();
    status.textContent =
      'Search is unavailable — its index did not load. Every audit is still listed on the audits page:';
    const link = document.createElement('a');
    link.href = withBase('audits/');
    link.className = 'ml-1 underline hover:text-white';
    link.textContent = withBase('audits/');
    status.append(link);
  };

  const run = async (term: string) => {
    const token = ++latest;
    if (term.trim() === '') {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    // Reuses the promise, rejection included: once the index has failed to
    // load, every keystroke says so again rather than silently listing nothing.
    pagefind ??= load();
    let fragments: PagefindFragment[];
    try {
      const response = await (await pagefind).search(term);
      fragments = await Promise.all(response.results.slice(0, RESULT_LIMIT).map((hit) => hit.data()));
    } catch {
      if (token === latest) fail();
      return;
    }
    if (token !== latest) return;

    list.replaceChildren(...fragments.map(resultItem));
    status.textContent =
      fragments.length === 0
        ? `No results for “${term}”.`
        : `${fragments.length} result${fragments.length === 1 ? '' : 's'} for “${term}”.`;
  };

  const open = () => {
    if (dialog.open) return;
    // Where focus goes back to on close. The trigger is the answer whenever the
    // dialog was opened from it, and whenever the shortcut was pressed with
    // nothing focused; a reader who pressed `/` while tabbing through a dossier
    // instead lands back on the link they left, which is what the browser would
    // have done for the dialog anyway and is why the header is `sticky` — the
    // trigger is on screen either way, so nothing is gained by dragging focus
    // back up to it.
    const active = document.activeElement;
    opener = active instanceof HTMLElement && active !== document.body ? active : trigger;
    // Shown *before* the index is asked for, so the status line — a live region
    // that ships empty and visible — is already in the accessibility tree by the
    // time a failure or a result count is written into it. A closed `<dialog>`
    // is `display: none`, and so is out of that tree entirely.
    dialog.showModal();
    input.select();
    input.focus();
    // Kicked off on open rather than on the first keystroke: a reader who opens
    // the dialog against a missing index learns that immediately.
    pagefind ??= load();
    void (async () => {
      try {
        await pagefind;
      } catch {
        if (dialog.open) fail();
      }
    })();
  };

  trigger.addEventListener('click', open);

  dialog.addEventListener('close', () => {
    // Returning focus is the browser's job too, but only for the element that
    // was focused when `showModal()` ran; doing it here as well keeps the
    // promise the header makes — you land back on the button you left from.
    opener?.focus();
    opener = null;
  });

  // Clicking the backdrop closes the dialog: the click lands on the dialog
  // element itself, never on the panel inside it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  input.addEventListener('input', () => void run(input.value));

  document.addEventListener('keydown', (event) => {
    if (dialog.open || !searchShortcut(event)) return;
    // Only now: the shortcut is a command, so the `/` must not also be typed.
    event.preventDefault();
    open();
  });

  // Revealed only once it is wired up, the way `/audits/` and `/sources/` do it.
  trigger.hidden = false;
}
