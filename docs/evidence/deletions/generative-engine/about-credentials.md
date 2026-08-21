---
audit: generative-engine/about-credentials
category: generative-engine
status: informative
verdict: dead-but-informative-candidate
evidence_grade: C
reviewed: 2026-08-21
---

# about-credentials — dead as scored audit — informative candidate (weight 0)

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **C**.

## Claimed mechanism (steelmanned)

Steelmanned: AI answer engines and their upstream search indexes build an organization-level authority profile, and the About page is the canonical artifact where a site declares who is responsible for it and what expertise it holds. If an AI engine (or the ranking system feeding it) reads that page and weights self-declared credentials — team bios, years of experience, certifications — then a site whose About page lacks credential language would be assessed as lower-authority and cited less often in generative answers. The falsifiable claim is narrower than 'have an About page': it is that the PRESENCE OF CREDENTIAL KEYWORDS ('team', 'experience', 'certified', 'specializ', 'professional') on the About page is read by some named consumer and raises trust/citation likelihood.

## What we searched

WebSearch budget for the session was exhausted, so I went directly at primary sources with WebFetch. I fetched Google's creating-helpful-content doc (the canonical E-E-A-T page), Google's AI features doc (AI Overviews/AI Mode requirements), Google's Organization structured data reference (to see where Google says organization identity belongs), and the full Search Quality Rater Guidelines PDF dated September 11, 2025 — which I extracted locally with pdftotext and grepped for 'about us page', 'who is responsible', 'reputation research', and 'verifiable credentials'. For empirical answer-engine evidence I bypassed WebSearch by querying the arXiv API directly for 30 recent GEO/AEO papers, then fetched the GEO paper (2311.09735, KDD'24), the 2023-2026 GEO critical survey (2607.14035), the large-scale brand-visibility study (2606.20065), and the UK iGaming brand-notability study (2603.12282). I also checked OpenAI's crawler docs, Anthropic's crawler support article, and Perplexity's bot docs for any statement that About pages or credentials are read.

## Best evidence found for the audit

Two real supports exist for the ABOUT PAGE as an artifact, neither for the keyword heuristic. (1) Google's Search Quality Rater Guidelines (Sept 11, 2025), section 2.5.2 'Finding Who is Responsible for the Website and Who Created the Content on the Page': 'Most websites have "contact us" or "about us" or "about" pages that provide information about who owns the site.' Section 3.3 makes reputation research mandatory: 'reputation research is required for all PQ rating tasks.' (2) Google's Organization structured data doc recommends placing it 'on your home page, or a single page that describes your organization, for example the about us page.' Google's creating-helpful-content page also asks 'Is it self-evident to your visitors who authored your content?' and recommends 'adding accurate authorship information, such as bylines.' No source anywhere names credential keywords as a read signal.

## Counter-evidence

The vendor doc closest to this audit explicitly inverts it. Search Quality Rater Guidelines section 5.6, 'Exaggerated or Mildly Misleading Information about the Website or Content Creator': 'sometimes the information about the website or content provider seems exaggerated or mildly misleading, such as claims of personal experience or expertise that seem overstated or included just to impress website visitors. E-E-A-T assessments should be based on the MC itself, the information you find during reputation research, verifiable credentials, etc, not just website or content creator claims of "I'm an expert!"' The audit rewards exactly the self-claim that Google tells raters to discount, and flags padding an About page with expertise language as a demotion risk. Further: (a) Google states outright 'While E-E-A-T itself isn't a specific ranking factor' (developers.google.com/search/docs/fundamentals/creating-helpful-content); (b) Google's AI features doc states 'There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' and 'There are no additional technical requirements'; (c) the KDD'24 GEO paper, the strongest controlled GEO study, does not test about pages, author credentials, or site-level authority at all — it is explicitly confined to 'textual modifications to website content ... while not affecting other metadata'; (d) arXiv 2603.12282 finds 'AI Search exhibits a systematic and overwhelming bias towards Earned media (third-party, authoritative sources) over Brand-owned content' with ~78% of citations to earned media, which is the opposite of a mechanism where self-authored credential text drives trust; (e) the rater guidelines' consumer is a human contractor whose scores calibrate systems, not an AI agent parsing the page. OpenAI, Anthropic, and Perplexity crawler docs contain no mention of About pages or credentials.

