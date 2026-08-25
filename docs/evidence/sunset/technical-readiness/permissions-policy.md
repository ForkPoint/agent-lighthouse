---
audit: technical-readiness/permissions-policy
category: technical-readiness
audit_id: "8.6"
source_file: packages/core/src/audits/technical-readiness/permissions-policy.ts
slug: permissions-policy
review_verdict: delete
severity: high
disposition: "sunset (approved 2026-08-21)"
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# permissions-policy — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: AI browser agents (ChatGPT Atlas agent mode, Perplexity Comet, Claude for Chrome, Playwright/browser-use harnesses) drive a real rendering engine. If a site triggers a native permission prompt for camera, microphone, geolocation or payment, that modal is a browser-chrome dialog the agent cannot see or dismiss via the DOM, silently stalling or failing the task. Setting `Permissions-Policy: camera=(), microphone=(), geolocation=()` pre-empts the prompt, so agent task-success rates rise. Secondary steelman: some AI trust-scoring system reads the header as a security-posture signal.

## What we searched

All research by WebFetch (WebSearch budget exhausted). Angles: (1) Brave query `"permissions-policy" "AI agent" browser permission prompt blocked` — surfaced the 2026 arXiv paper "How Agents Ask for Permission: User Permissions for AI Agents, from Interfaces to Enforcement" (arxiv.org/html/2607.13718v2), which I then fetched in full to check whether it treats site-set headers as an agent-permission mechanism; (2) Brave query on agentic browsers specifically — `agentic browser ChatGPT Atlas Comet "permission prompt" camera microphone blocks automation`; (3) the mechanism check — MDN's Permissions-Policy reference, to establish whether a missing header can itself cause a prompt; (4) the automation-harness check — Playwright's BrowserContext.grantPermissions docs, for default permission state in automated browsers; (5) the four first-party AI-crawler docs (OpenAI, Google, Anthropic, Perplexity) for any header-reading behaviour; (6) Vercel's AI-crawler telemetry study for whether non-browser AI crawlers execute JS at all. Every angle either found nothing or actively contradicted the mechanism.

## Best evidence found for the audit

The nearest thing to supporting evidence is the 2026 arXiv agent-permissions paper, which confirms the *general* problem shape (agent modes and permissions interact badly) — it observes that ChatGPT agent mode "could and would take actions in the remote browser… that required user-in-the-loop permissions to do locally… simply by not assigning any permissions policies to the remote browser at all", and that "The agentic browser had no permissions available to grant". But this is about the agent platform's *own* internal permission model for a remote browser it controls, not about the HTTP `Permissions-Policy` response header a website sends; the paper never mentions the header or any website-set signal. Beyond that, nothing: no agentic-browser vendor doc, no crawler doc, no empirical study connects the header to agent behaviour. The Brave search for agentic browsers and permission prompts returned discussions of agent-mode safeguards and enterprise blocking policies with, verbatim, "No specific mentions found of: permission prompts (camera/microphone) blocking automation; Permissions-Policy headers as agent mitigation; browser permission dialogs preventing AI actions."

## Counter-evidence

The mechanism is affirmatively false, in three independent ways. (1) A missing header cannot cause a prompt. Per MDN (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy), each directive has a default allowlist of `*`, `self` or `none`, and permission prompts fire only when the page's own JavaScript calls the API (e.g. `navigator.geolocation.getCurrentPosition()`) and permission is not already decided. A site that never calls getUserMedia or the Geolocation API will never prompt an agent, header or no header. Conversely a site that *does* call them still needs the capability, so setting `camera=()` would break its own feature rather than help an agent. The header therefore has no reachable path to the outcome the audit describes. (2) Automated browsers do not show prompts at all. Playwright's BrowserContext permission API (https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions) requires explicit `grantPermissions()`; permissions are denied by default in automation contexts and no modal is surfaced — the API call simply rejects. The same is true of headless Chrome. So the class of harness the audit worries about is structurally immune to the failure it describes. (3) The bulk of AI crawlers never reach the JS execution stage. Vercel's crawler telemetry (https://vercel.com/blog/the-rise-of-the-ai-crawler) found "none of the major AI crawlers currently render JavaScript" — OpenAI, Anthropic, Meta, ByteDance and Perplexity bots fetch JS files (ChatGPT 11.50%, Claude 23.84%) without executing them; only Gemini renders, via Googlebot infrastructure. A permission API that is never invoked cannot prompt. Finally, as with the referrer audit, the "AI trust-scoring systems" asserted in the audit's description are unnamed and unattested anywhere.

