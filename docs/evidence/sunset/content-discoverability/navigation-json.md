---
audit: content-discoverability/navigation-json
category: content-discoverability
audit_id: "1.21"
source_file: packages/core/src/audits/content-discoverability/navigation-json.ts
slug: navigation-json
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# navigation-json — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Serving a `/navigation.json` at the site root gives AI agents a machine-readable site-hierarchy map (labels, URLs, nested children), letting them plan multi-step browsing without inferring structure from HTML. For this to matter, some crawler or agent would have to actually request /navigation.json, or the file would have to be a named convention some framework or answer engine ingests.

## What we searched

Four angles via direct fetch and GitHub API (WebSearch budget exhausted). (1) Standards check: fetched llmstxt.org to see what the leading AI-discoverability proposal actually prescribes for giving models a site map, and whether it endorses any JSON navigation file. (2) Existing standard for the same job: fetched schema.org/SiteNavigationElement including its Google-web-index adoption figure. (3) Adjacent specs: confirmed via the WebMCP spec/explainer greps and the OpenAI commerce specs that no agent-facing standard I examined defines a root navigation manifest. (4) Adoption: GitHub code searches for "/navigation.json" together with agent/AI terms, and for navigation.json alongside llms.txt, to see whether any root-served agent-facing instance exists in the wild.

## Best evidence found for the audit

Essentially nothing. The strongest evidence found is that files literally named navigation.json do exist at scale in the wild — but every substantial hit is a documentation-site *build-time configuration* file, not a root-served agent manifest: ClickHouse/ClickHouse ships docs/products/cloud/navigation.json across ten locale directories, and similar patterns appear in Nuxt/undocs/Mintlify-style docs toolchains. These are consumed by static-site generators at build time and are not served at the site root, are not fetched by any crawler, and have no shared schema resembling the {name, items[{label,url,children}]} shape the audit prescribes. No vendor doc, spec, or study names /navigation.json as an agent signal, and no crawler documentation lists it as a fetched path.

## Counter-evidence

Positive proof that the job is already done by real, adopted mechanisms, and that the leading conventions deliberately chose different formats. (1) schema.org/SiteNavigationElement is an active schema.org type for exactly this purpose ("a navigation element of the page", properties name/url/position, inherits WebPageElement) with measured adoption of "1M - 10M Domains Based on monthly aggregations from Google's web index" as of July 2026 — a real, consumed, million-domain standard for machine-readable navigation that /navigation.json duplicates with zero consumers. (2) llmstxt.org, the actual AI-discoverability convention, prescribes "/llms.txt markdown file" with H1/blockquote/H2 file-list structure and explicitly justifies the format choice: "At the moment the most widely and easily understood format for language models is Markdown." It makes no mention of and does not endorse any JSON navigation file. (3) The remaining real, crawler-consumed site-structure surfaces are sitemap.xml (documented as fetched by every major crawler) and BreadcrumbList/SiteNavigationElement JSON-LD — both already covered elsewhere in a content-discoverability category. (4) GitHub occurrences of navigation.json are docs-toolchain build configs (ClickHouse docs across 10 locales, Nuxt/undocs configs), never root-served agent manifests, so even the community-convention grade is unsupported.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. No spec defines /navigation.json, no vendor crawler documents fetching it, no study measures an effect, and the wild instances are build-time docs configs rather than the audited artifact. Adoption as an agent signal is effectively zero, so it does not qualify as dead-but-informative either. The audit is also actively misleading: it FAILs at medium priority on a file no consumer will ever request, while the real, million-domain-adopted answer to the same question (schema.org SiteNavigationElement / BreadcrumbList JSON-LD, plus sitemap.xml and llms.txt) is a different check. Delete, and if site-hierarchy legibility is worth scoring, score SiteNavigationElement/BreadcrumbList JSON-LD instead.

## Sources

- **[SiteNavigationElement](https://schema.org/SiteNavigationElement)** — schema.org (spec, URL verified 2026-08-21)
  - Active schema.org type for "a navigation element of the page"; inherits from WebPageElement/CreativeWork; key properties name, url, position. Adoption reported as "1M - 10M Domains Based on monthly aggregations from Google's web index" (July 2026). This is the standardized, widely deployed machine-readable navigation signal that navigation.json duplicates without any consumer.
- **[The /llms.txt file](https://llmstxt.org/)** — llmstxt.org (Answer.AI / Jeremy Howard) (spec, URL verified 2026-08-21)
  - Prescribes a /llms.txt markdown file (H1 name, blockquote summary, H2-delimited file lists of URLs) as the AI-facing site map. Rationale given: "At the moment the most widely and easily understood format for language models is Markdown." Makes no mention of and does not endorse any JSON navigation file such as navigation.json.
- **[GitHub code search: navigation.json occurrences](https://github.com/search?q=%22navigation.json%22&type=code)** — GitHub (repo, NOT verified)
  - (GitHub code-search query link — interactive only, result counts recorded at research time.) Substantive hits are documentation-toolchain build configs, not root-served agent manifests: ClickHouse/ClickHouse docs/products/cloud/navigation.json replicated across 10 locale directories, plus Nuxt/undocs/Mintlify-style docs configs. No shared schema matching the audited {name, items[{label,url,children}]} shape; no instance served at the site root as an agent signal.
- **[Web Model Context API (WebMCP) draft specification](https://webmachinelearning.github.io/webmcp/)** — W3C Web Machine Learning Community Group (spec, URL verified 2026-08-21)
  - Checked as an adjacent agent-facing standard: defines in-page tool registration and form-synthesized tools only. No site-navigation manifest, no .well-known or root JSON discovery file of any kind.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/content-discoverability/navigation-json.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

A navigation.json file gives AI agents a machine-readable map of your site hierarchy, helping them navigate your site like a human would.

### Code review findings (2026-08-20, 11-agent pass)

Requires a /navigation.json file at the site root. No such standard exists — it is not an IETF well-known URI, not a W3C or schema.org convention, and has no known consumer among any crawler, agent or MCP client. The audit invents a file format (its own ad-hoc {name, items[], children[]} shape appears nowhere else), fails essentially every site on the internet at medium priority, and instructs users to hand-maintain a second copy of their navigation for zero downstream benefit. This is the clearest case in the category of an audit that is net-misleading.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- Fails 100% of real sites, since no site ships /navigation.json — the 'fail' carries no information about the site at all.
- Passing is equally meaningless: `JSON.parse(result.body)` accepts `"x"`, `0`, `null`, `[]` — any valid JSON scalar passes as 'navigation.json exists with valid JSON'. The prescribed items/children structure is never validated.
- No content-type check, so an SPA catch-all returning HTML gives 'invalid JSON' (implying the user has a broken file) rather than 'not found'.
- Any site that happens to host an unrelated /navigation.json (a JS bundle manifest, a CMS export) PASSES on a file that has nothing to do with site navigation.
- Even a perfectly formed file per the sample cannot improve agent outcomes, because nothing fetches it — so a user who does the work sees zero change and loses trust in the whole report.

**Test gaps:**
- Valid-JSON-but-not-navigation bodies ('null', '[]', a scalar) that currently PASS
- HTML soft-404 reported as 'invalid JSON'
- Any evidence that a consumer of this file exists

**Overlaps with:** `1.7`, `1.22`

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/content-discoverability/navigation-json.md`; that copy removed (one dossier per removed audit, under `sunset/`).