## Verdict

**dead as scored audit — informative candidate (weight 0)** (grade C)

The keyword heuristic is grade D on its own — no documented consumer, and Google's rater guidelines specifically instruct evaluators NOT to credit self-claimed expertise language, so the audit optimizes toward a documented demotion risk. What survives at grade C is the weaker, universally adopted convention that a site should have a page identifying who is responsible for it, which Google both documents in the rater guidelines and names as the recommended host for Organization structured data. Adoption of that convention is genuinely wide. So keep it only if re-specified: drop keyword scoring entirely, check for the existence of an About/Organization identity page and for machine-readable Organization/Person markup with sameAs (third-party corroboration, which matches the earned-media bias the research documents), and demote it to informative. As currently implemented — pass/warn on two credential keywords — it is dead and should not be scored.

## Sources

- **[Search Quality Rater Guidelines: General Guidelines (September 11, 2025)](https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf)** — Google (vendor-doc, URL verified 2026-08-21)
  - Section 2.5.2 directs raters to 'about us' pages to find who is responsible for a site; section 3.3 makes reputation research mandatory for all Page Quality tasks. But section 5.6 states E-E-A-T assessments must rest on the main content, reputation research and 'verifiable credentials, etc, not just website or content creator claims of "I'm an expert!"', and treats overstated expertise claims 'included just to impress website visitors' as a negative. Directly contradicts a keyword-presence audit.
- **[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - States 'While E-E-A-T itself isn't a specific ranking factor, using a mix of factors that can identify content with good E-E-A-T is useful.' Recommends bylines and self-evident authorship; says nothing about About-page credential keywords.
- **[AI features and your website (AI Overviews and AI Mode)](https://developers.google.com/search/docs/appearance/ai-features)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - 'There are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary.' No E-E-A-T, credential, or trust-signal requirement is introduced for AI features.
- **[Organization (Organization) structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)** — Google Search Central (vendor-doc, URL verified 2026-08-21)
  - Recommends placing Organization markup 'on your home page, or a single page that describes your organization, for example the about us page'. Supported properties are identity/contact/registry fields (name, logo, sameAs, vatID, duns, leiCode) — there are no credential, expertise, or award properties at Organization level.
- **[GEO: Generative Engine Optimization](https://arxiv.org/abs/2311.09735)** — arXiv / KDD 2024 (study, URL verified 2026-08-21)
  - Boosts visibility up to 40%; nine methods tested (Quotation Addition +41%, Statistics +33%, Fluency +29%, Cite Sources +28%, Technical Terms +19%, Authoritative +17%, Easy-to-Understand +14%, Unique Words +6%, Keyword Stuffing -9%). Explicitly scoped to on-page text, not metadata or site-level authority; does not study about pages, credentials, or trust badges.
- **[Algorithmic Trust and Compliance: Benchmarking Brand Notability for UK iGaming Entities](https://arxiv.org/abs/2603.12282)** — arXiv (study, URL verified 2026-08-21)
  - 'AI Search exhibits a systematic and overwhelming bias towards Earned media (third-party, authoritative sources) over Brand-owned content'; ~78% of citations go to earned media. Compliance/regulatory signals act as authority multipliers, but derive force from third-party validation rather than self-hosted claims.
- **[OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - Documents GPTBot, OAI-SearchBot and ChatGPT-User with user agents, IP ranges and robots.txt controls only. No mention of About pages, credentials, authority signals, rendering, or link relations.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - Covers ClaudeBot, Claude-User, Claude-SearchBot purposes and robots.txt/Crawl-delay handling only. No documented content-selection, authority, credential, or rendering behavior.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **informative** (kept as informative, weight 0).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
