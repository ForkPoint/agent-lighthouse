import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const audits = defineCollection({
  // `*/*.md` — one level down only, so `audits/README.md` (the v1 index, which
  // carries no frontmatter and is not a dossier) stays out of the collection.
  loader: glob({
    base: '../../docs/evidence/audits',
    pattern: '*/*.md',
    // Derive the id from the path, not from frontmatter: every dossier carries a
    // bare `slug:` field that the loader would otherwise adopt as the id, which
    // would collapse `<category>/<slug>` down to `<slug>` and lose the category.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
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
