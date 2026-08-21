# Redemption rework — TODO

Audits that stay in the framework **only if rewritten**. Each source file carries a `TODO(redeem)` header with the required rework; full proof in the linked dossier. Companion lists: [proposed new audits](./proposed/README.md) · [deletion research](../../../../docs/evidence/deletions/README.md).

## Approved by deletion review (2026-08-21) — 9

- [ ] TODO `agent-tools/ai-catalog-exists` — grade A (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/agent-tools/ai-catalog-exists.md)
  - Grade A evidence: a named vendor tool (Hugging Face hf-discover) documents and implements fetching exactly https://{domain}/.well-known/ai-catalog.json, the path is normative in the ARD draft spec co-authored by Google/Microsoft/Hugging Face, and there is verifiable production adoption (Neon, Weaviate, Shopware core, specification.website). Keep the audit, but it MUST be rewritten: pass condition should be specVersion + host + entries[] per ARD §4.1, not a `services` array; and guidance/code samples must be replaced with the real schema, otherwise the audit penalizes spec-conformant sites..
- [ ] TODO `agent-tools/ai-catalog-metadata` — grade B (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/agent-tools/ai-catalog-metadata.md)
  - The underlying mechanism is real and consumer-backed (hf-discover's ranking is driven entirely by manifest metadata richness), which is grade-B evidence, so deletion would throw away a genuinely useful check. But the audit is currently wrong in every field it names.
- [ ] TODO `agent-tools/ai-catalog-urls` — grade B (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/agent-tools/ai-catalog-urls.md)
  - Grade B: the checked property (liveness of manifest-listed endpoints) is a real field in a real draft spec that a named Hugging Face client dereferences and that independent crawlers/validators probe. This is the most mechanically defensible of the four — a broken url genuinely breaks agent traversal.
- [ ] TODO `meta-tags/ai-catalog-link` — grade B (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/meta-tags/ai-catalog-link.md)
  - Grade B: the mechanism is written into two draft specs (ARD §6.1 and the LF Agent Card WG consuming guide) and is genuinely deployed in production with the exact rel token, verified by live fetch of neon.com and specification.website. That clears the bar for keeping the check.
- [ ] TODO `agent-tools/webmcp-declarative-forms` — grade A (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/agent-tools/webmcp-declarative-forms.md)
  - Grade A. The signal is defined in a W3C Web Machine Learning CG explainer, has a named Baseline web feature (`declarative-webmcp`), a 17-test WPT conformance suite, first-party Chrome documentation with the identical attribute names, and named agent consumers (Brave Leo, Chrome 149 / Edge 150 origin trials).
- [ ] TODO `structured-data/speakable-schema` — grade A (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/structured-data/speakable-schema.md)
  - Grade A: a live vendor doc names a specific agent (Google Assistant) that reads the signal, and the feature is still listed in Google's current supported-features gallery, so the rubric mandates 'redeemable'. But it must be redeemed in narrowed form, not as-is: (a) applicability should be restricted to news/article publishers (the audit currently runs site-wide with no page-type gate and defaults to fail for every non-news site), and (b) the description's claim that Alexa and Siri consume speakable must be deleted — it is unsupported by any vendor doc and directly contradicted by Applebot's documentation, which lists isAccessibleForFree as its only schema.org property.
- [ ] TODO `access-crawl-control/sensitive-paths` — grade A (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/crawler-permissions/sensitive-paths.md)
  - Grade A on the mechanism: named AI crawlers are documented to honor path-level Disallow, with literal directory examples from Apple (Applebot and the AI-training token Applebot-Extended, 'Disallow: /private/') and Meta (meta-externalagent, 'Disallow: /private/ # Disallow a specific directory'), on top of the ratified RFC 9309 path-matching semantics that OpenAI and Anthropic both point publishers to. Per the rubric that makes it redeemable — but it needs surgery, not preservation as written.
- [ ] TODO `content-extraction/aside-element` — grade B (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/semantic-html/aside-element.md)
  - Grade B => redeemable, and the audit's stated mechanism is essentially verbatim correct. Which consumer reads the signal, and where documented: (a) Mozilla Readability removes `<aside>` via `this._clean(articleContent, "aside")` in Readability.js — the extractor behind Firefox Reader Mode, Jina Reader's readability path, and a long tail of LLM/agent tools; (b) trafilatura removes `<aside>` via its MANUALLY_CLEANED list in trafilatura/settings.py — a standard extractor in LLM corpus pipelines; (c) Chromium exposes `<aside>` as a `complementary` landmark in the accessibility tree that Anthropic's browser use tool returns from `read_page`, which I verified directly by snapshotting a probe page.
- [ ] TODO `answer-readiness/trust-signals` — grade B (approved 2026-08-21) · [dossier](../../../../docs/evidence/deletions/generative-engine/trust-signals.md)
  - Grade B: there is strong, quantified, multi-model empirical data that trust and social-proof cues in retrieved page text change which source an AI answer engine cites — 252,000 controlled trials, 4-5 of 6 models significant, plus a +17% 'Authoritative' effect in the KDD'24 GEO benchmark. Per the rubric that makes it redeemable, and unlike the other three audits here it has a real measured mechanism behind it.

## Proposed by first triage — pending approval — 15

- [ ] TODO `accessibility/form-error-messages` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/accessibility/form-error-messages.md)
  - Rebuild: verify aria-describedby/aria-errormessage linkage on invalid-state inputs instead of current broken heuristic. Evidence: a11y-tree consumption by computer-use agents graded A..
