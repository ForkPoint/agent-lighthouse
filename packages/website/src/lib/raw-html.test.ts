import { describe, it, expect } from 'vitest';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { escapeRawHtmlPlugin } from './raw-html';

/** The real Astro 7 Markdown pipeline, with only this plugin added. */
async function render(markdown: string) {
  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    hastPlugins: [escapeRawHtmlPlugin()],
  });
  const { code } = await processor.render(markdown, { frontmatter: {} });
  return code;
}

describe('escapeRawHtmlPlugin', () => {
  it('renders an inline tag mention as text, not an element', async () => {
    const html = await render('Add schemas to your homepage <head> as a starting point.');

    expect(html).toContain('&lt;head&gt;');
    expect(html).not.toContain('<head>');
  });

  it('renders a heading written as raw HTML as text, not a heading', async () => {
    const html = await render('The page carries <h1>Buy now</h1> above the fold.');

    expect(html).toContain('&lt;h1&gt;Buy now&lt;/h1&gt;');
    expect(html).not.toMatch(/<h1[\s>]/);
  });

  it('gives a raw block its own paragraph rather than leaving it loose', async () => {
    const html = await render('Before.\n\n<h1>Alone on its line</h1>\n\nAfter.');

    expect(html).toContain('<p>&lt;h1&gt;Alone on its line&lt;/h1&gt;</p>');
  });

  it('renders an image mention as text, so no srcless img reaches the page', async () => {
    const html = await render('A decorative image is written <img alt="">.');

    expect(html).toContain('&lt;img alt=""&gt;');
    expect(html).not.toContain('<img');
  });

  it('leaves a backticked tag as the code span it already was', async () => {
    const html = await render('Wrap the body in `<main>`.');

    expect(html).toContain('<code>&lt;main&gt;</code>');
  });

  it('leaves a fenced code block alone', async () => {
    const html = await render('```html\n<h1>Title</h1>\n```');

    expect(html).toContain('<pre>');
    expect(html).toContain('&lt;h1&gt;Title&lt;/h1&gt;');
    expect(html).not.toMatch(/<h1[\s>]/);
  });

  it('leaves markdown-authored elements alone', async () => {
    const html = await render('# Real heading\n\nWith **emphasis** and a [link](https://example.com/).');

    expect(html).toMatch(/<h1[\s>]/);
    expect(html).toContain('<strong>emphasis</strong>');
    expect(html).toContain('href="https://example.com/"');
  });
});
