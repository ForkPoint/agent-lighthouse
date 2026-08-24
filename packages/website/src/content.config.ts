import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { publicDossier } from './lib/dossier-public';

// `*/*.md` — one level down only, so `audits/README.md` (the v1 index, which
// carries no frontmatter and is not a dossier) stays out of the collection.
const files = glob({
  base: '../../docs/evidence/audits',
  pattern: '*/*.md',
  // Derive the id from the path, not from frontmatter: every dossier carries a
  // bare `slug:` field that the loader would otherwise adopt as the id, which
  // would collapse `<category>/<slug>` down to `<slug>` and lose the category.
  generateId: ({ entry }) => entry.replace(/\.md$/, ''),
});

/**
 * The glob loader, with every entry's body cut down to what the site publishes.
 *
 * The slice happens *here* rather than in the page so that everything
 * downstream of the collection sees the same thing: the rendered HTML, the
 * heading list the contents rail is built from, and the Pagefind index. A page
 * that sliced at render time would still ship the internal build record to
 * search.
 */
const audits = defineCollection({
  loader: {
    name: 'audit-dossiers',
    async load(context) {
      await files.load(context);
      for (const [id, entry] of context.store.entries()) {
        const data = entry.data as { public_extra?: string[]; public_omit?: string[] };
        const { markdown } = publicDossier(entry.body ?? '', {
          publicExtra: data.public_extra,
          publicOmit: data.public_omit,
        });
        // The glob loader has already rendered the whole file, so the slice has
        // to be re-rendered rather than assigned: `render(entry)` reads
        // `entry.rendered`, and the heading list the contents rail is built
        // from comes out of the same call. Rewriting only `body` would leave
        // both showing the unsliced dossier.
        context.store.set({
          ...entry,
          id,
          body: markdown,
          rendered: await context.renderMarkdown(markdown),
          digest: context.generateDigest(markdown),
        });
      }
    },
  },
  schema: z.object({
    audit: z.string(),
    category: z.string(),
    source_file: z.string(),
    slug: z.string(),
    evidence_grade: z.enum(['A', 'B', 'C', 'D']),
    // Only the v2-native dossiers record a tier; for the 148 v1 survivors the
    // registry (`meta.tier`) is the authoritative source, not the frontmatter.
    tier: z.enum(['scored', 'informative', 'experimental']).optional(),
    disposition: z.string(),
    // The two whitelist escapes. `public_extra` names a heading exactly as the
    // dossier writes it, because the point is that the whitelist has no public
    // name for it; `public_omit` names a public section to withhold here only.
    public_extra: z.array(z.string()).optional(),
    public_omit: z.array(z.string()).optional(),
    // Unquoted YAML dates arrive as `Date`, quoted ones as strings; coerce both.
    reviewed: z.coerce.date(),
    graduated: z.coerce.date().optional(),
  }),
});

// There is no `policy` collection. `POLICY.md` carries no frontmatter, so a
// collection entry would render through the processor in `astro.config.mjs` —
// whose link plugin keys on `audit:` and would therefore leave the file's one
// relative link (`./sources.json`) pointing at nothing. `pages/policy.astro`
// renders it through `createDocRenderer`, the pipeline built for repository
// markdown, which resolves that link.
export const collections = { audits };
