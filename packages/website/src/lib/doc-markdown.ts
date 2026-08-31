import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { githubUrl, repoTarget, type MdastPlugin } from './dossier-links';
import { DOC_SECTIONS } from './markdown-slice';
import { auditPath, docPath, withBase } from './routes';

/** The repository files this site publishes whole, mapped to their docs slug. */
const PUBLISHED_FILES = new Map(
  DOC_SECTIONS.filter((section) => !section.heading).map((section) => [section.file, section.slug]),
);

/**
 * Resolve one relative link inside a documentation source.
 *
 * The same rule the dossiers follow: a target this site publishes becomes a site
 * route, everything else becomes a GitHub URL. The README and the files under
 * `docs/` are written for GitHub and stay that way on disk — only the directory
 * they resolve from differs, which is what `fromDir` carries.
 */
export function resolveDocLink(href: string, fromDir: string, published: Set<string>): string {
  const target = repoTarget(href, fromDir);
  if (!target) return href;

  const slug = PUBLISHED_FILES.get(target.path);
  if (slug) return docPath(slug) + target.fragment;

  if (target.path === 'docs/evidence/policy.md') return withBase('policy/') + target.fragment;
  // The policy's one relative link. A reader following it wants the registry
  // they can search, not 465 KB of JSON; the sources page offers the raw file.
  if (target.path === 'docs/evidence/sources.json') return withBase('sources/') + target.fragment;

  const dossier = /^docs\/evidence\/audits\/(.+)\.md$/.exec(target.path);
  if (dossier && published.has(dossier[1]!)) return auditPath(dossier[1]!) + target.fragment;

  // The README also links a section of itself (`#-quickstart`); a bare fragment
  // is not a relative path, so `repoTarget` has already returned it untouched.
  return githubUrl(target);
}

/**
 * Rewrite the relative links of one documentation source as it is rendered.
 *
 * The directory to resolve against travels in the frontmatter rather than in the
 * closure, so a single processor can render all twelve pages: six come from the
 * repository root and six from under `docs/`.
 */
function docLinksPlugin(published: Set<string>): MdastPlugin {
  return {
    name: 'agent-lighthouse:doc-links',
    link(node, ctx) {
      const fromDir = ctx.data.astro?.frontmatter['fromDir'];
      if (typeof fromDir !== 'string') return;
      const url = resolveDocLink(node.url, fromDir, published);
      if (url !== node.url) ctx.setProperty(node, 'url', url);
    },
  };
}

/** What a rendered documentation source hands the page. */
export interface RenderedDoc {
  html: string;
  headings: Array<{ depth: number; slug: string; text: string }>;
}

/**
 * Build the Markdown pipeline the docs pages render through.
 *
 * It is deliberately *not* the processor in `astro.config.mjs`. That one carries
 * `escapeRawHtmlPlugin()`, which is right for the dossiers — prose about HTML
 * that names tags without backticks — and wrong here: the README writes HTML on
 * purpose (alignment wrappers, badge rows), and escaping it would print the tags
 * on the page. Everything else matches, including Shiki, which
 * `createSatteriMarkdownProcessor` enables by default exactly as Astro does.
 *
 * One processor renders all twelve pages: the per-document state that matters —
 * the heading slugger and the collected headings — is created per `render` call.
 */
export async function createDocRenderer(published: Set<string>) {
  const processor = await createSatteriMarkdownProcessor({
    mdastPlugins: [docLinksPlugin(published)],
  });

  return async function render(markdown: string, fromDir: string): Promise<RenderedDoc> {
    const { code, metadata } = await processor.render(markdown, { frontmatter: { fromDir } });
    return { html: code, headings: metadata.headings };
  };
}
