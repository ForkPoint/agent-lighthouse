---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse-report": patch
"@forkpoint/agent-lighthouse": patch
"@forkpoint/agent-lighthouse-mcp": patch
---

v2 registry: evidence-mass overall score and an enforced audit contract.

**Breaking: `CATEGORY_WEIGHTS` is gone.** A category's share of the overall score is no longer a hand-tuned percentage; it is the category's *evidence mass* — the summed weight of its registered audits — exported as `CATEGORY_MASS` and derived from the registry:

```
overall = Σ(categoryScore × categoryMass) / Σ(categoryMass)
```

A category made only of informative/experimental audits has mass 0 and cannot move the overall score. Scores shift accordingly: influence now follows proven evidence (e.g. Access & Crawl Control carries 36 mostly grade-A audits and weighs far more than its old 0.08).

**Breaking: `AuditMetaSchema` enforces the v2 contract.** `evidenceGrade`, `tier` and `dossier` are required — an audit must state where its weight comes from and which dossier proves it — and `id` must match `AUDIT_ID_PATTERN` (`/^[a-z-]+\/[a-z0-9-]+$/`, i.e. `category/slug`), so numeric v1 ids no longer validate. Translating an existing id is covered in the taxonomy note.

**Breaking: `buildCategoryResult(id, checks, mass?)`** takes the category's evidence mass instead of looking up a weight table; omitted, the category weighs nothing.

The registry itself is now sourced from the eight category `index.ts` files, so adding an audit to a category folder registers it. Readiness vitals were remapped onto v2 ids: `botAccessibility` reads the `access-crawl-control` category and `technical` reads `content-extraction`.
