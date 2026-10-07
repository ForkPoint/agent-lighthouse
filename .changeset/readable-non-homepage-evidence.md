---
"@forkpoint/agent-lighthouse-core": patch
---

Assess general checks on product, category, and content scans. An audit that applies to all pages now accepts a readable page of any type as sample evidence. Before, it required a readable homepage, so a scan that started on a non-homepage URL skipped every general check and often reported no overall score.

- General audits judge the first scanned page that serves readable text, not the first scanned page. A near-empty page no longer fails a check when another scanned page is readable.
- Findings name the page that was judged. They no longer call a product, category, or content page "the homepage".
- Audits whose evidence covers the homepage only still require a homepage and return not applicable without one.
- Audits that declare page types still require readable evidence from those types.
- The score suppression threshold is unchanged. No audit id, tier, grade, or weight changes.
