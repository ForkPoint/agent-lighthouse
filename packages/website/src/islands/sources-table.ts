import { withBase } from '../lib/routes';

/**
 * The sources browser's client half.
 *
 * The registry is 465 KB of prose — 647 entries, each with its key findings —
 * so the page does not carry it. It ships the table's shell and its facets, and
 * this module fetches `sources.json` (the same document the repository keeps,
 * served verbatim) and builds the rows. Inlining it would repeat Task 5's
 * mistake at four times the size.
 *
 * It imports nothing but `withBase`, which is a string helper: no core, no
 * registry, nothing that reads the filesystem.
 */

/** One entry of `docs/evidence/sources.json`, exactly as the file holds it. */
export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  /** The registry's own facet field: `spec`, `vendor-doc`, `study`, … */
  type: string;
  publisher: string;
  /** Whether the URL resolved during the research pass. */
  /**
   * The date the URL was last resolved, `YYYY-MM-DD`.
   *
   * Was a boolean, and every one of the 715 records was `true` — a column of
   * 715 identical "Yes" cells. The date is what a reader of an evidence-first
   * site actually wants to know.
   */
  verified: string;
  keyFindings: string;
  /** A handful of entries date themselves; the file dates the rest. */
  accessed?: string;
}

/** The registry document: one access date, and the sources under it. */
export interface SourceRegistry {
  accessed: string;
  sources: SourceRecord[];
}

/** The distinct `type` values present, sorted — the facet list, never a guess. */
export function sourceTypes(sources: SourceRecord[]): string[] {
  return [...new Set(sources.map((source) => source.type).filter(Boolean))].sort();
}

/**
 * The filter behind the browser. Pure, so it is tested without a DOM.
 *
 * The search runs over the id, title, publisher and key findings: the findings
 * are where the detail is — a spec section, a header name, a crawler's request
 * count — and they are the reason to search this registry at all.
 */
export function filterSources(sources: SourceRecord[], text: string, type: string): SourceRecord[] {
  const needle = text.trim().toLowerCase();
  return sources.filter((source) => {
    if (type !== 'all' && source.type !== type) return false;
    if (needle === '') return true;
    const haystack =
      `${source.id} ${source.title} ${source.publisher} ${source.type} ${source.keyFindings}`.toLowerCase();
    return haystack.includes(needle);
  });
}

/** How much of a finding the collapsed row shows before it needs expanding. */
const PREVIEW_LIMIT = 140;

/**
 * The opening of a finding, cut at a word boundary.
 *
 * Exported for the sake of the test that pins the cut: a naive slice mid-word
 * reads as a typo, and mid-backtick it opens a code span that never closes.
 */
