import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { auditPath, withBase } from './routes';

const REPO = 'https://github.com/ForkPoint/agent-lighthouse';
/** Where a dossier sits, so a relative link can be resolved against it. */
const DOSSIER_DIR = 'docs/evidence/audits';

/**
 * Resolve one relative markdown link found inside a dossier.
 *
 * Published targets become site routes; everything else becomes a GitHub URL,
 * because the scope of this site is audits, the policy and the sources —
 * merged, sunset, deleted and proposed dossiers stay in the repository.
 */
export function resolveDossierLink(href: string, fromId: string, published: Set<string>): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;

  // A fragment addresses a section of the target, not a different file: hold it
  // aside while the path resolves, then put it back on the resolved URL.
  const hash = href.indexOf('#');
  const target = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);

  const [category] = fromId.split('/');
  const segments = `${DOSSIER_DIR}/${category}/${target}`.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  const repoPath = stack.join('/');

  if (repoPath === 'docs/evidence/POLICY.md') return withBase('policy/') + fragment;

  const dossier = /^docs\/evidence\/audits\/(.+)\.md$/.exec(repoPath);
  if (dossier && published.has(dossier[1]!)) return auditPath(dossier[1]!) + fragment;

  // GitHub serves directories under `tree/` and files under `blob/`; the trailing
  // slash the author wrote is the only signal of which one this is.
  const view = target.endsWith('/') ? 'tree' : 'blob';
  return `${REPO}/${view}/main/${repoPath}${fragment}`;
}

/** One entry of `satteri({ mdastPlugins })`, named without importing `satteri` itself. */
type MdastPlugin = NonNullable<SatteriProcessorOptions['mdastPlugins']>[number];

/**
 * Rewrite every relative link in a dossier as the page is rendered, leaving the
 * markdown on disk as the GitHub-relative source it is.
 *
 * `published` is passed in rather than read here, so the resolver stays pure and
 * the plugin owns no filesystem; `astro.config.mjs` builds the set.
 */
export function dossierLinksPlugin(published: Set<string>): MdastPlugin {
  return {
    name: 'agent-lighthouse:dossier-links',
    link(node, ctx) {
      // `audit` carries the `<category>/<slug>` id on all 215 dossiers, and that
      // is what a relative link resolves against. A file without it — the policy
      // page, any future loose markdown — is left as written.
      const fromId = ctx.data.astro?.frontmatter['audit'];
      if (typeof fromId !== 'string' || fromId === '') return;
      const url = resolveDossierLink(node.url, fromId, published);
      if (url !== node.url) ctx.setProperty(node, 'url', url);
    },
  };
}