## Verdict

**confirmed dead — delete** (grade D)

Grade D. Not merely undocumented — disproven. The stated causal chain (no header → agent hits a permission prompt → agent workflow blocked) is broken at its first link, because prompts are triggered by the page's own API calls, not by the absence of a policy header, and broken again at the second link, because automated/agentic browser contexts deny permissions silently instead of prompting, and again at the third, because most AI crawlers never execute JS. The only genuinely on-topic research (arXiv 2026 agent-permissions survey) discusses agent-platform permission models and never touches the HTTP header. Delete; there is no rewrite of the rationale that would make the header an AI-readiness signal.

## Sources

- **[Permissions-Policy header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy)** — MDN Web Docs / Mozilla (vendor-doc, URL verified 2026-08-21)
  - "Directives have a default allowlist, which is always one of *, self, or none for the Permissions-Policy HTTP header, and governs the default behavior if they are not explicitly listed in a policy." Prompts occur only when the page's own code requests the feature and permission is undecided. Absence of the header does not itself cause prompts. Header primarily constrains embedded iframes.
- **[BrowserContext.grantPermissions()](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions)** — Microsoft / Playwright (vendor-doc, URL verified 2026-08-21)
  - Permissions must be explicitly granted per context; they are not granted by default and no permission prompt is surfaced to automated browsers. Automation harnesses are structurally immune to the modal-prompt failure the audit describes.
