---
audit: technical-readiness/permissions-policy
category: technical-readiness
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

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
