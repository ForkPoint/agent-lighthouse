/**
 * Documentation pages the site once published and has since removed, keyed by
 * old slug, with the live page that now serves their readers. Each becomes a
 * redirect in `astro.config.mjs`, so a link someone saved does not 404.
 */
export const RETIRED_DOCS: Readonly<Record<string, string>> = {
  // The multi-site benchmark guide; its script and dataset were removed in 10.1.0.
  benchmark: "quickstart",
};

/** Astro `redirects` entries: old route, relative to `base`, to the new page. */
export function retiredDocRedirects(base: string): Record<string, string> {
  const root = base.replace(/\/?$/, "/");
  return Object.fromEntries(
    Object.entries(RETIRED_DOCS).map(([from, to]) => [
      `/docs/${from}/`,
      `${root}docs/${to}/`,
    ]),
  );
}

/** Whether a built directory, relative to `dist/`, is a retired page's redirect. */
export function isRetiredDocDir(relative: string): boolean {
  const [section, slug, ...rest] = relative.split(/[\\/]/);
  return (
    section === "docs" &&
    rest.length === 0 &&
    slug !== undefined &&
    Object.hasOwn(RETIRED_DOCS, slug)
  );
}
