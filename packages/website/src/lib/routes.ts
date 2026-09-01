/**
 * The site's base path, kept in step with `base` in `astro.config.mjs`.
 * Astro injects it as `BASE_URL` during dev and build; under vitest Vite still
 * defines `BASE_URL`, but as the default `/`, so treat that as "not injected".
 */
const CONFIGURED_BASE = "/agent-lighthouse/";
const injected = import.meta.env?.BASE_URL;
const BASE = (
  !injected || injected === "/" ? CONFIGURED_BASE : injected
).replace(/\/?$/, "/");

/** Prefix a site-absolute path with the base path, exactly once. */
export function withBase(path: string): string {
  return `${BASE}${path.replace(/^\//, "")}`;
}

/** Where an audit's dossier is published, derived from its id. */
export function auditPath(id: string): string {
  return withBase(`audits/${id}/`);
}

/** Where a category index is published. */
export function categoryPath(category: string): string {
  return withBase(`categories/${category}/`);
}

/** Where a docs section is published. */
export function docPath(slug: string): string {
  return withBase(`docs/${slug}/`);
}