- **[How Agents Ask for Permission: User Permissions for AI Agents, from Interfaces to Enforcement](https://arxiv.org/html/2607.13718v2)** — arXiv (study, URL verified 2026-08-21)
  - Surveys permission models across chatbots, desktop agents and agentic browsers. Finds ChatGPT agent mode operates a remote browser with no user-configurable permissions: "The agentic browser had no permissions available to grant" and it acts "simply by not assigning any permissions policies to the remote browser at all". Crucially, the paper never mentions the HTTP Permissions-Policy response header or any website-set permission signal — agent permissions are an agent-platform concern, not a site-header concern.
- **[The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler)** — Vercel (study, URL verified 2026-08-21)
  - "none of the major AI crawlers currently render JavaScript". ChatGPT and Claude fetch JS files (11.50% / 23.84% of requests) but do not execute them. Only Gemini renders, by reusing Googlebot infrastructure. Implies no permission API is ever invoked by these crawlers.
- **[Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - No mention of Permissions-Policy or any HTTP response header; control surface is robots.txt and published IP ranges only.
- **[Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)** — Anthropic (vendor-doc, URL verified 2026-08-21)
  - robots.txt and Crawl-delay only. No security headers, no Permissions-Policy, no rendering or permission behaviour documented.

## v1 dossier — what it checked and the 2026-08-20 code review

Merged in on 2026-08-22 from `docs/evidence/audits/technical-readiness/permissions-policy.md`, so a removed audit has exactly one dossier and it lives here.

### What it checks

AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows and are flagged as security concerns by AI trust-scoring systems.

### Code review findings (2026-08-20, 11-agent pass)

The mechanism claimed here is simply false. The audit fails sites without a `permissions-policy` header because 'AI browser agents that visit your site may trigger permission prompts for camera, microphone, or geolocation if Permissions-Policy is not set. These prompts block agent workflows.' Permission prompts are only ever raised when the page's own JavaScript calls `getUserMedia()`/`geolocation.getCurrentPosition()`; the absence of a Permissions-Policy header does not cause a prompt on any page, and headless/agentic browsers auto-deny by default. A site that never touches those APIs — the overwhelming majority — gets a 0.0 and a scary 'blocks automated agent workflows entirely' explanation for a non-existent problem. This is actively wrong guidance, not merely a weak signal.

**Required fix:** Delete. At most, keep Permissions-Policy as a zero-weight informational line inside the merged security-header hygiene audit, with the prompt-blocking claim removed entirely and replaced by the accurate 'restricts powerful-feature delegation to embedded third-party frames'.

**False-positive risks:**
- The premise never fires: no header ⇒ no prompt. Every static/content site on the web is failed for a condition that cannot occur on it.
- Presence-only: `if (value)` passes on `Permissions-Policy: camera=*, microphone=*, geolocation=*` — i.e. a policy that explicitly ALLOWS everything the guidance says to deny. Passing means nothing.
- Backwards for sites that legitimately use these APIs (video-call, map, AR products): they must NOT deny the feature, so the audit's recommended `camera=(), microphone=(), geolocation=()` would break their product, yet following the guidance is what the report tells them to do.
- Homepage-only; no-page guard yields a definite 'header is missing' fail on an empty scan (asserted by its own test).

**Test gaps:**
- No test for an all-permissive value (`camera=*`) — which currently passes.
- No test for a site that legitimately requires camera/geolocation, where the recommended fix is harmful.
- No test demonstrating any actual agent-blocking scenario the audit claims to prevent.
- No WAF/challenge test.

**Overlaps with:** `8.2`, `8.3`, `8.4`, `8.5`, `8.7`

### Evidence

#### Signal: Security headers (HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) as AI-readiness signals — grade D (technical-infra)

**Mechanism:** CLAIM UNDER TEST: the presence of HSTS / CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy response headers changes whether or how an AI crawler or agent retrieves, parses, trusts or cites the page. FALSIFIABLE FORM: adding these headers measurably changes AI-crawler fetch behaviour or citation rate on otherwise identical content.

**Evidence:** No supporting evidence was found. An exhaustive read of the AI crawler documentation from OpenAI, Anthropic, Perplexity, Apple and Google turned up not a single reference to any of these headers. Google's AI-features guidance goes further and states there are 'no additional technical requirements' for AI Overviews / AI Mode beyond ordinary Search snippet eligibility. Cloudflare's AI Crawl Control — the product that actually sits between AI crawlers and origins — makes decisions on user agent, IP, signature and robots.txt, never on the origin's security headers.

**Counter-evidence:** These are browser-enforced defence-in-depth mechanisms with human users and browsers as their consumers; server-side crawlers do not implement any of them. The only genuine adjacencies, and they run in the OPPOSITE direction from the audit: (1) CSP frame-ancestors / X-Frame-Options can PREVENT a page being embedded in an agent surface, so a strict policy is an agent-readiness negative, not a positive; (2) OpenAI's Apps SDK shows CSP being imposed BY the agent host on its own widget iframe (connect_domains → connect-src, frameDomains for nested frames), which is a property of the app, not of the publisher's site; (3) X-Content-Type-Options: nosniff only matters in a browser and only makes a wrong Content-Type more fatal — it belongs to the content-type signal, not here. Recommend removing these from any AI-readiness SCORE. They remain legitimate general web-security hygiene and can be reported as unscored context, but presenting them as AI-agent signals is not defensible and would be the easiest finding for a critic to falsify.
**Consumers:** none-known · **Recommended tier:** delete

**Sources:** [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) · [AI Crawl Control overview](https://developers.cloudflare.com/ai-crawl-control/) · [Security & Privacy — Apps SDK](https://developers.openai.com/apps-sdk/guides/security-privacy)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in not-a-factor.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.

- 2026-08-22 — v1 dossier merged in from `docs/evidence/audits/technical-readiness/permissions-policy.md`; that copy removed (one dossier per removed audit, under `sunset/`).