export function previewOf(text: string, limit = PREVIEW_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Write `text` into `target`, turning its `backtick` spans into `<code>`.
 *
 * Every part goes in as a text node, so the registry's prose is never parsed as
 * markup: the rows are built from data fetched at runtime and nothing in them
 * is trusted as HTML.
 */
function setProseWithCode(target: HTMLElement, text: string): void {
  // Only a closed pair is a code span. A truncated preview can end on a lone
  // backtick; that one stays literal text rather than opening a span that runs
  // to the end of the sentence.
  const spans = /`([^`]+)`/g;
  let last = 0;
  for (const match of text.matchAll(spans)) {
    if (match.index > last) target.append(document.createTextNode(text.slice(last, match.index)));
    const code = document.createElement('code');
    code.textContent = match[1]!;
    target.append(code);
    last = match.index + match[0].length;
  }
  if (last < text.length) target.append(document.createTextNode(text.slice(last)));
}

const CELL = 'align-top px-3 py-2.5 text-sm text-slate-300';

/** The key-findings cell: short findings read straight, long ones expand. */
function findingsCell(source: SourceRecord): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = `${CELL} min-w-[18rem] max-w-prose`;

  // Coalesced: a record that reaches here without its findings blanks one cell.
  // Reading `.length` off `undefined` would throw, and one incomplete record is
  // no reason for the reader to lose the other 646 rows.
  const findings = source.keyFindings ?? '';
  if (findings.length <= PREVIEW_LIMIT) {
    setProseWithCode(cell, findings);
    return cell;
  }

  // `<details>` rather than a clamp-and-toggle: it is one element, it needs no
  // script of its own, it is keyboard-operable, and a collapsed row stays one
  // or two lines tall on a phone.
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer text-slate-300 marker:text-slate-500';
  setProseWithCode(summary, previewOf(findings));
  const full = document.createElement('p');
  full.className = 'mt-2 text-slate-400';
  setProseWithCode(full, findings);
  details.append(summary, full);
  cell.append(details);
  return cell;
}

/** One `<tr>` for one source. Built from nodes, never from an HTML string. */
function sourceRow(source: SourceRecord): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'border-t border-border-subtle align-top';
  row.dataset['sourceId'] = source.id;

  const head = document.createElement('th');
  head.scope = 'row';
  head.className = `${CELL} text-left font-medium text-white`;
  const link = document.createElement('a');
  link.href = source.url;
  link.rel = 'noopener';
  link.className = 'text-brand-soft underline decoration-slate-600 hover:text-white';
  link.textContent = source.title;
  const id = document.createElement('code');
  id.className = 'mt-1 block text-xs font-normal text-slate-500';
  id.textContent = source.id;
  head.append(link, id);

  const publisher = document.createElement('td');
  publisher.className = CELL;
  publisher.textContent = source.publisher;

  const type = document.createElement('td');
  type.className = `${CELL} whitespace-nowrap`;
  type.textContent = source.type;

  const verified = document.createElement('td');
  verified.className = `${CELL} whitespace-nowrap`;
  verified.textContent = source.verified;

  row.append(head, publisher, type, verified, findingsCell(source));
  return row;
}

/** Where the fetched registry lives, next to the pages that cite it. */
export const REGISTRY_URL = withBase('sources.json');

/**
 * Bind the browser to the page. The only DOM-touching export.
 *
 * Resolves once the table is on screen, so the test can await it rather than
 * racing the fetch.
 */
export async function mountSourcesTable(): Promise<void> {
  const status = document.querySelector<HTMLElement>('#sources-status');
  const wrap = document.querySelector<HTMLElement>('#sources-table');
  const body = document.querySelector<HTMLTableSectionElement>('#sources-rows');
  const controls = document.querySelector<HTMLElement>('#sources-controls');
  const empty = document.querySelector<HTMLElement>('#sources-empty');
  if (!status || !wrap || !body) return;

  // Said before the fetch, not after: the registry is large enough that the
  // wait is visible, and a blank panel would read as a broken page.
  //
  // The region's visibility is never touched here. It renders empty and visible
  // from first paint, so assistive tech is already observing it when this line
  // and every line after it is written.
  status.textContent = 'Loading the source registry…';

  let sources: SourceRecord[];
  let rows: Array<readonly [SourceRecord, HTMLTableRowElement]>;
  try {
    const response = await fetch(REGISTRY_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    sources = ((await response.json()) as SourceRegistry).sources;
    // The rows are built inside the `try` on purpose. A body that parses but is
    // not this registry — no `sources` array, a record short of a field — would
    // otherwise throw out of an async function nobody awaits (`sources.astro`
    // calls `void mountSourcesTable()`), leaving the reader on "Loading the
    // source registry…" with the table hidden and nothing said. Failing here
    // puts it in the same branch a failed fetch lands in.
    rows = sources.map((source) => [source, sourceRow(source)] as const);
  } catch {
    status.textContent = 'The source registry could not be loaded. Open sources.json directly:';
    const link = document.createElement('a');
    link.href = REGISTRY_URL;
    link.className = 'ml-1 underline';
    link.textContent = REGISTRY_URL;
    status.append(link);
    return;
  }

  body.replaceChildren(...rows.map(([, row]) => row));
  wrap.hidden = false;

  const input = document.querySelector<HTMLInputElement>('#source-search');
  const state = { text: '', type: 'all' };

  const apply = () => {
    const visible = new Set(filterSources(sources, state.text, state.type).map((s) => s.id));
    for (const [source, row] of rows) row.hidden = !visible.has(source.id);
    status.textContent = `Showing ${visible.size} of ${sources.length} sources.`;
    if (empty) empty.hidden = visible.size > 0;
  };

  input?.addEventListener('input', () => {
    state.text = input.value;
    apply();
  });

  for (const pill of document.querySelectorAll<HTMLElement>('[data-filter="type"]')) {
    pill.addEventListener('click', () => {
      state.type = pill.dataset['value'] ?? 'all';
      for (const sibling of document.querySelectorAll('[data-filter="type"]')) {
        sibling.setAttribute('aria-pressed', String(sibling === pill));
      }
      apply();
    });
  }

  // Revealed only now that they are wired up, the way the audit explorer does
  // it: an inert search box is worse than none.
  if (controls) controls.hidden = false;

  apply();
}
