import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from '../../check-context';
import { getWordCount, getMainContentText } from '../../parser';

export class ServerRenderedAudit extends Audit {
  static override meta: AuditMeta = {
    id: '8.13',
    category: 'technical-readiness',
    title: 'Server-rendered content',
    failureTitle: 'Server-rendered content',
    description:
      'AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.',
    scoreDisplayMode: 'ternary',
    weight: 1.0,
    defaultPriority: 'critical',
    guidance: {
      impact:
        'AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript. If your content is only rendered client-side, these crawlers see an empty or near-empty page. Your products, articles, and brand information are completely absent from AI knowledge bases, meaning AI-generated answers never reference your site.',
      fix: 'Switch from client-side rendering to server-side rendering (SSR) or static site generation (SSG). Frameworks like Next.js, Nuxt, SvelteKit, and Astro all support SSR/SSG. Ensure your homepage and key landing pages return meaningful HTML content in the initial response.',
      code: '// Next.js App Router (server component by default):\nexport default async function Page() {\n  const data = await fetchProducts();\n  return <ProductList items={data} />;\n}\n\n// Or with getServerSideProps (Pages Router):\nexport async function getServerSideProps() {\n  const data = await fetchProducts();\n  return { props: { data } };\n}',
      effort: 'complex',
      docsUrl: 'https://web.dev/articles/rendering-on-the-web',
      tags: ['rendering', 'ssr', 'critical'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages?.[0];

    if (!page) {
      return this.warn(
        'No homepage data available to check server-rendered content.',
        'Homepage <main> has > 50 words or > 200 characters of text content',
        'No homepage fetched',
        undefined,
        undefined,
      );
    }

    const $ = page.$;
    const wordCount = getWordCount($);
    const mainText = getMainContentText($);

    if (wordCount > 50 || mainText.length > 200) {
      return this.pass(
        `Homepage has meaningful server-rendered content (${wordCount} words, ${mainText.length} characters).`,
        'Homepage <main> has > 50 words or > 200 characters of text content',
        `${wordCount} words, ${mainText.length} characters`,
        page.url,
      );
    }

    return this.fail(
      `Homepage has minimal server-rendered content (${wordCount} words, ${mainText.length} characters). AI agents cannot read client-side-only rendered content.`,
      'Homepage <main> has > 50 words or > 200 characters of text content',
      `${wordCount} words, ${mainText.length} characters`,
      {
        priority: 'critical',
        description:
          'AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.',
        code: '// Next.js SSR example:\nexport async function getServerSideProps() {\n  const data = await fetchData();\n  return { props: { data } };\n}',
      },
      page.url,
    );
  }
}