- [ ] TODO `agent-tools/webmcp-manifest` — target tier experimental (pending triage approval) · [dossier](../../../../docs/evidence/audits/agent-tools/webmcp-manifest.md)
  - Evidence reshape: the .well-known manifest file is invented (grade D) — but runtime-registered WebMCP tools are grade B: Google Lighthouse 13.3+ ships 'Registered WebMCP tools' audits in its new Agentic Browsing category. Replace manifest-file audit with registered-tools detection, experimental tier..
- [ ] TODO `access-crawl-control/ai-content-declaration` — target tier experimental (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/ai-content-declaration.md)
  - Evidence upgrade from delete: noai/noimageai/tdm-reservation declaration meta tags graded D/experimental — real emerging opt-out ecosystem, no ratified consumer yet. Experimental, unscored, rework to check the real directive names..
- [ ] TODO `answer-readiness/direct-definitions` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/answer-readiness/direct-definitions.md)
  - Rework detector: language-neutral structural signals (dfn/dl semantics, first-sentence definition patterns per detected language), notApplicable when page has no definitional intent..
- [ ] TODO `answer-readiness/meta-description-aeo` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/answer-readiness/meta-description-aeo.md)
  - Redeem via merge into meta-description: one audit, quality criteria without the invented 'AEO formula'..
- [ ] TODO `content-discoverability/mobile-friendly` — target tier informative (pending triage approval) · [dossier](../../../../docs/evidence/audits/content-discoverability/mobile-friendly.md)
  - Keep viewport check as unscored diagnostic; no claimed AI mechanism..
- [ ] TODO `access-crawl-control/bytespider` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/bytespider.md)
  - Consolidate all low-signal per-bot audits into one 'ai-bot-directives' audit: parse robots.txt once, informational per-bot table, score only on documented-active bots..
- [ ] TODO `access-crawl-control/cohere-ai` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/cohere-ai.md)
  - Same consolidation into ai-bot-directives..
- [ ] TODO `access-crawl-control/youbot` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/youbot.md)
  - Same consolidation into ai-bot-directives..
- [ ] TODO `access-crawl-control/diffbot` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/diffbot.md)
  - Same consolidation into ai-bot-directives..
- [ ] TODO `access-crawl-control/ai2bot` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/ai2bot.md)
  - Same consolidation into ai-bot-directives..
- [ ] TODO `access-crawl-control/tdm-rep` — target tier experimental (pending triage approval) · [dossier](../../../../docs/evidence/audits/access-crawl-control/tdm-rep.md)
  - TDM Reservation Protocol is a real W3C CG spec with EU AI Act relevance. Experimental flag, unscored, fix internal incoherence..
- [ ] TODO `answer-readiness/twitter-card` — target tier informative (pending triage approval) · [dossier](../../../../docs/evidence/audits/answer-readiness/twitter-card.md)
  - Fix factual errors (twitter:* falls back to og:*), fold into social-meta diagnostic with core-open-graph, unscored. Evidence: og:title/og:site_name graded A; twitter:* has no AI consumer evidence..
- [ ] TODO `meta-tags/openapi-link` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/meta-tags/openapi-link.md)
  - Redeem via merge into agent-tools/openapi-exists: one discovery audit for real mechanisms incl. RFC 9727 api-catalog (graded B), drop link-tag requirement that fails every site..
- [ ] TODO `technical-readiness/cors-api-routes` — target tier scored (pending triage approval) · [dossier](../../../../docs/evidence/audits/technical-readiness/cors-api-routes.md)
  - Keep scored but notApplicable unless site exposes a public API surface agents would call cross-origin..
