import { DOC_SECTIONS } from './markdown-slice';
import { docPath, withBase } from './routes';

/** One entry of the documentation sidebar — the shape `SidebarNav` takes. */
export interface DocNavEntry {
  label: string;
  href: string;
}

/**
 * The documentation sidebar, shared by every page that renders repository
 * markdown: the eleven docs sections, then the two evidence pages.
 *
 * It lives here rather than in the docs route because the policy page renders
 * the same layout and needs the same rail — a sidebar that listed the docs from
 * `/policy/` but never mentioned the policy from `/docs/` would leave the two
 * halves of the documentation unable to reach each other.
 *
 * The sequential order the docs pages walk stays inside `DOC_SECTIONS`: the
 * evidence pair is a destination, not the twelfth and thirteenth steps of the
 * quickstart-to-configuration path.
 */
export function documentationNav(): DocNavEntry[] {
  return [
    ...DOC_SECTIONS.map((section) => ({ label: section.title, href: docPath(section.slug) })),
    { label: 'Evidence policy', href: withBase('policy/') },
    { label: 'Source registry', href: withBase('sources/') },
  ];
}
