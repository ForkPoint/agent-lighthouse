# Not a factor — sunset audits

26 audits shipped in Agent Lighthouse v1 claimed signals that our 2026-08-21 adversarial research could not redeem: no consumer reads them, or the only consumer publicly stopped. Per the [evidence policy](../policy.md) a grade-D audit may not carry score weight, and no consumer was found for any of these — so they are **removed outright** in this major release rather than lingering as informative. This page condenses why each one does not matter — with the evidence — so nobody has to re-litigate them, and so sites that were told to add these signals know they can stop.

Consumers that keyed on these check ids should read [`migration-map.json`](../../../packages/core/migration-map.json), which maps each removed v1 id to its slug, `status: "removed"`, and the anchor on this page.

Each entry links its full research dossier (steelmanned claim, search trail, all sources).

### `accessibility/marquee`

**Claimed:** Steelmanned: deprecated presentational elements like `<marquee>` and `<blink>` have undefined semantics and unstable text content, so an agent parsing the DOM reads meaningless or shifting content where they appear.

**Why it is not a factor:** The stated mechanism is false, and the rule's real basis is a criterion this module explicitly excludes. A `<marquee>`'s text is ordinary, stable DOM text — only its rendered position animates — and `<blink>` has not rendered in any shipping browser for over a decade. axe's own rationale for the rule is human perception, not parsing: marquee elements "increase difficulty for users with limited dexterity, and are distracting for users with cognitive or attention deficits", mapped to WCAG 2.2.2 Pause, Stop, Hide (Level A). The accessibility-tree representation agents actually consume carries role, accessible name, ARIA state and text content, none of which motion affects. In practice the audit is inapplicable on effectively 100% of modern pages, so it never discriminates between sites — and its `none: ['is-on-screen']` composition means even a real hidden `<marquee>` would pass.

**Verdict:** Grade D. The parsing claim is unfounded, the genuine basis is a human-perception WCAG criterion outside this module's charter, and no consumer — agent or otherwise — is documented to read the signal.

