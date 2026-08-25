import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { auditPath, withBase } from './routes';

const REPO = 'https://github.com/ForkPoint/agent-lighthouse';
/** Where a dossier sits, so a relative link can be resolved against it. */
const DOSSIER_DIR = 'docs/evidence/audits';

/** A relative markdown link, normalised against the directory it was written in. */
export interface RepoTarget {
  /** The repository-relative path it points at, with `.` and `..` resolved. */
  path: string;
  /** The `#fragment` the author wrote, or an empty string. */
  fragment: string;
  /** GitHub serves directories under `tree/` and files under `blob/`. */
  view: 'blob' | 'tree';
}

/**
 * Resolve one relative markdown link against the directory of the file that
 * carries it, returning `null` for anything that is not a relative path —
 * absolute URLs, bare fragments and site-absolute paths are left to the caller.
 *
 * Kept separate from the two link resolvers below because both need exactly
 * this: markdown in this repository is written for GitHub wherever it lives,
 * and only the directory it is written from differs.
 */
export function repoTarget(href: string, fromDir: string): RepoTarget | null {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return null;

  // A fragment addresses a section of the target, not a different file: hold it
  // aside while the path resolves, then put it back on the resolved URL.
  const hash = href.indexOf('#');
  const target = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);

  const stack: string[] = [];
  for (const segment of `${fromDir}/${target}`.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }

  // The trailing slash the author wrote is the only signal of a directory.
  return { path: stack.join('/'), fragment, view: target.endsWith('/') ? 'tree' : 'blob' };
}

/** Where GitHub serves a repository path, on the default branch. */
export function githubUrl(target: RepoTarget): string {
  return `${REPO}/${target.view}/main/${target.path}${target.fragment}`;
}

/**
 * Resolve one relative markdown link found inside a dossier.
 *
 * Published targets become site routes; everything else becomes a GitHub URL,
 * because the scope of this site is audits, the policy and the sources —
 * merged, sunset, deleted and proposed dossiers stay in the repository.
 */
export function resolveDossierLink(href: string, fromId: string, published: Set<string>): string {
  const [category] = fromId.split('/');
  const target = repoTarget(href, `${DOSSIER_DIR}/${category}`);
  if (!target) return href;

  if (target.path === 'docs/evidence/policy.md') return withBase('policy/') + target.fragment;

  const dossier = /^docs\/evidence\/audits\/(.+)\.md$/.exec(target.path);
  if (dossier && published.has(dossier[1]!)) return auditPath(dossier[1]!) + target.fragment;

  return githubUrl(target);
}

/** One entry of `satteri({ mdastPlugins })`, named without importing `satteri` itself. */
export type MdastPlugin = NonNullable<SatteriProcessorOptions['mdastPlugins']>[number];

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
