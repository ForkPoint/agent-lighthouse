/**
 * 7.18 Page has a title (`operability-safety/document-title`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from './_shared';

export const DocumentTitleAudit = defineA11yAudit({
  rules: ['document-title'],
  meta: {
    ...base,
    ...graded('A', 'document-title'),
    id: 'operability-safety/document-title',
    title: 'Page has a non-empty <title>',
    failureTitle: 'Missing or empty <title>',
    description:
      'The document title is the page’s identity in the accessibility tree and in agent context windows. A missing/empty title leaves the page unnamed.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Agents use <title> to identify and reference a page; without it, the page is hard to cite or disambiguate.',
      fix: 'Provide a descriptive, unique <title> for every page.',
      code: '<title>Men’s Wool Runners — Allbirds</title>',
      effort: 'trivial',
      tags: ['title', 'identity', 'agent'],
    },
  },
});
