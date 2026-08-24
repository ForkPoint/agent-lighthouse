/**
 * The audit explorer's client half.
 *
 * It imports nothing at all — not even a type from `registry.ts`. The page it
 * runs on has already rendered every audit as a card, so the explorer reads its
 * data back out of those cards instead of being handed a serialized copy of the
 * registry: the same 215 titles and descriptions would otherwise ship twice,
 * once as HTML and once as JSON (127 KB of it, a third of the page gzipped).
 */
export interface ExplorerQuery {
  text: string;
  category: string;
  tier: string;
}

/** One audit as the explorer needs it: two facets and the text to search. */
export interface SearchableAudit {
  id: string;
  category: string;
  tier: string;
  /** Lowercased text this audit matches on — its card's text, plus its tags. */
  haystack: string;
}

/** The filter behind the explorer. Pure, so it is tested without a DOM. */
export function filterAudits(audits: SearchableAudit[], query: ExplorerQuery): SearchableAudit[] {
  const text = query.text.trim().toLowerCase();
  return audits.filter((audit) => {
    if (query.category !== 'all' && audit.category !== query.category) return false;
    if (query.tier !== 'all' && audit.tier !== query.tier) return false;
    return text === '' || audit.haystack.includes(text);
  });
}

/**
 * Bind the filter to the page. The only DOM-touching export.
 *
 * Every card is already in the document — this hides the ones that no longer
 * match. Hiding uses the `hidden` property rather than a utility class so a
 * filtered-out card leaves the accessibility tree as well as the layout.
 */
export function mountExplorer(): void {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-audit-id]')];
  // A card prints its id, title, description and category, which is most of
  // what the old explorer searched; `data-tags` carries the rest.
  const audits: SearchableAudit[] = cards.map((card) => ({
    id: card.dataset['auditId'] ?? '',
    category: card.dataset['category'] ?? '',
    tier: card.dataset['tier'] ?? '',
    haystack: `${card.textContent ?? ''} ${card.dataset['tags'] ?? ''}`.toLowerCase(),
  }));

  const input = document.querySelector<HTMLInputElement>('#audit-search');
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
