import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';

/** One entry of `satteri({ hastPlugins })`, named without importing `satteri` itself. */
type HastPlugin = NonNullable<SatteriProcessorOptions['hastPlugins']>[number];

/**
 * Render angle brackets in the markdown body as text, not as markup.
 *
 * The dossiers under `docs/evidence/` are prose about HTML, written for GitHub's
 * renderer and read-only here. They mention tags constantly — `<main>`, `<meta>`,
 * `<script>`, sitemap elements like `<lastmod>`, placeholders like
 * `<random-32-hex>` — and only some of those mentions are backticked. Markdown
 * passes an unbackticked one through as real HTML, so the page ends up with a
 * second `<h1>` mid-paragraph, an `<img>` with no `src`, or a `<head>` that
 * simply vanishes. None of it was meant as markup.
 *
 * A `raw` hast node is exactly that passthrough HTML, and nothing else: fenced
 * code and code spans are their own node types and are untouched. Swapping each
 * one for a text node makes the serializer escape it.
 */
export function escapeRawHtmlPlugin(): HastPlugin {
  return {
    name: 'agent-lighthouse:escape-raw-html',
    raw(node, ctx) {
      const text = { type: 'text', value: node.value } as const;
      // A raw node directly under the root stood alone on its own line, so it
      // takes a paragraph of its own; anywhere else it is mid-sentence and the
      // surrounding block already provides one.
      const isBlock = ctx.parent(node)?.type === 'root';
      ctx.replaceNode(
        node,
        isBlock ? { type: 'element', tagName: 'p', properties: {}, children: [text] } : text,
      );
    },
  };
}
