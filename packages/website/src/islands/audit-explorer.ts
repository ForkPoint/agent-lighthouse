import type { AuditRecord } from '../lib/registry';

/**
 * The audit explorer's client half.
 *
 * It never imports the registry or core: `vite.resolve.external` is declared at
 * the top level of the Astro config, so a bare specifier here would survive into
 * the browser bundle and fail at load. The records arrive from the server as a
 * serialized prop instead — see `pages/audits/index.astro`. The only import is a
 * type, which TypeScript erases.
 */
export interface ExplorerQuery {
  text: string;
  category: string;
  tier: string;
}

/** The filter behind the explorer. Pure, so it is tested without a DOM. */
export function filterAudits(audits: AuditRecord[], query: ExplorerQuery): AuditRecord[] {
  const text = query.text.trim().toLowerCase();
  return audits.filter((audit) => {
    if (query.category !== 'all' && audit.category !== query.category) return false;
    if (query.tier !== 'all' && audit.tier !== query.tier) return false;
    if (text === '') return true;
    const haystack = [audit.id, audit.title, audit.description, ...audit.tags]
      .join(' ')
      .toLowerCase();
    return haystack.includes(text);
  });
}

/**
 * Bind the filter to the page. The only DOM-touching export.
 *
 * Every card is already in the document — this hides the ones that no longer
 * match. Hiding uses the `hidden` property rather than a utility class so a
 * filtered-out card leaves the accessibility tree as well as the layout.
 */
export function mountExplorer(audits: AuditRecord[]): void {
  const input = document.querySelector<HTMLInputElement>('#audit-search');
  const cards = [...document.querySelectorAll<HTMLElement>('[data-audit-id]')];
  const count = document.querySelector('#audit-count');
  const empty = document.querySelector<HTMLElement>('#audit-empty');
  const state: ExplorerQuery = { text: '', category: 'all', tier: 'all' };

  const apply = () => {
    const visible = new Set(filterAudits(audits, state).map((audit) => audit.id));
    for (const card of cards) card.hidden = !visible.has(card.dataset['auditId'] ?? '');
    if (count) count.textContent = String(visible.size);
    if (empty) empty.hidden = visible.size > 0;
  };

  input?.addEventListener('input', () => {
    state.text = input.value;
    apply();
  });

  for (const pill of document.querySelectorAll<HTMLElement>('[data-filter]')) {
    pill.addEventListener('click', () => {
      const kind = pill.dataset['filter'] as 'category' | 'tier';
      state[kind] = pill.dataset['value'] ?? 'all';
      for (const sibling of document.querySelectorAll(`[data-filter="${kind}"]`)) {
        sibling.setAttribute('aria-pressed', String(sibling === pill));
      }
      apply();
    });
  }

  // The controls ship hidden and are revealed here: without JavaScript they
  // would be inert, and an inert search box is worse than none — the full list
  // is server-rendered either way.
  const controls = document.querySelector<HTMLElement>('#audit-controls');
  if (controls) controls.hidden = false;

  apply();
}