**Key sources:** [axe marquee rule](https://dequeuniversity.com/rules/axe/4.10/marquee) · [MDN `<marquee>` (deprecated)](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/marquee) · [Aria snapshots](https://playwright.dev/docs/aria-snapshots) · [chrome-devtools-mcp tool reference](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md) — full evidence: [dossier](./accessibility/marquee.md)

### `accessibility/skip-nav`

**Claimed:** Steelmanned: agent browsers that read a page as an accessibility tree (Anthropic's browser-use `read_page`, Playwright/Playwright-MCP aria snapshots, browser-use) must spend tokens/latency on repeated navigation chrome before reaching primary content.

**Why it is not a factor:** 1) The audit's own description names Claude computer use as a consumer of the accessibility tree — that is affirmatively false. Anthropic's computer-use doc describes perception as "screenshot capabilities and mouse/keyboard control", with zoom for illegible regions, and contains no mention of an accessibility tree or DOM; it explicitly contrasts this with the separate browser use tool whose "member tools read and act on the page itself" (https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool).

**Verdict:** Grade D. The a11y tree is genuinely read by named agents (Anthropic browser use tool), but nothing in that chain consumes a skip link: agents get the whole tree at once, so there is nothing to skip, and the `main` landmark already provides the addressable content boundary the audit says skip links provide.

**Key sources:** [Computer use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/computer-use-tool) · [Browser use tool](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/browser-use-tool) · [Aria snapshots](https://playwright.dev/docs/aria-snapshots) — full evidence: [dossier](./accessibility/skip-nav.md)

### `agent-tools/ai-plugin-json`

**Claimed:** Steelmanned: /.well-known/ai-plugin.json was a genuine, vendor-defined manifest — OpenAI specified it, ChatGPT read it to install third-party plugins, and it carried fields (name_for_model, description_for_model, api.url pointing at an OpenAPI spec) purpose-built for model consumption rather than human display.

**Why it is not a factor:** Direct positive proof of discontinuation: (1) OpenAI's official openai/plugins-quickstart repository is ARCHIVED (GitHub API archived=true), with last push 2024-01-30T23:23:11Z, and its README states verbatim: 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' (2) OpenAI deleted the manifest specification from its docs entirely: the audit's own docsUrl https://platform.openai.com/docs/plugins/getting-started/plugin-manifest 301-redirects to https://developers.openai.com/api/docs/actions, which returns HTTP 404.

**Verdict:** Grade D: the sole documented consumer (ChatGPT plugins) was discontinued, OpenAI archived its official quickstart with an explicit 'superseded by GPTs' notice, and OpenAI removed the manifest spec from its documentation so thoroughly that the audit's own docsUrl now 404s. No successor vendor adopted the format; OpenAI itself moved to MCP via the Apps SDK.

**Key sources:** [openai/plugins-quickstart (ARCHIVED) — official ChatGPT plugin quickstart](https://github.com/openai/plugins-quickstart) · [OpenAI plugin manifest documentation — removed (301 to 404)](https://platform.openai.com/docs/plugins/getting-started/plugin-manifest) · [OpenAI Apps SDK — current third-party extensibility, built on MCP](https://developers.openai.com/apps-sdk/) — full evidence: [dossier](./agent-tools/ai-plugin-json.md)

### `agent-tools/data-action-ctas`

**Claimed:** The audit's own description asserts that "data-action attributes help AI browser agents (like ChatGPT Browse and Google Mariner) identify clickable CTAs", and that data-action / data-action-type / data-action-label let an agent know which elements are interactive and what each does.

**Why it is not a factor:** Positive proof of harm, not just absence. (1) `data-action` is already owned by Stimulus/Hotwire (shipped with Rails) with completely unrelated semantics: per stimulus.hotwired.dev/reference/actions its value is an event descriptor `event->controller#method` (e.g. "click->gallery#next", "keydown.esc->modal#close", "resize@window->gallery#layout").

**Verdict:** Grade D: speculative attribute with no documented consumer at any vendor, plus active namespace collision with Stimulus/Hotwire that makes the check unsound even as a heuristic (a Rails site passes for the wrong reason; a well-marked-up React site fails despite perfect semantics).

**Key sources:** [Stimulus Reference — Actions](https://stimulus.hotwired.dev/reference/actions) · [Tools: Connectors and MCP](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) · [Getting started with Claude in Chrome](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome) — full evidence: [dossier](./agent-tools/data-action-ctas.md)

### `agent-tools/openapi-ai-instructions`

**Claimed:** Steelmanned: OpenAPI's `x-` prefix is the spec's sanctioned extension point, and vendors genuinely do define AI-relevant extensions there (OpenAI's x-openai-isConsequential is a real, widely used example).

**Why it is not a factor:** Positive proof of non-standing: (1) x-ai-instructions is NOT registered in the OpenAPI Initiative's official extensions registry at spec.openapis.org/registry/extension/. That registry lists 36 registered extensions (x-agent-trust, x-codeSamples, x-data-classification, x-jsonld-context, the x-oai-* and x-jsonschema-* families, x-sensitive-data, x-twitter) and contains NO x-ai-* extension of any kind — so the field has no standing even as a registered vendor extension.

**Verdict:** Grade D: an unregistered, vendor-less extension key with no documented consumer and adoption that is essentially self-referential (a single blogger's archive plus this framework's own site). The control comparison is what makes this conclusive — a real vendor-documented AI extension shows 6,464 hits while this shows 54, so the low count reflects invention rather than early-stage adoption.

**Key sources:** [OpenAPI Initiative — Specification Extensions Registry](https://spec.openapis.org/registry/extension/) · [GitHub code search: x-ai-instructions vs x-openai-isConsequential](https://github.com/search?q=%22x-ai-instructions%22&type=code) · [GPT Actions — Introduction (checked for AI OpenAPI extensions)](https://developers.openai.com/api/docs/actions/introduction) — full evidence: [dossier](./agent-tools/openapi-ai-instructions.md)

### `agent-tools/webmcp-action-coverage`

**Claimed:** An e-commerce site should expose WebMCP tools spanning the full purchase journey (product search, product detail, add to cart, checkout, account, support).

**Why it is not a factor:** Positive proof, not mere absence.

**Verdict:** Grade D. The audit's primary evidence source, /.well-known/webmcp, is not merely unspecified — it is a design the WebMCP explainer considered and rejected by name, and Chrome's docs state WebMCP is client-side-only with the page as the tool registry, making a static manifest structurally unreadable by any agent.

**Key sources:** [WebMCP explainer — Alternatives Considered §2: Static Declarative Manifests](https://raw.githubusercontent.com/webmachinelearning/webmcp/main/README.md) · [Chrome modern-web-guidance: guides/webmcp/webmcp](https://raw.githubusercontent.com/GoogleChrome/modern-web-guidance-src/main/guides/webmcp/webmcp/guide.md) · [Agentic Commerce Protocol — Agentic Checkout Spec](https://developers.openai.com/commerce/specs/checkout) — full evidence: [dossier](./agent-tools/webmcp-action-coverage.md)

### `content-discoverability/commerce-links`

**Claimed:** Steelmanned: exposing crawlable return, shipping and seller-identity links (and, in the wider form, machine-readable add-to-cart or deep-checkout URLs, whether as raw links or via schema.org `BuyAction`/`potentialAction` target EntryPoints) lets shopping agents discover a merchant, verify its policies, and transact — the transparency floor for "Instant Checkout" readiness.

**Why it is not a factor:** Every published shopping-agent architecture in 2026 is feed-plus-API with out-of-band merchant registration, explicitly not crawl-and-deep-link. OpenAI and Stripe's Agentic Commerce Protocol defines the checkout and delegated-payment OpenAPI specs and contains no website-side discovery mechanism whatsoever — no well-known URL, no HTML link tag, no sitemap- or markup-based endpoint discovery. OpenAI's Product Feed Spec has exactly two URL fields, `url` ("Product detail page URL", which "must resolve with HTTP 200") and `seller_url` derived from it, and no add-to-cart, cart, or checkout field at all; feeds are pushed as uploaded TSV/CSV, not crawled. Google's AP2 is orthogonal — it standardises payment authorisation via signed Intent/Cart/Payment mandates and likewise defines no deep links or web-discovery affordance. schema.org `BuyAction` exists, but no AI or shopping-agent vendor documents consuming it. The implementation compounds this: English-only substring matching over the homepage's anchors fails the default Shopify store ("Refund policy" at `/policies/refund-policy` contains no "return") and every non-English storefront.

**Verdict:** Grade D. No shopping agent discovers or verifies a merchant by crawling policy or cart links. The one genuinely load-bearing sub-claim — ACP requires the product-detail URL to resolve 200 — is a URL-health property, not a commerce-links property.

**Key sources:** [Agentic Commerce Protocol (ACP) specification repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) · [Product Feed Spec — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/specs/feed) · [Key concepts — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/guides/key-concepts) · [AP2 — Agent Payments Protocol](https://github.com/google-agentic-commerce/AP2) · [BuyAction — schema.org Type](https://schema.org/BuyAction) — full evidence: [dossier](./content-discoverability/commerce-links.md)

### `content-discoverability/mobile-friendly`

**Claimed:** Steelmanned: a `<meta name="viewport">` tag signals mobile-friendliness, AI crawlers may prioritise mobile-friendly content, and many AI-powered searches originate from mobile devices — so the tag's absence costs visibility.

**Why it is not a factor:** This is a mobile-SEO artifact with no bearing on how an AI agent ingests a page. LLM crawlers fetch and parse raw HTML and never lay out a viewport, so a viewport meta tag cannot change anything they read. The stated impact ("AI crawlers may deprioritize pages without a viewport meta tag") is speculation presented as fact, and because the tag ships in every modern framework template the check discriminates almost nothing. It also never inspects the tag's value, so `content="width=1024, user-scalable=no"` — genuinely not mobile-friendly — passes, while a fully responsive CSS-only site fails. The audit's name promises a rendering assessment that a single static meta tag cannot support.

**Verdict:** Grade unrated → removed. The only audit in the v1 set for which no evidence signal could be researched at all: the claimed mechanism requires a layout engine that no AI crawler runs, and no consumer was found to name.

**Key sources:** _none — no dedicated evidence signal existed to research; the removal rests on the mechanism being unavailable to non-rendering clients_ — full evidence: [dossier](./content-discoverability/mobile-friendly.md)

### `content-discoverability/navigation-json`

**Claimed:** Serving a `/navigation.json` at the site root gives AI agents a machine-readable site-hierarchy map (labels, URLs, nested children), letting them plan multi-step browsing without inferring structure from HTML.

**Why it is not a factor:** Positive proof that the job is already done by real, adopted mechanisms, and that the leading conventions deliberately chose different formats. (1) schema.org/SiteNavigationElement is an active schema.org type for exactly this purpose ("a navigation element of the page", properties name/url/position, inherits WebPageElement) with measured adoption of "1M - 10M Domains Based on monthly aggregations from Google's web index" as of July 2026 — a real, consumed, million-domain standard for machine-readable navigation that /navigation.json duplicates with zero consumers.

**Verdict:** Grade D. No spec defines /navigation.json, no vendor crawler documents fetching it, no study measures an effect, and the wild instances are build-time docs configs rather than the audited artifact. Adoption as an agent signal is effectively zero, so it does not qualify as dead-but-informative either.

**Key sources:** [SiteNavigationElement](https://schema.org/SiteNavigationElement) · [The /llms.txt file](https://llmstxt.org/) · [Web Model Context API (WebMCP) draft specification](https://webmachinelearning.github.io/webmcp/) — full evidence: [dossier](./content-discoverability/navigation-json.md)

### `generative-engine/pagination-links`

**Claimed:** Steelmanned: AI crawlers that build knowledge bases must traverse paginated archives (blog indexes, category listings) completely, or their coverage of the site is truncated at page one.

**Why it is not a factor:** Two independent positive proofs of uselessness. (1) Vendor renunciation: Google's current pagination documentation states flatly 'Google no longer uses these tags', and directs site owners to a different mechanism instead — 'consider using a sitemap file or a Google Merchant Center feed to help Google find all of the products on your site.' The only crawler that ever documented consuming these tags publicly dropped them.

**Verdict:** Grade D. The only named consumer in history publicly stopped using the signal, no AI crawler or answer engine documents reading it, no empirical study measures it, and the specific form the audit checks — rel=prev/next on a head <link> element — is explicitly 'not allowed' by the WHATWG HTML Standard, so the audit's own remediation advice produces invalid HTML.

**Key sources:** [Pagination and incremental page loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) · [HTML Standard — 4.6.8 Link types (next, prev)](https://html.spec.whatwg.org/multipage/links.html#sec-link-types) · [Link Relation Types registry](https://www.iana.org/assignments/link-relations/link-relations.xhtml) — full evidence: [dossier](./generative-engine/pagination-links.md)

### `meta-tags/ai-instructions`

**Claimed:** An HTML <meta name="ai-instructions" content="..."> tag acts as a site-authored, page-scoped system prompt: AI crawlers, answer engines and browsing agents parse it out of <head> and let it shape how they summarize, frame, or refuse to speculate about the page.

**Why it is not a factor:** 1) Google explicitly discards unrecognized meta tags: 'You can use other meta tags if they are important to your site, but Google will ignore meta tags that it doesn't support' — and the supported list is description, robots/googlebot, notranslate, nopagereadaloud, google-site-verification, Content-Type/charset, refresh, viewport, rating. No AI-instruction tag (https://developers.google.com/search/docs/crawling-indexing/special-tags).

**Verdict:** Grade D: no spec defines it, no vendor reads it, the one standards body working on the problem explicitly chose HTTP headers and robots.txt over embedded markup, and Google states it ignores unsupported meta tags outright.

**Key sources:** [Meta tags and HTML attributes that Google supports](https://developers.google.com/search/docs/crawling-indexing/special-tags) · [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) · [draft-ietf-aipref-attach: Attaching AI Preferences to Content](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/) — full evidence: [dossier](./meta-tags/ai-instructions.md)

### `meta-tags/llms-full-txt-link`

**Claimed:** Emitting <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt"> in <head> gives agents a machine-readable discovery hook so they can choose the full-content dump over the llms.txt summary based on their context budget.

**Why it is not a factor:** 1) Direct wire test: of the five biggest publishers checked, four emit NO llms link tag whatsoever in <head> despite serving llms-full.txt — platform.claude.com/en/docs/overview (27 <link> tags, zero mentioning llms), mintlify.com/docs (20, zero), docs.stripe.com (18, zero), vercel.com/docs (31, zero). The fifth, docs.github.com, uses rel="index" type="text/markdown" pointing at llms.txt. So the audit's detection pattern matches zero of the sites it would be grading, including Anthropic's own docs.

**Verdict:** Grade D. This is a compound of two invented layers: a filename the spec never defines, plus a link-relation/MIME-type combination that appears in no spec and, per direct HTML inspection, on none of the major sites that actually publish the file — Anthropic, Vercel, Mintlify and Stripe all emit zero llms link tags.

**Key sources:** [The /llms.txt file — link relation guidance](https://llmstxt.org/) · [GitHub Docs homepage HTML (live head inspection)](https://docs.github.com/en) · [Anthropic developer docs page HTML (live head inspection)](https://platform.claude.com/en/docs/overview) — full evidence: [dossier](./meta-tags/llms-full-txt-link.md)

### `meta-tags/mcp-discovery-link`

**Claimed:** Steelmanned: this is the most genuinely promising of the four, because the need is real and acknowledged by MCP's own maintainers.

**Why it is not a factor:** Positive proof that the specific checked signal has no consumer: (1) GitHub code search across the entire modelcontextprotocol/modelcontextprotocol repository for rel="mcp" returns total_count=0 — no HTML link-rel discovery appears in any MCP spec, draft, SEP, or blog post.

**Verdict:** Grade D for the signal as implemented. The audit checks for `<link rel="alternate" type="application/json" title="MCP">` or rel="mcp-discovery" in HTML head — a construct that appears nowhere in MCP's specs, drafts, or SEPs (code search: 0 hits), that no MCP client parses, and that Anthropic's own connector docs contradict by requiring manual URL entry.

**Key sources:** [MCP Specification 2026-07-28 — Discovery (server/discover)](https://modelcontextprotocol.io/specification/2026-07-28/server/discover.md) · [MCP Specification 2025-06-18 — Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization) · [SEP-1649: MCP Server Cards — HTTP Server Discovery via .well-known](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649) — full evidence: [dossier](./meta-tags/mcp-discovery-link.md)

### `semantic-html/address-element`

**Claimed:** Steelmanned: answer engines routinely field 'how do I contact X' queries.

**Why it is not a factor:** Positive proof of uselessness on three fronts. (1) Vendor mechanism is elsewhere and explicit: Google's LocalBusiness structured-data documentation specifies contact data via JSON-LD schema.org — `address` as a `PostalAddress` object with streetAddress/addressLocality/addressRegion/postalCode/addressCountry, and `telephone` for phone — and never mentions the HTML `<address>` element anywhere (https://developers.google.com/search/docs/appearance/structured-data/local-business). The documented consumer reads schema.org, not the tag.

**Verdict:** Grade D. There is no consumer — not a crawler, not an extractor, not an agent. The a11y tree flattens `<address>` to an unnamed generic node indistinguishable from a div (verified live), trafilatura strips the tag entirely, and Google's own contact-info documentation routes exclusively through schema.org PostalAddress/telephone without ever naming the element.

**Key sources:** [Local business (LocalBusiness) structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) · [WHATWG HTML — the address element](https://html.spec.whatwg.org/multipage/sections.html) · [trafilatura/settings.py — MANUALLY_STRIPPED](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/settings.py) — full evidence: [dossier](./semantic-html/address-element.md)

### `semantic-html/decorative-images`

**Claimed:** Steelmanned: an agent walking the accessibility tree encounters `<img alt="">`. If the agent could not tell an intentionally-decorative image from one whose alt text an author simply forgot, it would either hallucinate a missing-content gap or burn processing on irrelevant images.

**Why it is not a factor:** Positive, normative proof that the required attribute is a no-op. W3C HTML Accessibility API Mappings 1.0 §3.5.57 specifies that an `img` element with an empty `alt` attribute maps to role "none or presentation" — i.e. `alt=""` ALREADY confers exactly the role the audit demands authors write out, with the only exception being an img that gains an accessible name through another naming mechanism (which is the opposite case from the audit's).

**Verdict:** Grade D. The required signal is normatively redundant: HTML-AAM 1.0 §3.5.57 states an img with empty alt maps to role none/presentation already, and a live Chromium accessibility snapshot shows `<img alt="">` and `<img alt="" role="presentation">` producing an identical result — both absent from the tree.

**Key sources:** [HTML Accessibility API Mappings 1.0 — §3.5.57 img element](https://www.w3.org/TR/html-aam-1.0/) · [Live Chromium accessibility snapshot of a probe page (own experiment)](https://playwright.dev/docs/aria-snapshots) · [ARIA in HTML](https://www.w3.org/TR/html-aria/) — full evidence: [dossier](./semantic-html/decorative-images.md)

### `structured-data/action-schema`

**Claimed:** In an end-to-end agentic checkout, the agent needs a machine-readable signal that the transaction actually completed rather than having to read a thank-you page in natural language.

**Why it is not a factor:** (1) Near-zero deployment: ConfirmAction < 1K domains worldwide (schema.org/ConfirmAction, July 2026 aggregation) — below the threshold at which any crawler would build a parser for it. (2) The real agentic-checkout standard deliberately does not use it: OpenAI/Stripe's Agentic Commerce Protocol handles completion over its own checkout API/MCP surface, and OpenAI's feed spec states 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path' — agents confirm via API response, never by scraping a thank-you page.

**Verdict:** Grade D. The claimed mechanism does not correspond to how any shipping agentic-commerce system works: OpenAI/Stripe's ACP confirms transactions over an API/MCP surface and explicitly excludes semantic-markup sources, and Google routes reservations and orders through the Maps Booking API rather than page markup. Deployment is effectively nil (ConfirmAction < 1K domains globally).

**Key sources:** [schema.org: ConfirmAction](https://schema.org/ConfirmAction) · [One Click Action reference (Gmail markup)](https://developers.google.com/workspace/gmail/markup/reference/one-click-action) · [Agentic Commerce Protocol](https://www.agenticcommerce.dev/) — full evidence: [dossier](./structured-data/action-schema.md)

### `structured-data/potential-action`

**Claimed:** An agent that can read a machine-readable list of the actions a site affords (order here, book here, contact here) can deep-link a user straight to the transactional endpoint instead of paraphrasing the page.

**Why it is not a factor:** Positive proof on several fronts. (1) THE AUDIT'S OWN TYPES ARE PARTLY INVENTED: `ContactAction` and `BookAction` are not schema.org types. https://schema.org/ContactAction and https://schema.org/BookAction both return HTTP 404, and the official vocabulary dump contains 0 occurrences of schema:ContactAction and 0 of schema:BookAction (vs. 2 for schema:OrderAction). Two of the three types this audit accepts as a PASS — and names in its user-facing fix guidance — do not exist, so the audit can green-light invalid markup and instruct users to publish nonexistent vocabulary.

**Verdict:** Grade D.

**Key sources:** [schema.org current vocabulary (schemaorg-current-https.jsonld)](https://schema.org/version/latest/schemaorg-current-https.jsonld) · [Google Search documentation updates — sitelinks search box removed](https://developers.google.com/search/updates#bye-sitelinkbox) · [Local business (LocalBusiness) structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) — full evidence: [dossier](./structured-data/potential-action.md)

### `technical-readiness/framework-detection`

**Claimed:** Steelmanned two ways. (a) Diagnostic proxy: framework identity predicts rendering mode, so detecting Create React App or a Vue SPA is an early warning that the page is invisible to non-rendering AI crawlers, and detecting Next.js/Astro/Nuxt predicts server-rendered HTML.

**Why it is not a factor:** (1) Google states the opposite of the audit's premise. Its JavaScript SEO guidance names no framework and frames the question purely as rendering outcome: content must be in the DOM, links must be real <a href> anchors, 'once Google's resources allow, a headless Chromium renders the page'. Framework choice is presented as irrelevant to Google's ability to process the page.

**Verdict:** Grade D. There is no documented consumer: no vendor treats framework choice as an AI-readiness factor, and Google explicitly frames the issue as rendering outcome rather than tooling. The purpose-built agent-readiness literature does not include framework identity among its dimensions.

**Key sources:** [JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) · [Designing Agent-Ready Websites for AI Web Agents](https://arxiv.org/abs/2607.12056) · [OpenAI crawlers and user agents](https://developers.openai.com/api/docs/bots) — full evidence: [dossier](./technical-readiness/framework-detection.md)

### `technical-readiness/image-dimensions`

**Claimed:** Steelmanned: AI agents that work from visual screenshots (Claude computer use and peers) need stable page layouts to identify interactive elements; missing `width`/`height` on images causes layout shifts that move elements between screenshots and break coordinate-based click targeting in agentic workflows.

**Why it is not a factor:** Layout stability is a rendering-path property, and the dominant consumer class has no rendering path. Vercel and MERJ measured zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance — these clients parse the raw HTML response and never construct a render tree, so CLS is unmeasurable for them by construction. The partial exception is scoped and unhelpful: browser-resident agents (ChatGPT Atlas, Perplexity Comet, Gemini in Chrome, Claude in Chrome) and the two rendering crawlers (Gemini via Googlebot's evergreen Chromium, and Applebot, which Apple says "may render the content of your website within a browser") do experience layout cost, but only as wall-clock task latency inside the agent — not as indexing or citation effect — and no vendor documents it. The specific AI claim is also refuted by how computer-use agents operate: they re-screenshot before acting, so a shift between frames does not persist as a mis-click. The detection method compounds it by ignoring CSS `aspect-ratio`, the modern framework default, so correctly-stable pages fail.

**Verdict:** Grade D. A CLS audit in an AI costume: the mechanism needs a renderer the dominant AI crawlers do not run, and the one AI-specific mechanism claimed is contradicted by agent behaviour.

**Key sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents)](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — full evidence: [dossier](./technical-readiness/image-dimensions.md)

### `technical-readiness/lcp-not-lazy`

**Claimed:** Steelmanned: agents that work from visual screenshots see a blank placeholder where a lazy-loaded hero image should be and miss critical visual context; separately, lazy-loading the LCP element degrades Core Web Vitals, which AI trust-scoring systems factor into content-quality rankings.

**Why it is not a factor:** LCP is a rendering-path metric, and a client with no rendering path never produces one. Vercel and MERJ found zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance; those clients parse raw HTML and never construct a render tree. The "AI trust-scoring systems factor Core Web Vitals into rankings" chain has no named consumer at any vendor. The only crawler-side performance variable with a documented effect is origin response latency, which Google ties directly to crawl volume ("If the site slows down… the limit goes down and Google crawls less") — that belongs to the response-time signal, not here. Even for the rendering exceptions (Gemini via Googlebot's Chromium, Applebot, and the browser-resident agents) the cost is task latency, undocumented by any vendor. The implementation adds an independent defect: `images[0]` in DOM order is the header logo or a tracking pixel on most sites, so the audit asserts a verdict about an element it never identified.

**Verdict:** Grade D. The mechanism requires a renderer the dominant AI crawlers do not run, and the trust-scoring chain it invokes is undocumented by every vendor named.

**Key sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents)](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — full evidence: [dossier](./technical-readiness/lcp-not-lazy.md)

### `technical-readiness/no-render-blocking`

**Claimed:** Steelmanned: render-blocking synchronous scripts in `<head>` delay the HTML that AI crawlers extract; since AI agents do not execute JavaScript, those scripts add latency without providing any benefit, so `defer`/`async`/`type=module` unblocks HTML delivery to them.

**Why it is not a factor:** The rationale is self-refuting. An HTTP crawler that does not execute JavaScript also does not fetch `<script src>` at all, so head scripts cost a non-executing AI crawler exactly nothing. Vercel and MERJ confirm zero JavaScript execution across GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Meta and ByteDance — render-blocking analysis is a property of a browser's critical rendering path, and these clients have none. Only browser-resident agents and the two rendering crawlers (Gemini via Googlebot's evergreen Chromium, and Applebot) bear any cost, and only as wall-clock task latency that no vendor documents. The genuinely load-bearing crawler-side variable is origin response latency, which Google ties to crawl volume and which the fast-response-time audit already covers. The implementation also ignored the dominant render-blocking resource — `<link rel=stylesheet>` in `<head>` — entirely.

**Verdict:** Grade D, with `delete` as the research's own recommended disposition. The mechanism needs a rendering path the dominant clients do not have, and the part that matters already lives in the response-time audit.

**Key sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [About Applebot](https://support.apple.com/en-us/119829) · [Google crawlers and fetchers (user agents)](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — full evidence: [dossier](./technical-readiness/no-render-blocking.md)

### `technical-readiness/permissions-policy`

**Claimed:** Steelmanned: AI browser agents (ChatGPT Atlas agent mode, Perplexity Comet, Claude for Chrome, Playwright/browser-use harnesses) drive a real rendering engine.

**Why it is not a factor:** The mechanism is affirmatively false, in three independent ways. (1) A missing header cannot cause a prompt. Per MDN (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy), each directive has a default allowlist of `*`, `self` or `none`, and permission prompts fire only when the page's own JavaScript calls the API (e.g. `navigator.geolocation.getCurrentPosition()`) and permission is not already decided. A site that never calls getUserMedia or the Geolocation API will never prompt an agent, header or no header.

**Verdict:** Grade D. Not merely undocumented — disproven.

**Key sources:** [Permissions-Policy header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy) · [BrowserContext.grantPermissions()](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions) · [How Agents Ask for Permission: User Permissions for AI Agents, from Interfaces to Enforcement](https://arxiv.org/html/2607.13718v2) — full evidence: [dossier](./technical-readiness/permissions-policy.md)

### `technical-readiness/preconnect-hints`

**Claimed:** Steelmanned: crawlers operate under a crawl/render budget. Google itself says faster loading and rendering lets it read more content. Preconnect collapses DNS + TCP + TLS for a critical third-party origin, shaving hundreds of milliseconds off render completion.

**Why it is not a factor:** Four positive disproofs. (1) The precondition fails for nearly all AI crawlers. Vercel's telemetry (https://vercel.com/blog/the-rise-of-the-ai-crawler): "none of the major AI crawlers currently render JavaScript" — OpenAI, Anthropic, Meta, ByteDance and Perplexity bots fetch JS as bytes without executing it; only Gemini renders. `rel=preconnect` is a hint acted on by a rendering engine's loading pipeline; a crawler that fetches HTML and stops never opens the speculative connection, so the hint is literally inert for GPTBot, ClaudeBot and PerplexityBot.

**Verdict:** Grade D. The causal chain requires a renderer, and the dominant AI crawlers do not render — so for GPTBot, ClaudeBot and PerplexityBot the signal is inert by construction.

**Key sources:** [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Large site owner's guide to managing your crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) · [Preconnect to required origins (uses-rel-preconnect)](https://developer.chrome.com/docs/lighthouse/performance/uses-rel-preconnect) — full evidence: [dossier](./technical-readiness/preconnect-hints.md)

### `technical-readiness/privacy-policy`

**Claimed:** Steelmanned: enterprise AI frameworks check for a privacy policy before recommending sites in regulated industries, so a missing policy lowers the site's trust score in AI systems that prioritise transparent data handling — especially for health, finance and legal content.

**Why it is not a factor:** No AI consumer is documented to read a prose privacy policy, and the trust-scoring chain the audit describes is named by no vendor. The closest real, machine-readable mechanism in this space — the W3C TDM Reservation Protocol — fails on every practical axis: it is a Final Community Group Report (Feb 2024), not a Standards Track Recommendation; it names essentially one implementer; and no AI model provider (OpenAI, Anthropic, Perplexity, Google, Apple) documents consuming it. Neither EU AI Act Art. 53(1)(c) nor the GPAI Code of Practice Measure 1.3 names any protocol but robots.txt / RFC 9309, the Commission's opt-out consultation likewise names only "robots.txt and subsequent IETF versions of this standard", and Cloudflare's opt-out machinery is built on robots.txt and its Content Signals `use` extension. Independently, the implementation fails in both directions: a status-only path probe turns any SPA catch-all that 200s unknown paths into a false pass, while English-only anchor matching fails compliant German (Datenschutzerklärung), French, Spanish and Japanese sites.

**Verdict:** Grade D. No named consumer, no documented trust-scoring mechanism, and the machine-readable alternative that would carry the signal has no AI-provider implementer either.

**Key sources:** [TDM Reservation Protocol (TDMRep) — Final Community Group Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/) · [EU AI Act — Article 53](https://artificialintelligenceact.eu/article/53/) · [GPAI Code of Practice — Final version](https://code-of-practice.ai/) · [Commission consultation on TDM opt-out protocols](https://digital-strategy.ec.europa.eu/en/consultations/commission-launches-consultation-protocols-reserving-rights-text-and-data-mining-under-ai-act-and) · [Your site, your rules: new AI traffic options](https://blog.cloudflare.com/content-independence-day-ai-options/) — full evidence: [dossier](./technical-readiness/privacy-policy.md)

### `technical-readiness/referrer-policy`

**Claimed:** Steelmanned: some AI crawler, answer engine, or agent platform inspects a site's HTTP response headers and derives a security/privacy posture score from them, and the presence of `Referrer-Policy` raises that score, making the site more likely to be crawled, trusted, or cited.

**Why it is not a factor:** Three positive disproofs, not merely absence of results. (1) Mechanical impossibility: `Referrer-Policy` governs the Referer header that the *client sends on requests originating from your pages*. It has no effect whatsoever on what a crawler or agent fetching your page can read, and it cannot affect AI-referral attribution either — whether a visit from ChatGPT shows up as chatgpt.com is decided by ChatGPT's own referrer policy, not yours. So even the audit's own steelman is directionally wrong.

**Verdict:** Grade D. No documented consumer exists on the AI side, and the stated mechanism is mechanically backwards — the header controls outbound referrers from the site's own pages and cannot influence how any crawler or agent reads the site.

**Key sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Google crawlers (user agents) overview](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) — full evidence: [dossier](./technical-readiness/referrer-policy.md)

### `technical-readiness/terms-of-service`

**Claimed:** Steelmanned: AI agents check a site's terms of service to determine whether automated access is permitted; a missing ToS page creates legal ambiguity that may cause enterprise AI systems to avoid recommending the site, and clear terms let a publisher specify AI usage policies for its content.

**Why it is not a factor:** Agents answer the automated-access question from robots.txt, not from prose. The GPAI Code of Practice Measure 1.3 commits crawlers to "read and follow instructions expressed in accordance with the Robot Exclusion Protocol (robots.txt), as specified in… RFC 9309"; robots.txt / RFC 9309 is the only protocol named in either that Measure or EU AI Act Art. 53(1)(c), and the Commission's opt-out consultation names only "robots.txt and subsequent IETF versions of this standard". No vendor documentation — OpenAI, Anthropic, Perplexity, Google, Apple — describes fetching or parsing a terms page, and even the machine-readable alternative (W3C TDM-Rep, a Community Group Report with essentially one implementer) has no AI-provider consumer. The implementation is a line-for-line twin of `privacy-policy` with the same status-only soft-404 false pass and the same English-only regexes, which fail German AGB, French CGU/CGV, Spanish Términos and Japanese 利用規約.

**Verdict:** Grade D. The permission question this audit claims to answer is answered by robots.txt and TDM/AI-usage signals, both audited elsewhere; nothing reads the prose page.

**Key sources:** [TDM Reservation Protocol (TDMRep) — Final Community Group Report](https://www.w3.org/community/reports/tdmrep/CG-FINAL-tdmrep-20240202/) · [EU AI Act — Article 53](https://artificialintelligenceact.eu/article/53/) · [GPAI Code of Practice — Final version](https://code-of-practice.ai/) · [Commission consultation on TDM opt-out protocols](https://digital-strategy.ec.europa.eu/en/consultations/commission-launches-consultation-protocols-reserving-rights-text-and-data-mining-under-ai-act-and) · [Your site, your rules: new AI traffic options](https://blog.cloudflare.com/content-independence-day-ai-options/) — full evidence: [dossier](./technical-readiness/terms-of-service.md)

## History

- 2026-08-21 — created from the adversarial redemption research pass (8 agents, 190 sources) after user review accepted all 32 verdicts.
- 2026-08-21 — disposition changed from graceful sunset (one informative minor, removal next major) to outright removal in this major release. All 18 audits and their dossiers moved to `docs/evidence/sunset/`.
- 2026-08-21 — the v2 taxonomy grading pass sunset 8 more grade-D audits (`accessibility/marquee`, `content-discoverability/commerce-links`, `content-discoverability/mobile-friendly`, `technical-readiness/image-dimensions`, `technical-readiness/lcp-not-lazy`, `technical-readiness/no-render-blocking`, `technical-readiness/privacy-policy`, `technical-readiness/terms-of-service`), bringing the total to 26.
