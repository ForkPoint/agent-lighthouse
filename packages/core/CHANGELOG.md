# @forkpoint/agent-lighthouse-core

## 3.0.0

### Major Changes

- 13082c6: Every audit now receives the scan's evidence record.

  `CheckContext` gains a required `evidence` field, built once per scan before
  any audit runs. It records whether the origin answered, whether anything
  blocked the scan, which fetched pages served readable text, and which page
  types are usable. Nothing is gated on it yet — audits that want it can read it.

  The field is required rather than optional on purpose: an optional field fails
  open, and a caller that forgets it is exactly the silent-nothing verdict the
  record exists to remove. Code that builds a `CheckContext` by hand must pass
  one; `allEvidenceMet()` is exported for callers that do not exercise the gate.

- 13082c6: A scan that saw too little now says so, instead of scoring the site anyway.

  **The gate is on.** An audit whose required evidence the scan never obtained is
  skipped, reports `na` tagged `skipped:no-evidence` with the reason attached, and
  is never constructed. Pass `enforceEvidenceGate: false` to `runScan` to run
  every audit regardless.

  **The score can be absent.** `ScanReport.overallScore` and `scoreTier` are now
  `number | null` and `ScoreTier | null`. They are null when the scan never
  reached the site, was refused, or lost so much of the registry's evidence mass
  to the gate that what remains is not a reading of the site. The report carries a
  new `scanValidity` block saying which evidence classes were obtained, why the
  missing ones are missing, and — when suppressed — why there is no score. Every
  surface renders that as "Not scored" with the reason, never as `0`.

  **Two audits stop lying about being blocked.** `no-blocking-captcha` reported a
  pass on a site that walled the scanner: it looked for CAPTCHA markup in pages it
  never received. It now fails and names the wall, and returns `notApplicable`
  when no page was fetched. A rate limit is excluded — that is the scan asking too
  fast, not the site refusing agents.

  **A homepage 429 is retried once**, after `Retry-After` when the site sends one,
  before the scan concludes it was blocked.

  **`na` no longer leaks into `recommendations`.** Core now filters to `fail` and
  `warn`, which is what `packages/report` always did.

- 13082c6: `content-extraction/server-rendered` now judges every fetched page, not just
  the first.

  The audit reads the per-page record the scan already built and reports a ratio:
  pass when every page served readable text, warn when some did not (the empty
  URLs are listed in `details.emptyPages`), fail at critical priority when none
  did. Its `message` and `found` strings changed shape accordingly.

  A scan that fetched no page reports `notApplicable` instead of `warn`. Warning
  was a claim about the site; the truth is that nothing was seen.

- 13082c6: The text metric behind `content-extraction/server-rendered` now reads the served HTML body instead of the first `<main>` element.

  The audit used to measure `getMainContentText`, which returns a page's main content region. That helper took the first `<main>` whenever any existed, so a site that ships an empty `<main>` wrapper, or several `<main>` elements of which the first is a stub, was measured as serving no content at all. Two real storefronts in the benchmark were failed at critical priority on that basis: one with a single empty `<main>` and 194 words elsewhere in its body, one with four `<main>` elements the first of which held 49 characters. Both now pass.

  The audit reads a new exported helper, `getRenderedText`, which returns the whole `<body>` minus `script`, `style`, `noscript` and `template`. Its word count comes from that same text. The pass threshold is unchanged: more than 50 words or more than 200 characters.

  `getMainContentText` keeps its job of describing the main content region, with its selection corrected. Among several `<main>` elements it now returns the one holding the most text rather than the first, and it falls back to `<body>` only when no `<main>` holds any text. A `<main>` inside a `<template>` is never counted: the page does not render it. Pages with a single non-empty `<main>` are measured exactly as before, so navigation, headers and footers stay out of the content audits that read it — dates, numbers, unique data, publication dates, content depth, hydration payload share and the user-agent parity gatherer.

  The `<body>` fallback is the one place that changes for those audits. A page whose every `<main>` is empty used to measure as zero words; it now measures its body text, page chrome included. That is the correction `velasca.com` needed, and it is also why a chrome-only shell can now clear a word-count threshold it used to fail. `answer-readiness/content-without-clickthrough` carried a private copy of the old first-`<main>` rule and now reads the shared helper, so it stops warning about low content on pages whose real content sits in a later `<main>`.

  Scan output changes for any site whose `<main>` is empty or fragmented: it stops being reported as serving no content.

### Minor Changes

- 13082c6: Audits declare which scan evidence they need, and a scan can act on it.

  `AuditMeta` gains `requires`: the classes of evidence an audit needs to say
  anything true. An audit that reads the sampled pages — directly or through a
  page-fed gatherer — needs all four; one that reads only root files needs the
  origin to have answered. Of 215 registered audits, 161 are page-fed.

  `scripts/check-requires.mjs` (`pnpm check:requires`, wired into CI) proves each
  declaration against what the source actually reads, and fails the build when a
  new gatherer is not classified. Audits whose subject _is_ the missing evidence —
  `server-rendered`, `no-blocking-captcha`, `no-bot-detection` and the
  `access-crawl-control` category — are exempt through an allowlist, not through
  a missing rule.

  The gate itself is off by default. `runScan({ enforceEvidenceGate: true })`
  turns it on: an audit the scan cannot feed reports `na` tagged
  `skipped:no-evidence`, with the reason attached, and is never constructed.
  `AuditTrace.outcome` gains `'gated'` for those.

- 13082c6: `FetchResult` now records the redirect chain it walked.

  Each hop carries its status, the URL it left and the URL it went to. `finalUrl`
  alone cannot say whether a host change was permanent: a scan has to tell a
  domain migration (301/308) from a temporary hop to somebody else's domain, and
  only the per-hop status answers that.

  The field is optional and absent when the response was not a redirect, so
  nothing that reads a `FetchResult` today changes.

## 2.0.0

### Major Changes

- 3d23272: `access-crawl-control/agent-governance` no longer fails a site whose
  robots.txt names no AI agents but grants access through its catch-all group.

  RFC 9309 §2.2.1 makes a crawler obey the group matching its own product token
  and fall back to `*` only when no such group exists, so an open catch-all
  already grants every named agent the full access that writing the groups out
  would. The audit's own evidence recorded this and stated that the grade
  "does not support the audit's pass criterion"; the rule now matches the
  standard it cites.

  The audit still fails a blanket block with no per-agent exceptions, which is
  the one case the sources support: the fallback carries that block onto the
  live retrieval agents as well.

- 3d23272: `agent-interfaces/agents-json` no longer fails a site for not serving
  `/.well-known/agents.json`, and no longer reports any parseable JSON at that
  path as adoption.

  The audit's own evidence records `Consumers: none-known` and recommends
  deleting the signal: the agents.json specification never moved past v0.1.0, its
  repository has been dormant since 2025-08-21, both of its project domains are
  offline, and the path is absent from the IANA Well-Known URIs registry. The
  audit nonetheless failed every site at medium priority and prescribed a schema
  (`protocols`, `authentication`, `rate_limits`, `endpoints`) that no agents.json
  consumer can read, behind a documentation link whose domain no longer resolves.
  Anyone who followed that advice wrote an unusable file.

  Absence is now reported as not-applicable, which leaves it out of scoring
  entirely. A published file is validated against the shape the specification
  actually defines — an `info` object plus a `sources` or `flows` array — so `[]`,
  `{}` and unrelated config files no longer pass. A path answering HTTP 200 with
  the site's HTML shell is named as what it is, a well-known path claiming
  adoption the site does not have, rather than reported as invalid JSON; a clean
  404 is treated as honest and is never penalised. A valid document served with a
  `text/html` content type gets its own, milder warning about the media type
  instead of being accused of containing HTML. The audit can no longer return a
  failure of any kind, its default priority drops from medium to low, and the
  remediation snippet and documentation link now point at the real specification.

  No score moves in either direction: the audit was already informative at weight
  0, and the evidence does not support raising it — grade C carries no scoring
  weight under the evidence policy. What changes is what reports say. Every
  scanned site without the file loses an `agents.json` failure row, and any site
  publishing placeholder JSON at that path loses a pass it should never have had.

- 3d23272: `access-crawl-control/anthropic-ai` now scores ClaudeBot only, and scores the access robots.txt grants rather than the shape of the file.

  The check used to treat `anthropic-ai` and `ClaudeBot` as one bot family and pass if either token was allowed. Its own evidence never supported that. Anthropic's current crawler documentation names only ClaudeBot, Claude-User and Claude-SearchBot; the audit's research grades the legacy `anthropic-ai` token C with no known consumer and states that no points should be awarded or deducted for it. The combination rule moved points in both directions anyway: a site with `User-agent: anthropic-ai` / `Allow: /` beside `User-agent: ClaudeBot` / `Disallow: /` scored full marks while Anthropic's only documented training crawler was completely blocked, and a stale legacy-only `Disallow: /` line produced a high-priority failure on a site ClaudeBot was free to crawl.

  ClaudeBot alone now decides the result for this audit. A `User-agent: anthropic-ai` or `User-agent: Claude-Web` group is still detected and reported — the result carries a note saying the group is not a documented Anthropic access control, and `details.legacyTokens` lists what was found — but it no longer moves this audit's status or score in either direction. Note that `access-crawl-control/agent-governance` still recognises the legacy spelling when it counts named training crawlers; that is tracked separately in its own dossier.

  The pass condition changed at the same time, for the same reason `access-crawl-control/meta-external-agent` changed earlier: the grade-A evidence is that Anthropic honours robots.txt, which is a fact about whether a disallow takes effect, not about whether a group names the token. Under RFC 9309 §2.2.1 an open catch-all grants a named crawler exactly the access a named group would, so both now pass. The `warn` band is gone.

  **Which direction scores move.** Most sites go up. Any site whose robots.txt leaves ClaudeBot able to fetch `/` — through its own group, through an open `User-agent: *` group, or because no group applies to it — now scores 1.0 where an unnamed crawler previously took 0.5. Sites that block ClaudeBot still score 0, but the failure drops from `high` priority to `medium`, and its text no longer claims the block costs you visibility in AI search: Cloudflare Radar measures Anthropic's crawl-to-refer ratio at roughly 50,000:1, so what a block actually costs is inclusion in the training corpus. Sites that score 0 solely because of a stale `User-agent: anthropic-ai` / `Disallow: /` line, with ClaudeBot unrestricted, now pass. Sites that scored 1.0 on an `anthropic-ai` allow while blocking ClaudeBot now fail, which is the result that was always correct.

  Sites that serve no robots.txt, serve a non-200, serve an empty body, or serve an HTML error page at `/robots.txt` are now **not applicable** instead of `warn`. A not-applicable check is excluded from scoring entirely, so the access-crawl-control category score for those sites is computed over one fewer check rather than being dragged toward 0.5 by a fact about a missing file.

  The audit id, `access-crawl-control/anthropic-ai`, is unchanged, so nothing referencing it breaks. Its title, description and fix guidance now lead with ClaudeBot.

- 3d23272: `content-extraction/image-alt-text` now measures the accessible name rather than
  the `alt` attribute alone.

  The audit's grade A rests on a standard: accname ranks `aria-labelledby` and
  `aria-label` _above_ `alt` as text-alternative sources, and HTML-AAM maps
  `title` below it. The rule tested only for a non-empty `alt`, so it failed
  images that carry an accessible name by the very document the grade cites. An
  `<img aria-label="Sales by quarter">` was scored as a missing alternative at
  weight 1.0.

  Coverage is now computed over `aria-labelledby` (ids resolved against the page),
  `aria-label`, `alt` and `title`, in that order. Three further changes, each
  asked for by the audit's own recorded review:

  - Images marked `aria-hidden="true"` leave the denominator. They are not in the
    accessibility tree, so no snapshot consumer can see them.
  - A site with no images needing a name is reported not-applicable instead of
    passing. The old rule handed a free scored 1.0 to image-free pages and to
    every client-rendered site whose served HTML carries no `<img>`.
  - Warnings and failures name the worst offending page URLs and carry the worst
    page's URL on the result. Coverage is pooled across pages, so one gallery page
    could sink a site with no indication of where the problem was.

  A global ARIA name defeats a decorative marker: `<img alt="" aria-label="…">`
  counts as a named image. `title` does not — it names an image that already
  counts, but does not pull a decorative one back into the denominator.

  The description and failure copy no longer claim that "Most AI agents are
  text-only and rely entirely on alt text" or that missing alt text makes content
  "invisible to AI systems". The audit's own counter-evidence rejects that: the
  grade rests on Google's explicit statement about Google Images plus the
  accessibility-tree snapshot consumers, not on a general claim about all AI.

  Sites using ARIA naming or `title` stop failing. Image-free and all-decorative
  sites leave the category denominator instead of collecting a free full mark.
  Grade, tier and weight are unchanged at A, scored, 1.0.

  `extractImages` gains three optional fields — `ariaLabel`, `ariaLabelledby` and
  `title`. Additive; no existing field changes.

- 3d23272: The two scored `llms.txt` audits are re-graded to C / informative / weight 0
  after a fresh evidence sweep. `machine-discovery/llms-txt-exists` moves from
  A / scored / 1.0 and `machine-discovery/llms-txt-links-valid` from
  B / scored / 0.6, so 1.6 of weight leaves the scored set and every site's
  machine-discovery and overall score is recomputed against it.

  `docs/evidence/policy.md` already used llms.txt existence as its worked example
  of grade **C** — "published widely, no documented consumer, Google states Search
  ignores it" — while the audit shipped grade A. The sweep asked which of the two
  was wrong. It was the audits.

  No AI vendor documents a consumer of `/llms.txt`. Checked and empty across
  Anthropic, OpenAI, Google, Perplexity, Mistral, Meta, xAI, Microsoft, Cursor and
  Cloudflare, plus llmstxt.org v2, the IANA Well-Known URIs and Link Relations
  registries, and the IETF Datatracker. Six of those vendors publish an llms.txt
  for their own documentation; none documents reading one, and that distinction is
  what the A collapsed. Google Search Central, updated 2026-07-10, still states
  that Search does not use the file. Chrome's Lighthouse does fetch it — as an
  auditor, applying three conformance rules, and scoring a missing file
  `notApplicable`.

  The pass rules move with the grades. A missing llms.txt is now **not
  applicable** in both audits instead of a `critical` failure in one and a `fail`
  in the other: the file is optional and its absence is not a defect. A site that
  advertises the file with a `<link>` and does not serve it warns at `low` — that
  promise is the site's own. Broken links inside a published file warn at `low`
  instead of failing at `high`. Descriptions and guidance no longer claim the file
  is how AI agents discover a site, or that ChatGPT, Perplexity and Claude must
  crawl a site blindly without it.

  `machine-discovery/llms-full-txt` was re-checked and is unchanged at
  C / informative / 0. `agent-interfaces/openapi-exists` was re-checked and is
  unchanged at B / informative / 0; `/.well-known/api-catalog` still has no
  documented consumer.

  `policy.md`'s grade-**D** example changes too. `ai-catalog.json` is no longer
  speculative: since 2026-06-17 it is the file defined by the Agentic Resource
  Discovery specification, and it has a documented first-party consumer client in
  `huggingface/hf-discover`. The D row now cites security headers as "AI trust
  signals", `agents.txt`, and invented "AI trust score" meta tags.

- 3d23272: `content-extraction/markdown-alternate` no longer fails a site that serves no
  markdown alternate, and the `<link rel="alternate">` declaration can no longer
  decide the result on its own.

  The audit's grade-A evidence is explicit that the grade "applies to interactive
  coding agents, NOT to search crawlers or consumer chat". What the sources
  document is consumption when a markdown alternate is served; none measures a
  cost to a site that serves none, and three point the other way — ChatGPT-User
  takes markdown on 0.1% of fetches, a 14-day controlled test found 0 crawler
  visits and 0 citations for `.md` against 137 to matched HTML, and Google states
  markdown is not needed for Search or its AI features. Absence now returns
  not-applicable and leaves the score denominator. Every site that was failing
  this check for having no markdown alternate gains the weight back; no site that
  serves one sees its result change for that reason.

  The audit bundled two separately graded signals and let the weaker one decide.
  The link relations carry `Recommended tier: experimental` — one single-sourced
  consumer for `rel="alternate"`, none known for `rel="describedby"` — while the
  markdown representation reached by a `.md` URL or `Accept: text/markdown`
  carries `Recommended tier: scored`. A declared link whose document could not be
  read used to return a full pass at weight 1.0, and a declared link that 404'd a
  full fail. Both are gone: the declaration is a discovery route and a reported
  detail, never an outcome.

  Two supporting changes. Probing no longer stops at a declared document that
  fails the fidelity floors, so a site-wide `index.md` declared from every page
  cannot fail a site for the per-page alternate it actually serves. And "this is
  the HTML page again" is decided from the body rather than the content type, so a
  `.md` URL answering with the HTML document is not an alternate, while a markdown
  document served as `text/html` or `text/plain` still fails under RFC 7763.

  Page selection now prefers a page that declares an alternate, then any
  non-homepage, closing a long-recorded homepage bias: a marketing homepage almost
  never has a markdown twin even on sites where every content page does.

  Grade, tier and weight are unchanged at A, scored, 1.0. The scored population is
  now the one the evidence covers.

- 3d23272: `agent-interfaces/mcp-discovery` drops from grade A / scored / weight 1.0 to
  grade C / informative / weight 0, and stops failing sites that publish nothing.

  Four of the audit's five researched signals record `Consumers: none-known` and
  recommend `informative` or `delete`. Neither `/.well-known/mcp/servers.json` nor
  `/.well-known/ucp` is a registered or specified discovery path, and no shipping
  MCP client is documented as fetching either. The audit nonetheless failed every
  site without one at weight 1.0 — including every site running a real MCP server
  at `/mcp`, through the registry, or via `/.well-known/oauth-protected-resource`.
  Its own code review calls that "a false FAIL on precisely the sites that are
  most agent-ready". Publishing no MCP discovery document is now not-applicable.

  The fifth signal — the one recommending `scored` — is not split into a new
  audit, because it is already implemented. It describes itself as "a meta-signal
  about how the other audits must be implemented": do not read an HTTP 200
  carrying HTML as evidence of a document. `agent-interfaces/openapi-exists`
  enforces exactly that at the ratified path, rejecting a `text/html` body at
  `/.well-known/api-catalog` and requiring the linkset to parse. A second audit
  would have duplicated it, contradicted the tier `openapi-exists` deliberately
  carries, and needed a pass condition under which serving `{}` at a well-known
  path bought a weight-1.0 win.

  Two vacuous passes are also gone. `{}` at `/.well-known/ucp` returned a
  confident pass reading "0 services and 0 capabilities"; `{"servers": []}`
  returned a pass for a discovery file that discovers nothing. Both now fail — a
  document that is published and says nothing is a defect, unlike a document that
  was never published.

  Every site previously failing this check gains weight 1.0 back in the Agent
  Interfaces category. The scored set drops from 167 audits to 166 and the total
  evidence mass from 137.4 to 136.4; `docs/scoring.md` is refreshed to match. No
  audit is added or removed — the registry stays at 215.

- 3d23272: `access-crawl-control/meta-external-agent` no longer scores a site down for
  failing to name Meta-ExternalAgent in robots.txt.

  The audit inherited a rule that passed only when a named
  `User-agent: Meta-ExternalAgent` group allowed `/`, and warned at score 0.5 on
  everything else that was nonetheless allowed. A robots.txt reading
  `User-agent: *` / `Allow: /` — every crawler welcome, nothing blocked — scored
  half marks at weight 1.0. Its own dossier calls that criterion "the cargo-cult
  'explicit Allow: /'", and RFC 9309 §2.2.1 contradicts it: a crawler obeys the
  group matching its product token and falls back to `*` only when no such group
  exists, so an open catch-all grants exactly the access a named group would.

  The audit now asks whether the rules that apply to the token permit `/`.
  Allowed by its own group, allowed through the catch-all, and allowed because no
  group applies all pass. A disallow that reaches the token still fails. The warn
  band is gone. An unreadable robots.txt — missing, non-200, empty, or a 200 that
  parses to no rules at all — is not applicable rather than a warn.

  The failure text no longer claims that blocking this agent "prevents your
  content from appearing in AI-powered search results and answers". The dossier
  assigns that role to Meta-WebIndexer; Meta-ExternalAgent is the training-side
  token. The failure now states the effect the sources support — exclusion from
  Meta's training corpus and from direct product indexing — and its priority drops
  from high to medium accordingly.

  Sites allowed only through a wildcard move from 0.5 to 1.0 on this check. Sites
  with no robots.txt leave the denominator instead of scoring 0.5. Grade, tier and
  weight are unchanged at A, scored, 1.0.

  The change is confined to this audit. The twenty sibling `CrawlerBotAudit`
  checks keep the inherited rule, so the robots differential baseline is
  unaffected.

- 40064df: A scan that gets HTTP 429 now reports a rate limit, not a bot wall.

  `detectWafProtection` mapped 429 onto whichever provider fronted the site, so a
  throttled scan came back as "Cloudflare Turnstile / Managed Challenge", and
  `access-crawl-control/no-bot-detection` failed the site at critical priority
  with "Bot-defense firewall detected blocking AI crawler connections". HTTP 429
  means "too many requests" — a statement about the rate this scan asked at, not
  about who the site admits.

  Found by scanning 48 live Shopify storefronts back to back: 36 were reported as
  behind a Cloudflare managed challenge, and a single-request `curl` carrying the
  same user-agent got HTTP 200 from every one of them.

  429 is now diagnosed before any provider is, since every provider serves it for
  throttling. It carries `provider: 'rate-limited'` and a new `isRateLimit` flag,
  and `no-bot-detection` returns not-applicable rather than failing — a scan that
  never saw the site cannot judge its bot defenses.

- 3d23272: `structured-data/speakable-schema` and `agent-interfaces/webmcp-declarative-forms`
  both drop from evidence grade **A** to **B**, and from weight 1.0 to 0.6. Both
  stay scored, both keep every detection rule and every not-applicable
  precondition. Only the price changes.

  Both were on the retirement shortlist and neither is retired: their consumers
  were re-verified on 2026-08-24 and are live and documented. Google Search
  Central's speakable page still names Google Assistant as the agent that reads
  marked sections aloud with TTS. Chrome's declarative-API page still states that
  the browser interprets an annotated form as a tool and populates its fields when
  an agent calls it.

  What the re-verification also surfaced is what each vendor says about its own
  feature. Google: "This feature is in beta and subject to change", limited to
  U.S. English Google Home users and English-language news publishers. Chrome: an
  origin-trial badge, and "WebMCP is under active discussion and subject to change
  in the future."

  `docs/evidence/policy.md` reserves grade A for documented consumer behaviour or
  a ratified standard with known consumers, and gives grade B to a draft standard
  with meaningful adoption. A beta feature with a one-country, one-language,
  one-content-type scope and an origin trial are both grade B.

  0.8 of weight leaves the scored set. Structured Data falls from 10.0 to 9.6 of
  evidence mass and Agent Interfaces from 12.4 to 12.0; the registry total falls
  from 134.8 to 134.0. Sites carrying either signal keep the credit, worth
  proportionally less; sites missing either lose proportionally less.

- 3d23272: `answer-readiness/review-signals` no longer accepts the review vocabulary as
  proof of reviews, and no longer lets out-of-scope pages decide a commerce
  verdict.

  Four narrowings, each grounded in the audit's own recorded evidence.

  **Hollow markup stops counting.** Google prohibits review markup that is not
  "sourced directly from users", so the dossier records that "the existence of
  review markup is not itself evidence of social proof". The audit already
  rejected `"review": []` and a zero `reviewCount` on that reasoning but stopped
  there, so `"aggregateRating": {}`, `"aggregateRating": true`, a bare
  `{"@type":"Review"}` and `[{"@type":"Review"}]` all passed. A rating node now
  needs a rating value or a positive count; a review node needs a body, a named
  author, or a rating.

  **The commerce branches now respect the commerce scope.** The audit declared
  `applicablePageTypes: ['homepage', 'product']` but looped over every scanned
  page, so in a mixed scan a blog post's `star-rating` div could satisfy it. The
  review vocabulary, the widget fallback and the "N reviews" text are read only
  from homepage and product pages — the population Google's review rich results
  and OpenAI's `review_count`/`star_rating` cover. The quotation branch keeps its
  wider scope: its evidence is a GEO measurement of generative-answer citation,
  not a commerce one.

  **An unattributed pull-quote sets no status.** It was a scored warn. The
  dossier states that "nothing in any source supports counting an unattributed
  blockquote as a review signal". It is now reported in `found` and nothing more,
  so an editorial pull-quote alone fails where it used to warn, and the warn copy
  no longer claims review signals were found on a page that has none.

  **Attribution has to name someone.** Any `cite` attribute counted, including
  prose like `cite="see our press page"`, and an empty `<cite></cite>` counted. A
  `cite` value must now name a document — relative references count — and the
  attribution elements must carry text.

  Two supporting fixes: the "N reviews" test runs against text with `script`,
  `style`, `noscript` and `template` stripped, so an inline JSON payload reading
  `"1234 reviews"` no longer counts as visible review UI; and a widget element
  must carry text or children, so an empty `star-rating` placeholder that may
  never populate is not review UI.

  `findReviewNodes` is exported and `answer-readiness/trust-signals` defers its
  social-proof factor to it, so that audit stops deferring on hollow markup —
  which moves its denominator and its pass bar. Intended, and pinned by a test.

  Grade, tier and weight are unchanged at B, scored, 0.6.

- 3d23272: `operability-safety/security-header-hygiene` is narrowed to the one signal its
  evidence supports: `/.well-known/security.txt`. The Strict-Transport-Security,
  Content-Security-Policy and X-Content-Type-Options rows are gone from the report,
  and the audit no longer reads response headers at all.

  The audit's own research grades those three headers **D**, with
  `Consumers: none-known` and `Recommended tier: delete`. The two other headers in
  that same researched signal — Referrer-Policy and Permissions-Policy — were
  already removed outright in v2 for exactly that reason, so keeping three of the
  five was an inconsistency. The grade the audit shipped, **B**, belonged to the
  HTTPS/TLS signal, which this audit never measured and which already ships scored
  as `access-crawl-control/https-enabled`.

  What survives is the security.txt check, at the grade its own research records:
  **C**, informative, weight 0. Its detection is unchanged — the well-known
  location with a legacy top-level fallback, a soft-404 guard, and RFC 9116
  `Contact` plus an unexpired `Expires`.

  The pass rule narrows with it. A site that publishes no security.txt is now
  reported as **not applicable** rather than warned: RFC 9116 is an Informational
  document, publishing the file is optional, and adoption is about 1.25% of the
  top 1M domains. Only a published file that fails RFC 9116 warns, at priority
  `low`. A valid file passes. The audit still never returns `fail`.

  No score moves. The audit was weight 0 before and is weight 0 after, so every
  category score and the overall score are unchanged, and the scored set is the
  same size. What changes is the report. Most sites lose a warning they could not
  usefully act on; sites that were warned only for missing security headers now
  pass; and the check's title, description and remediation now describe
  security.txt instead of a header checklist.

  The check id `operability-safety/security-header-hygiene` is unchanged in this
  release, so nothing keyed on it breaks — but the name no longer describes what
  the check measures, and a rename to `operability-safety/security-txt` is
  expected in a later release.

- 3d23272: Two audits drop from grade A scored to grade C informative, because the
  project's own evidence research recommended informative for both and the
  shipped tier did not follow it.

  `access-crawl-control/chatgpt-user` scored the presence of a robots.txt
  disallow for ChatGPT-User. OpenAI documents that "because these actions are
  initiated by a user, robots.txt rules may not apply", and field measurement
  found ChatGPT-User reaching disallowed pages on more sites than any other
  bot, so the directive does not predict agent behaviour in either direction.

  `agent-interfaces/ai-catalog-exists` scored the presence of
  `/.well-known/ai-catalog.json`. The SEP that defines the path is unmerged,
  the path is absent from the IANA Well-Known URIs registry, and no shipping
  MCP client documents fetching it.

  Both remain in the report as informative signals at weight 0. Overall scores
  will rise on sites that were failing them and fall on sites that were
  passing them.

- 3d23272: `answer-readiness/trust-signals` no longer counts comparison content toward its score. The audit now scores exactly the two page factors the study behind it measured: quantified social proof, and claims paired with evidence.

  The audit's own evidence table gave the third factor, comparison content, the measured effect "named in the paper's practical implications" — a sentence in a discussion section, with no odds ratio and no model count, sitting beside two rows carrying OR 2.14 (significant in 4 of 6 models) and OR 2.09 (5 of 6). The project had already researched that signal separately for `answer-readiness/comparison-tables` and recorded "Consumers: none-known · Recommended tier: informative", where it ships at weight 0. The same page fact was being priced at two grades at once, and under the old "2 of 3" rule the unmeasured one could decide a pass.

  The pass bar moves with the factor list. A pass now means both measured factors are present, a warning means one, and a failure means neither. A homepage that passed on a comparison table plus one measured factor will now warn, and a homepage whose only signal was a comparison table or an "X vs Y" heading will now fail instead of warning. Overall, answer-readiness and content-readiness scores fall for those sites. Homepages that already carried a quantified rating or review count together with outbound citations or attributed sources are unaffected, and no page that was passing on the two measured factors changes.

  The evidence grade is unchanged at B, the audit stays scored at weight 0.6, and the deferral to `answer-readiness/review-signals` is unchanged: publishing valid Review or AggregateRating markup still removes the social-proof factor from both sides of the tally, so correct markup can never lower a homepage's result. Comparison content continues to be reported, unscored, by `answer-readiness/comparison-tables`.

- b0adaf5: v2 grade-A graduation wave: the registry grows from 148 to 172 audits.

  24 checks from the 2026-08-20 research pass move out of the proposed folder
  into the live registry. Every one carries evidence grade A — a proven consumer
  path, documented in its dossier under `docs/evidence/audits/` — so every one
  lands in the scored tier at weight 1.0, except
  `structured-data/claimreview-advisory`, which is informative at weight 0
  because its honest finding is that fact-check markup is not an AI-readiness
  lever.

  New in this release, by category:

  - **access-crawl-control**: ai-crawler-edge-parity, bot-content-delta-declared,
    robots-ai-group-shadowing
  - **content-extraction**: css-hidden-ghost-content, hydration-payload-share
  - **machine-discovery**: agent-commerce-feed-parity,
    ai-crawler-surface-reachability, sitemap-lastmod-verifiability
  - **answer-readiness**: snippet-gate-coverage, text-fragment-addressability
  - **agent-interfaces**: mcp-modern-era-reachability, mcp-oauth-discovery-chain,
    mcp-tool-contract-validity, mcp-tools-list-determinism, mcp-version-downgrade
  - **agentic-commerce**: acp-policy-link-surface, agent-ua-commerce-parity,
    checkout-offer-field-mapping, landed-cost-and-returns
  - **operability-safety**: aria-layer-injection-scan,
    form-autofill-token-coverage, invisible-instruction-scan,
    native-control-substitution
  - **structured-data**: claimreview-advisory

  Category evidence mass moves with the audits, so overall scores shift: a site
  that scored well on the 148-audit registry is not guaranteed the same number
  here. That is the intended effect of adding proven checks, not a regression.

  **Breaking: `probeAsBot`, `BotProbeResult` and `BotProbeSignal` are removed**
  from `@forkpoint/agent-lighthouse-core`. They collapsed every non-2xx crawler
  response into a single "blocked" signal, which cannot distinguish a Cloudflare
  challenge from pay-per-crawl, a proof-of-work wall, a rate limit, or an opaque
  403 that may be correct impersonation defence. Use `probeUaParity` and the
  `UaProbe` block classification instead.

  Also fixed: `fetcher` collapsed repeated response headers, so a site sending
  two `X-Robots-Tag` lines had one of them silently discarded. Repeated headers
  are now joined per RFC 9110 §5.3, which also corrects doubled `nosniff` and
  multi-`Link` canonical handling.

- b0adaf5: Plan 5b Wave A: 12 grade-B proposals graduate into `operability-safety`. The
  registry grows from 172 to 184 audits.

  Each carries evidence grade B — a documented consumer path, proved in its
  dossier under `docs/evidence/audits/operability-safety/` — so each lands in the
  scored tier at weight 0.6, except
  `operability-safety/first-contact-consent-gate-operability`, which is
  informative at weight 0: its honest finding is an action cost, not a defect.

  New in this release:

  - **Agent operability**: drag-and-slider-dependency,
    ghost-clickable-element-ratio, hover-only-content-and-navigation,
    stateful-control-introspectability,
    url-addressable-state-and-pagination-fallback,
    first-contact-consent-gate-operability
  - **Injection safety**: agent-ua-content-divergence-diff,
    reflected-parameter-injection-canary, third-party-dom-write-blast-radius,
    ugc-trust-boundary-markers, unicode-covert-channel-scan,
    unsafe-agent-triggerable-affordances

  `operability-safety` gains 6.6 evidence mass, so its share of the overall score
  rises and every other category's share falls. A site that scored well on the
  172-audit registry is not guaranteed the same number here. That is the intended
  effect of adding proven checks, not a regression.

  `operability-safety/reflected-parameter-injection-canary` sends at most five
  read-only GET probes to the scanned origin, carrying a random per-scan canary
  token, to find out whether a query parameter is reflected into the fields an AI
  answer lifts verbatim. It never probes an authenticated path and never sends
  anything but GET.

  `operability-safety/agent-ua-content-divergence-diff` adds one request per
  compared URL: an unrecognised control bot, so a reduced page served to every
  unknown client is reported as bot management rather than as AI-crawler
  branching. Its crawler-UA probes reuse the per-scan cache the
  `access-crawl-control` audits already fill.

- b0adaf5: Plan 5b Wave B: the token-economics and answer-selection-forensics proposals
  land. Nine graduate as new audits and three fold into audits that already
  shipped. The registry grows from 184 to 193 audits.

  New in `content-extraction`:

  - **preamble-tax** — how many tokens an agent reads before the page says
    anything about its subject.
  - **boilerplate-tax** — across the crawl, how much of what an agent fetches it
    has already read.
  - **extraction-determinism** — whether three extractors reading the same page
    agree on what the page says.
  - **json-ld-duplication-mass** — how many tokens the structured data repeats
    from the body. Informative at weight 0: repeating a description in JSON-LD is
    a cost, not a defect, and the audit never fails a page for it.

  New in `answer-readiness`:

  - **chunk-boundary-referent-integrity** — pronouns and positional references
    that stop resolving once a retriever cuts the page into chunks.
  - **extractor-survival-recall** — the share of a page's key spans that survive
    extraction, and the ancestor chain that deleted the ones that did not.
  - **section-split-risk-profile** — how the page survives being cut into
    512-token windows: headings separated from their bodies, sections with no
    heading, sections too thin to answer anything, and tables cut in half.
  - **site-wide-passage-uniqueness-ratio** — the share of each page's sentences
    that are its own, and near-duplicate clusters whose members all name
    themselves canonical, which leaves the canonical election with no answer.
  - **table-markdown-round-trip-loss** — every main-content table converted to
    GFM markdown and read back, with each lost cell reported by coordinate.

  Three proposals folded into audits that already shipped, rather than landing
  beside them:

  - `content-extraction/token-ratio` now measures signal density the way the
    signal-density-index proposal specifies: real `o200k_base` tokens, a
    readability-extracted numerator, and a bucket breakdown of where the rest of
    the payload went.
  - `content-extraction/svg-bloat` now also counts base64 `data:` URIs, which
    cost an agent tokens the same way an inline SVG path does.
  - `content-extraction/markdown-alternate` now verifies the alternate it finds:
    it fetches the file, checks the RFC 7763 media type, and measures how much of
    the HTML's headings and prose the markdown actually carries. A declared
    alternate that 404s fails; one that is served but unreadable passes with
    `details.verified = false`.

  Two new runtime dependencies of `@forkpoint/agent-lighthouse-core`, which
  consumers will install:

  - `gpt-tokenizer` — real `o200k_base` token counts. Every token number this
    release reports is a tokenizer count, never `chars / 4`.
  - `@mozilla/readability` — the main-content extractor, run over jsdom, that the
    new audits measure against.

  `answer-readiness` gains 3.0 evidence mass and `content-extraction` 1.8, so both
  categories take a larger share of the overall score and every other category's
  share falls. A site that scored well on the 184-audit registry is not
  guaranteed the same number here.

  No audit in this wave sends a request that the previous release did not, except
  `content-extraction/markdown-alternate`, which fetches the markdown alternate a
  page declares — a same-origin GET of a file the site advertises.

- b0adaf5: Plan 5b Wave C: the bot-auth-access, competitor-gap-verify and feeds-indexing
  proposals land. Ten graduate as new audits and one folds into another. The
  registry grows from 193 to 203 audits.

  New in `access-crawl-control`:

  - `ai-usage-signal-coherence-across-channels` — reads every channel a site can
    declare AI usage in (robots.txt AI groups, robots.txt `Content-Signal`, the
    `Content-Usage` header, TDM Reservation Protocol, inline RSL) and reports the
    ones that disagree. The `competitor-gap-verify/content-signal-coherence`
    proposal covered the same defect on one channel and folds into this audit;
    the folded dossier is under `docs/evidence/merged/`.
  - `aipref-content-usage-declaration-validity` — validates `Content-Usage`
    syntax, category names and scope paths, and reports a declaration made inert
    by the robots.txt rule that decides the same path.
  - `rsl-licensing-terms-conformance` — checks Really Simple Licensing documents
    across four discovery channels for a usable permit and payment shape.
  - `machine-actionable-402-paid-access` — when an origin answers 402, checks
    that the response is machine-actionable. It never completes a payment and
    never retries with a price.
  - `web-bot-auth-request-tolerance` — signs one request with a per-scan
    ephemeral Ed25519 key and reports whether the origin tolerates HTTP Message
    Signatures. It claims nothing about identity and presents no agent.

  New in `machine-discovery`:

  - `conditional-request-support` — four requests per discovery surface: two
    identical GETs to see whether the validator is stable, then `If-None-Match`
    and `If-Modified-Since`.
  - `feed-entry-identity-and-canonical-integrity` — per-entry id and timestamp
    conformance, duplicate ids, and the five newest item URLs compared against
    the `rel="canonical"` of the pages they open.
  - `root-text-file-resolution-integrity` — two GETs of random 32-hex `.txt`
    names that must 404, plus `/robots.txt` as the positive control. Emits
    `details.discoveryProbeReliable`.
  - `three-way-freshness-lag` — the newest page date against the newest sitemap
    `<lastmod>` and the newest feed entry. Only the freshness half of the
    proposal ships; the orphan half stays with `discovery-index-coverage` rather
    than being scored twice.
  - `websub-hub-advertisement` — WebSub discovery-link conformance. Informative
    tier at weight 0; it never fails a scan.

  What a scan now sends that it did not before: up to four extra GETs per
  discovery surface for the conditional-request probe, five item-page GETs for
  the feed canonical comparison, five sitemap-URL GETs for the dead-entry check,
  three GETs for the root `.txt` probe, one signed GET for the web-bot-auth
  probe, and one HEAD per declared WebSub hub — the only cross-origin request
  the wave adds. Every request is a GET or a HEAD, every URL passes the SSRF
  gate, and no probe writes anything.

  Shared gatherers added: `gatherers/feeds.ts`, `gatherers/conditional.ts`,
  `gatherers/structured-fields.ts` and `gatherers/currency.ts`, so the eleven
  audits share one fetch per surface.

  Also fixes a latent defect in the audit base class: a `fail()` or `warn()`
  whose fourth argument is a remediation sentence rather than a priority token
  threw a `ZodError` at report time. Thirty-two call sites were affected. The
  result now carries `remediation`, and `answer-readiness/section-split-risk-profile`
  no longer emits a number array in `details`, which the result schema rejects.

- b0adaf5: Plan 5b Wave D: the injection-safety, mcp-server-quality and agentic-commerce
  proposals land. Twelve graduate as new audits and one folds into another. The
  registry grows from 203 to 215 audits, which completes Plan 5b.

  New in `operability-safety`:

  - `c2pa-manifest-survives-delivery` — reads up to six images as bytes and
    reports the ones whose C2PA manifest was stripped by an image CDN between the
    origin and the variant a crawler is served.
  - `c2pa-signer-trust-status` — parses the manifest's signing certificate and
    reports self-signed versus CA-issued, expiry, and whether a timestamp token
    is present. It never claims trust-list membership.
  - `organization-identifier-registry-resolution` — resolves a declared LEI
    against GLEIF and compares the registered name with the one the site
    publishes. One GET, cached per scan.
  - `synthetic-media-disclosure-validity` — validates IPTC `digitalSourceType`
    values against the vendored concept list and reports a disclosure that
    contradicts the image's own C2PA manifest. It never claims to detect
    undisclosed AI imagery.
  - `trust-txt-reciprocity-coherence` — parses `trust.txt`, follows at most three
    `belongto=` associations and checks that the AI-crawler posture agrees with
    robots.txt. Informative tier at weight 0; it never fails a scan.
  - `wikidata-round-trip-verification` — checks that the Wikidata entity a site
    claims names this site back through `P856`.

  New in `agent-interfaces`:

  - `mcp-origin-validation-cors` — one preflight from a throwaway RFC 2606
    origin. Reflected origin with credentials, or a wildcard on a credentialed
    endpoint, fails; a permissive endpoint with no auth surface is a note.
  - `mcp-registry-listing-ownership` — searches the official MCP Registry for
    servers whose `remotes[].url` lives on this domain, classifies the namespace
    and verifies the ownership proof at `/.well-known/mcp-registry-auth`.
  - `mcp-tool-description-coverage` — description coverage over the tool surface:
    every tool, every required parameter, and 90% of all parameters, with
    offending paths named as `create_invoice.line_items[].tax_code`.

  New in `agentic-commerce`:

  - `buyable-variant-resolution` — establishes from the rendered HTML that a page
    offers a variant choice, then requires the markup to resolve each one to an
    addressable, priced unit.
  - `cart-handoff-reachability` — reads the cart and checkout paths as a browser
    and as ChatGPT-User and reports an account wall, a bot challenge on the
    document, or a hard block. GET only; a robots.txt `Disallow` on a cart path
    is reported rather than fetched.
  - `offer-truth-consistency` — reconciles the Offer in the markup against the
    price, currency and stock the same page renders. The
    `competitor-gap-verify/offer-dom-price-parity` proposal reconciled the same
    two artifacts and folds into this audit; the folded dossier is under
    `docs/evidence/merged/`.

  What a scan now sends that it did not before: up to six image GETs for the
  C2PA pair, one GET each to GLEIF and Wikidata, at most three `trust.txt`
  association GETs, two MCP Registry searches plus one ownership-proof GET, one
  CORS preflight, and two GETs per cart path. Every request is a GET, a HEAD or
  an OPTIONS; every URL passes the SSRF gate; nothing is ever posted, purchased
  or added to a cart.

  Shared gatherers added: `gatherers/media.ts` (container parsing and C2PA
  manifest extraction), `gatherers/commerce.ts` (price candidates, offer nodes
  and platform fingerprints) and `gatherers/domains.ts`. The fetcher gained a
  `binary` option, because a UTF-8 decode destroys image metadata. `listTools`
  moves into the shared MCP client so the two tool-surface audits split one
  `tools/list` read, and `sharedUaFetch` joins the ua-parity gatherer so an audit
  that needs a response body shares the per-scan cache.

- b0adaf5: v2 merge wave: the registry lands at 148 audits, and every one the evidence
  review flagged for rework was rewritten against its evidence dossier.

  **Breaking: the registry is 148 audits, down from 181.** The v2 taxonomy note
  described 181 v1 ids carried forward; carrying them forward is not the same as
  keeping 181 separate checks. 57 of those ids resolve onto just 24 v2 audits —
  33 fewer checks than ids — so the shipped registry is:

  | category               |  audits |
  | ---------------------- | ------: |
  | `access-crawl-control` |      29 |
  | `answer-readiness`     |      26 |
  | `operability-safety`   |      24 |
  | `content-extraction`   |      21 |
  | `machine-discovery`    |      16 |
  | `agent-interfaces`     |      16 |
  | `structured-data`      |      13 |
  | `agentic-commerce`     |       3 |
  |                        | **148** |

  The collapse is 2 consolidations and 22 merge folds, plus 2 splits that move a
  signal rather than remove one (one of the two splits, `webmcp-tool-naming`, is
  already counted among the 22 folds — its id stops emitting):

  - **2 consolidations** — 5 per-bot audits (`bytespider`, `cohere-ai`, `youbot`,
    `diffbot`, `ai2bot`) become one `access-crawl-control/ai-bot-directives`, and
    4 header audits (`hsts-header`, `csp-header`, `content-type-options`,
    `security-txt`) become one `operability-safety/security-header-hygiene`.
    Both are new ids that no v1 audit owned.
  - **22 merge folds** — a signal moves into an existing audit and its own id
    stops emitting: `no-noindex` and `meta-robots` into
    `access-crawl-control/robots-directives`, `og-site-name` and `twitter-card`
    into `answer-readiness/core-open-graph`, `fast-response-time` into
    `content-extraction/server-responsiveness`, `cache-headers` into
    `machine-discovery/ai-file-delivery`, and so on.
  - **2 splits** — `structured-data/service-schema` keeps the Service half and
    hands the Product half to `structured-data/advanced-product-details`;
    `webmcp-tool-naming` hands its naming rule to
    `agent-interfaces/openapi-operation-ids` and defers its runtime half out of
    v2.0.

  A dashboard keyed on a folded id must re-point at the merge target, and several
  old series now share one new one. Look every id up in the shipped map rather
  than guessing.

  **Breaking: `migration-map.json` is all-`renamed`.** The interim `merging`
  status and its `interim` field are gone: every surviving v1 id now carries
  `status: "renamed"` and a `to` that is registered and running in this release.
  Consumers read `to` directly.

  ```js
  import map from "@forkpoint/agent-lighthouse-core/migration-map.json";

  const v2IdFor = (v1Id) => {
    const e = map[v1Id];
    if (!e || e.status === "removed") return null; // gone, drop the series
    return e.to; // live in this release
  };
  ```

  The census is unchanged — 207 v1 ids, 26 `removed`, 181 `renamed` — but those
  181 point at only 148 distinct v2 ids.

  **Breaking: every remaining audit was rewritten to evidence-backed pass
  conditions.** A v1 audit passed when a pattern matched; a v2 audit passes when
  the dossier says the agent-visible signal is actually present. Pass conditions,
  thresholds, `na` handling and priorities all moved, so **the same site will
  score differently on the same audit id**. There are no holdovers: the last six
  — `agent-interfaces/webmcp-registered-tools`,
  `access-crawl-control/ai-content-declaration`, `access-crawl-control/tdm-rep`,
  `operability-safety/form-error-messages`, `answer-readiness/direct-definitions`
  and `agent-interfaces/cors-api-routes` — were rewritten too, and four of them
  changed shape enough to be worth calling out:

  - `agent-interfaces/webmcp-registered-tools` no longer reads
    `/.well-known/webmcp`, an invented path with no spec and no IANA
    registration; it reports tools registered at runtime through
    `navigator.modelContext` and returns `na` when it cannot see any, since it
    has no JavaScript runtime. A guaranteed high-priority zero on nearly every
    site becomes `na`. The exported class is renamed `WebmcpManifestAudit` →
    `WebmcpRegisteredToolsAudit`, and `/.well-known/webmcp` is dropped from the
    root-file fetch list, so scans issue one fewer request.
  - `access-crawl-control/ai-content-declaration` stops demanding a meta tag that
    does not exist and stops claiming GPTBot and ClaudeBot read it. It passes on
    an AIPREF `Content-Usage` header or robots.txt rule, warns on
    `noai`/`noimageai` with the "no documented consumer" caveat, and is `na`
    otherwise.
  - `access-crawl-control/tdm-rep` reports `tdm-reservation` 1 (rights reserved)
    and 0 (mining permitted) as distinct outcomes rather than one shared pass,
    validates the well-known file against the spec's array-of-objects shape
    behind a content-type and leading-`<` guard, reads the `tdm-reservation`
    response header, and returns `na` when nothing is declared instead of a
    `warn` on nearly every scan (the audit is weight 0, so no score moved).
    `audit()` is now synchronous.
  - `agent-interfaces/cors-api-routes` probes the endpoints the OpenAPI document
    declares (`servers[].url` plus concrete paths, `isSafeUrl()`-gated) instead of
    a hardcoded `/api/`, requires an `Access-Control-Allow-Origin` that admits a
    third-party origin, and is `na` for any site that publishes no OpenAPI
    document.

  `operability-safety/form-error-messages` and `answer-readiness/direct-definitions`
  moved too — see the list below.

  The changes that move the most results:

  - `access-crawl-control/robots-directives` now warns on `nosnippet`,
    `noarchive` and `max-snippet:0` — no v1 audit did. Sites with a deliberate
    AI-snippet policy will see a new warn.
  - `access-crawl-control/sensitive-paths` fails, instead of warning, when the
    crawl observed low-value URL families (cart, checkout, search, login,
    account, admin) and none of them is disallowed for AI crawlers — including
    when no `robots.txt` is served at all; warning would have scored deleting the
    file above shipping an empty one. A site whose crawl surfaced no such family
    returns `na` before `robots.txt` is read, so a missing file alone never
    fails this audit.
  - `answer-readiness/dates-on-content` warns on publication-only dates that
    claim to be current, and `answer-readiness/review-signals` warns when review
    counts come from a third-party widget rather than markup.
  - `agent-interfaces/openapi-exists` returns `na` (not `fail`) when a site
    exposes no API surface at all, and ships informative at weight 0 until a
    documented consumer exists. `agent-interfaces/ai-catalog-metadata` and
    `ai-catalog-urls` return `na` when there is no manifest, which removes two
    guaranteed zeros from every no-catalog scan and raises `agent-interfaces`
    scores accordingly.
  - `content-extraction/server-responsiveness` scores TTFB on pinned 800 ms /
    2500 ms bands, absorbing the old `fast-response-time` signal.
  - `content-extraction/aside-element` goes from a binary to a three-state
    result, and `operability-safety/security-header-hygiene` never returns
    `fail` — it is informative at weight 0 by design.
  - `operability-safety/form-error-messages` stops passing a whole site on one
    input carrying `aria-describedby`. It reports coverage as a ratio over the
    fields the server rendered as `aria-invalid`, or — the normal case on a GET —
    over the required fields, accepts `aria-errormessage` on equal terms, counts
    fields outside a `<form>`, and is `na` when nothing declares a constraint. A
    site with one wired input among many now warns; a site using
    `aria-invalid` + `aria-errormessage` now passes instead of being warned.
  - `answer-readiness/direct-definitions` drops its bold-colon branch, which
    every `<strong>Note:</strong>` satisfied, gates on definitional intent
    detected structurally and in eleven languages, counts CJK definitions
    correctly, and reports prose definitions instead of failing them. It never
    returns `fail`.

  **Breaking: `_a11y.ts` is gone, split into 17 per-rule audit files.** The
  accessibility rules were a single module behind a shared base class; each rule
  is now its own file under `operability-safety/` with its own dossier, and the
  exported audit classes lost their `A11y` prefix (`A11yLandmarkUniqueAudit` →
  `LandmarkUniqueAudit`, and so on). Audit ids and metadata are unchanged — only
  importers of the class symbols are affected.

  Every id, every fold and the reasoning behind each one is in the audit-by-audit
  table at
  [docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md);
  the per-audit evidence, grades and sources are in
  [docs/evidence/audits/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/audits/README.md);
  the upgrade guide is
  [MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md).

- b0adaf5: v2 polish wave: engine fixes, tier surfacing, two live CLI flags.

  **Scoring change.** A category where every check is notApplicable now leaves the
  overall denominator. A site with no commerce surface is no longer scored down
  for having no checkout, so narrow sites score higher than they did on the same
  registry. That is the intended correction.

  **Security fix.** `isSafeUrl` now gates every hop of a redirect chain, not just
  the URL the caller passed — a site could previously redirect the scanner into
  link-local or RFC 1918 space. `FetchResult.finalUrl` is now the URL that
  actually answered.

  **Fixed:** `AuditResult.details` no longer silently drops unknown keys, so an
  audit's structured evidence reaches the report; `fail()` and `warn()` no longer
  discard a per-result fix snippet in favour of the generic one.

  **New:** advisory and experimental checks are badged in the HTML report, marked
  in terminal output, counted in the markdown summary and filterable in the audit
  explorer, so a weight-0 check no longer reads as a defect. `--categories <list>`
  finally filters the registry and rejects unknown ids; `--experimental` opts in
  to experimental-tier audits, which are excluded by default.

  Also: nine audit-behavior defects, five strengthened tests, and the website
  audit explorer regenerated from the live 172-audit registry.

- b0adaf5: v2 registry: evidence-mass overall score and an enforced audit contract.

  **Breaking: `CATEGORY_WEIGHTS` is gone.** A category's share of the overall score is no longer a hand-tuned percentage; it is the category's _evidence mass_ — the summed weight of its registered audits — exported as `CATEGORY_MASS` and derived from the registry:

  ```
  overall = Σ(categoryScore × categoryMass) / Σ(categoryMass)
  ```

  A category made only of informative/experimental audits has mass 0 and cannot move the overall score. Scores shift accordingly: influence now follows proven evidence (e.g. Access & Crawl Control carries 29 mostly grade-A audits and weighs far more than its old 0.08).

  **Breaking: `AuditMetaSchema` enforces the v2 contract.** `evidenceGrade`, `tier` and `dossier` are required — an audit must state where its weight comes from and which dossier proves it — and `id` must match `AUDIT_ID_PATTERN` (`/^[a-z-]+\/[a-z0-9-]+$/`, i.e. `category/slug`), so numeric v1 ids no longer validate. Translating an existing id is covered in the taxonomy note.

  **Breaking: `buildCategoryResult(id, checks, mass?)`** takes the category's evidence mass instead of looking up a weight table; omitted, the category weighs nothing.

  The registry itself is now sourced from the eight category `index.ts` files, so adding an audit to a category folder registers it. Readiness vitals were remapped onto v2 ids: `botAccessibility` reads the `access-crawl-control` category and `technical` reads `content-extraction`.

- b0adaf5: v2 taxonomy: 8 agent-journey categories, `category/slug` ids, 8 more sunsets.

  **Breaking: the 10 v1 categories are replaced by 8 built around what an agent
  actually does with a site.** Gone: `content-discoverability`,
  `crawler-permissions`, `meta-tags`, `semantic-html`, `technical-readiness`,
  `answer-engine`, `generative-engine`, `agent-tools`, `accessibility`,
  `structured-data` as v1 defined it. In their place:

  | category               | what it answers                                   |
  | ---------------------- | ------------------------------------------------- |
  | `access-crawl-control` | can an agent reach the site at all                |
  | `content-extraction`   | can it get clean content out of a page            |
  | `machine-discovery`    | can it find the machine-readable surfaces         |
  | `structured-data`      | is the meaning explicit rather than inferred      |
  | `answer-readiness`     | is a page answerable without the rest of the site |
  | `agent-interfaces`     | is there something an agent can call              |
  | `agentic-commerce`     | can an agent transact                             |
  | `operability-safety`   | is the site safe and stable to operate against    |

  Membership changed with the names: an audit keeping its slug did not
  necessarily keep its home (`technical-readiness/https-enabled` is scored under
  `access-crawl-control`, `semantic-html/image-alt-text` under
  `content-extraction`, `generative-engine/descriptive-urls` under
  `answer-readiness`). Category scores are not comparable across the major.

  **Breaking: numeric ids are gone.** v1 identified audits by a `major.minor`
  number whose major half encoded the old taxonomy. `CheckResult.id` is now a
  `category/slug` path — `machine-discovery/llms-txt-exists` — validated by
  `AUDIT_ID_PATTERN`. Nothing in a v2 report, CLI output or MCP payload carries a
  numeric id, and `--debug-audit` takes a slug id.

  **Translate v1 ids with the shipped map.**
  `@forkpoint/agent-lighthouse-core/migration-map.json` is keyed by v1 numeric id
  and carries all 207 of them: 181 `renamed` (use `to`, which is registered and
  running in this release) and 26 `removed` (nothing to re-point at). Every
  surviving entry links its evidence dossier. Note that the 181 `renamed` entries
  point at only 148 distinct v2 ids — several v1 series collapse onto one — see
  the merge-wave note in this release.

  ```js
  import map from "@forkpoint/agent-lighthouse-core/migration-map.json";

  const v2IdFor = (v1Id) => {
    const e = map[v1Id];
    if (!e || e.status === "removed") return null; // gone, drop the series
    return e.to; // live in this release
  };
  ```

  **Breaking: 8 more audits are removed as not-a-factor**, on top of the 18 sunset
  in 1.0.0 — 26 v1 audits are now gone in total. The 2026-08-21 grading pass
  graded these D (or, for `1.18` mobile-friendly, `unrated`), and the adversarial
  evidence review could not name a consumer:

  `1.18` mobile-friendly, `1.23` commerce-links, `7.22` marquee, `8.14`
  no-render-blocking, `8.15` image-dimensions, `8.16` lcp-not-lazy, `8.19`
  privacy-policy, `8.20` terms-of-service.

  They no longer run, no longer appear in any report, and no longer emit a
  `CheckResult`. Dashboards keyed on those ids need the series dropped. Rationale
  and sources:
  [docs/evidence/sunset/](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/README.md).

  **Breaking: `SECTION_GROUPS` is regrouped** onto the v2 categories. The three
  group keys and labels are unchanged, but membership and the flattened
  `CATEGORY_ORDER` every surface renders from are not — notably `structured-data`
  now reports under **AI Search Optimization** rather than Technical Foundation:

  - **Agentic Readiness** — `access-crawl-control`, `machine-discovery`,
    `agent-interfaces`, `agentic-commerce`
  - **AI Search Optimization** — `content-extraction`, `structured-data`,
    `answer-readiness`
  - **Technical Foundation** — `operability-safety`

  Consumers pinning section membership or category ordering must be updated.

  The full upgrade guide is
  [MIGRATION.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/MIGRATION.md);
  the audit-by-audit v1 → v2 table, with the reasoning behind every move, merge
  and split, is in
  [docs/evidence/v2-audit-map.md](https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/v2-audit-map.md).

- b0adaf5: Weighted category scoring, plus the gatherer helpers the v2 audits are built on.

  **Breaking: a category score is now a weighted mean, not a flat average.**

  `calculateCategoryScore` previously averaged the `score` of every applicable check equally. It now weights each check by the `weight` declared in its audit meta:

  ```
  score = Σ(check.score × check.weight) / Σ(check.weight)
  ```

  Not-applicable checks (`status === 'na'`) stay out of the denominator, as before. What changed is that evidence strength now moves the number.

  **New: an audit's weight is derived, not chosen.** Every audit declares an `evidenceGrade` (`A` | `B` | `C` | `D`, taken from its evidence dossier) and a `tier` (`scored` | `informative` | `experimental`), and its weight is a pure function of the two — exported as `weightForGrade(grade, tier)`:

  - `scored` + grade `A` → `1.0`; `scored` + grade `B` → `0.6`; `scored` + grade `C` or `D` → `0`.
  - `informative` and `experimental` → `0` at any grade. These audits still run and still report their findings, but they are deliberately unable to move a score, and every surface that ranks or scores checks filters them out of recommendations, top fixes/passes and readiness vitals.

  `CheckResult` now carries `evidenceGrade` and `tier` alongside `weight`, so a consumer can see why a check weighed what it did without reaching back into the registry. **Expect published scores to shift for the same site**; they are not comparable to scores from a previous release.

  Two consequences worth calling out for anyone constructing `CheckResult` objects directly rather than via `Audit`:

  - A check with no `weight` contributes nothing to either side of the ratio. A category whose checks all lack a weight totals zero weight and scores `0`.
  - `AuditMetaSchema.weight` now accepts `0` (it required a positive number before), which is what makes the informative tier expressible.

  **New in `CheckResult`:** an optional `weight` field, stamped from `AuditMeta.weight` when the audit produces the check, so a consumer can see the weight that scoring actually applied.

  **New in `FetchOptions`:** a `userAgent` option that overrides the default scanner User-Agent for a single request — used to probe a site as a specific AI crawler.

  **Newly exported gatherer helpers**, previously internal:

  - `./gatherers/fetch-classify` — `classifyFetch`, `isRealFile`, `stripBom`, `normalizeNewlines`, and the `FetchClass` / `ExpectedKind` types. Classifies a fetched root file as `ok`, `soft-404`, or `error` from body evidence rather than trusting status 200.
  - `./gatherers/robots` — `parseRobots`, `matchesUserAgent`, `groupsForBot`, `isPathAllowed`, `isBlanketBlocked`, and the `RobotsRule` / `RobotsGroup` types.
  - `./gatherers/bot-probe` — `probeAsBot`, `BotProbeResult`, and `BotProbeSignal`, for detecting edge blocking that targets AI crawler user agents. A result reports `signal: 'ok' | 'blocked' | 'inconclusive'`, where `inconclusive` means the probe never completed and is explicitly not a pass; the `edgeBlocked` boolean is a convenience mirror of `signal === 'blocked'`.
  - `./gatherers/pages` — `pagesOfType`, `judgePages`, and `PageJudgement`, for judging every crawled page instead of generalizing from the first one.
  - `topLevelJsonLd` and `allJsonLdNodes` — JSON-LD traversal with an explicit depth contract. `topLevelJsonLd` expands arrays and `@graph` while propagating `@context`, but does not hoist nested property objects; `allJsonLdNodes` walks the whole graph for audits that legitimately search deep.

### Minor Changes

- 40064df: A scan can now emit one record per audit, so a verdict can be traced back to
  the evidence it came from.

  A report says what each audit concluded. It does not say which audits never ran
  and why, how long each took, or what a verdict was drawn from — and an audit
  that produced nothing looks the same in a report as one that considered the
  question and answered "not applicable".

  `--trace [path]` writes one NDJSON record per registered audit, including the
  ones skipped before running and the ones that errored. Each record carries the
  outcome (`ran`, `skipped`, `error`), the status, score, weight, tier and grade,
  the wall time inside `audit()`, and the structured evidence behind the verdict.
  The file is truncated at the start of a scan and appended to as it runs, so a
  crash still leaves everything up to the point it stopped. Two runs produce two
  comparable files.

  Programmatically, `runScan` takes an `onAuditTrace` handler that receives the
  same records. With neither, `LOG_LEVEL=debug` logs one line per audit; with
  none of the three, nothing is built.

- 3d23272: Every audit result now carries `details.evidenceUrl`, the address of that audit's
  evidence dossier on the documentation site, and the HTML report links it. The
  address is also available on its own: `evidenceUrl(id)` is a new public export of
  `@forkpoint/agent-lighthouse-core`, so a consumer can build the dossier link for
  any audit id without running a scan.

  The 68 audits whose `docsUrl` pointed at raw markdown on GitHub now point at the
  rendered page; the 92 that point at an external specification are unchanged.

  Those addresses are served by the documentation site, which is now an Astro build
  publishing all 215 dossiers as their own pages rather than a single hand-maintained
  HTML file.

### Patch Changes

- 40064df: `operability-safety/stateful-control-introspectability` no longer errors out on
  a page whose controls each carry their own state class.

  Its summary line named every distinct state class it found. That list comes
  from the page, so a storefront whose components each declare their own class
  pushed `displayValue` past the schema's 1000-character cap, and the runner
  replaced the whole audit with a `scan-error` stub. The line now names three
  classes and counts the rest.

  Found on a live storefront. The audit-result contract fixture now gives every
  element its own class name, so the same overflow fails in CI rather than on a
  site.

- d2d16ba: Four audits no longer error out on the storefronts where they find the most to
  report.

  `AuditResultSchema.details` admits scalars and bounded string arrays: at most
  100 entries of at most 1000 characters. `ghost-clickable-element-ratio` and
  `stateful-control-introspectability` attached their own finding objects,
  `section-split-risk-profile` emitted one entry per section on pages with more
  than 100 of them, and `trust-txt-reciprocity-coherence` quoted remote attribute
  values of unbounded length. The runner validates every result and turns a
  rejection into a `scan-error` stub, so each of these reported nothing at all on
  exactly the pages that tripped it — `ghost-clickable-element-ratio` on 28 of 30
  live Shopify stores.

  All four now render their findings through a shared helper that applies both
  caps, and a contract test runs every registered audit against a deliberately
  oversized page and validates the result against the schema, so the failure mode
  cannot return unnoticed.

- 3d23272: Fixes two unbounded loops in the provenance path, both reachable from ordinary
  site-controlled image bytes.

  `riffChunks` read a WebP chunk size with `<< 24`, which returns a negative
  number once the high bit is set. A negative length walked the cursor backwards
  and the loop never terminated, so one malformed or hostile WebP hung the scan
  indefinitely. The size is now read as an unsigned 32-bit value.

  `certificatesIn` tried a DER parse at every offset that looked like a
  certificate header. A blob of repeated `30 82` bytes bought one parse attempt
  per byte — 2 s of CPU per megabyte, up to six images per scan. Attempts are now
  capped at 256, well above the 2–4 certificates a real chain carries.

- d2d16ba: `operability-safety/aria-layer-injection-scan` and
  `operability-safety/native-control-substitution` no longer error out on a page
  whose ids the CSS identifier grammar rejects.

  Both resolved an `aria-labelledby`, `aria-describedby` or `aria-controls`
  reference by interpolating the id into a `#id` selector. An id is any
  non-whitespace string, and React's `useId` emits ids like `:r0:`, which parse
  as a pseudo-class: a live storefront killed `aria-layer-injection-scan` with
  `Unknown pseudo-class :-tab-0`, and the runner turned the throw into a
  `scan-error` stub, so the audit reported nothing for that store. Both now
  resolve the reference through an attribute selector, which has no identifier
  grammar to violate.

- 3d23272: Rename the shouted documentation filenames to lowercase (`docs/CLI.md` →
  `docs/cli.md` and ten others). Published site routes are unchanged; only the
  source filenames and the links between them move.
- 3d23272: Stops `content-extraction/markdown-alternate` reporting a component tag that the
  document only quotes.

  The component scan read the raw markdown, so a capitalised tag inside a fenced
  example or an inline code span counted as a component the renderer had failed to
  resolve. A markdown alternate of a documentation page is the likeliest place to
  quote JSX, which meant the audit reported the faithful case as the broken one —
  `warn`, score 0.5, with the quoted tag named in `found`.

  The scan now runs over the document with fenced blocks and inline code spans
  removed. Indented code blocks are deliberately left in place: four leading
  spaces is also how a list item continues, and dropping list bodies would hide
  real unresolved components in order to fix a rarer false positive.

  Sites whose alternate quotes JSX move from `warn`/0.5 to `pass`/1. Nothing else
  changes: no evidence, grade, tier or weight moves, and a component tag that is
  genuinely unresolved is still reported.

- 3d23272: A not-applicable check now carries the audit's plain title instead of its
  failure title.

  `failureTitle` names what went wrong, and `toCheckResult` was giving it to every
  non-passing status — including `na`. A not-applicable check did not go wrong:
  its precondition was absent. The result was a report row that read
  "Meta-ExternalAgent disallowed by robots.txt" over a site that serves no
  robots.txt at all, or "The markdown alternate this site serves is not usable"
  over a site that serves none.

  Reports and the JSON output carry the corrected titles. No score changes: `na`
  was already excluded from scoring.

- 40064df: A `scan-error` now says which field failed instead of pasting the whole
  validation tree.

  When an audit's result is rejected by `AuditResultSchema`, the runner records
  it as a `scan-error` stub whose explanation carried `err.message`. For a Zod
  rejection that is the entire issue tree — several hundred lines of JSON for one
  bad field, written into every report the scan produces. The explanation now
  names at most three field paths and their reasons
  (`details.ghosts: Expected string, received object`), and any other long
  message is truncated rather than pasted whole.

- 3d23272: Fix `operability-safety/stateful-control-introspectability` erroring on every
  page that holds a state-bearing control. `details.opaque` carried objects,
  which `AuditResultSchema` rejects; each finding is now one line of text.

## 1.0.0

### Major Changes

- 5c84ed9: **Removed 18 audits with no proven consumer ("not a factor").** They no longer
  run, no longer appear in any report, and no longer emit a `CheckResult` under
  their old id. An adversarial evidence review — one researcher per audit, tasked
  with _redeeming_ it by naming a consumer with grade A/B evidence — could not
  find one for any of these: either nothing reads the signal, or the only thing
  that ever did publicly stopped (OpenAI archived the ai-plugin.json spec; Google
  states it no longer uses rel=prev/next). Shipping them as informative would
  have kept noise on the report with a badge attached, so they are deleted.

  Removed audit ids: 1.21, 3.10, 3.16, 4.12, 4.14, 4.17, 5.4, 5.11, 5.17, 5.25,
  6.12, 6.16, 7.1, 8.5, 8.6, 8.17, 8.21, 10.12.

  **Expect scores to move for the same site.** Every category score, the overall
  score, and `readinessVitals` / the derived `readinessScore` can come out
  different — the removed checks are gone from the denominators. Audit 8.21
  (framework-detection) in particular used to feed a near-constant pass into the
  technical vital, propping it up regardless of the site; that unearned signal is
  gone, so the new number can be lower and is the honest one.

  **Consumers keying on these check ids must migrate via `migration-map.json`,**
  shipped in the core package and keyed by v1 audit id. Each entry carries
  `slug`, `status: "removed"`, `reason: "not-a-factor"`, and a `link` to that
  audit's rationale anchor. Look every missing id up there before treating its
  absence as a scan failure; a `"removed"` id has no replacement to re-point a
  dashboard at. See `MIGRATION.md`.

  Full rationale — steelmanned claim, why it is not a factor, verdict and sources
  per audit, plus the complete research dossiers — lives in
  `docs/evidence/sunset/not-a-factor.md`.

  Also in this release: the exported `calculateCategoryScore` now excludes
  informative checks from its mean, so its return value changes for any input
  containing them (previously they counted like any other check). Callers
  constructing `CheckResult` objects directly should expect a different result
  for the same array. The deprecation machinery — `AuditMeta.deprecated` /
  `CheckResult.deprecated` (`DeprecationNotice { notice, link }`), the
  `isInformative` predicate, and the report's deprecation-notice rendering — is
  kept for future deprecations and the planned informative tier.

## 0.4.0

### Minor Changes

- 7fe831f: Add structured scan progress events:
  - Core: typed `ScanEvent` stream via `runScan(url, { onEvent })` — phase/unit events with computed monotonic `fraction` and `elapsedMs`, per-audit progress, and `unit:fail` visibility for errored audits
  - CLI: interactive progress renderer (spinner, progress bar, ETA, per-phase summary lines) and `--progress-json` NDJSON event stream on stderr
  - MCP: `notifications/progress` forwarded when the request carries a `progressToken`

  Breaking (pre-1.0): the legacy progress callback forms were removed, not just deprecated —
  - `runScan(url, onProgress, pageOverrides, signal)` → use `runScan(url, { onEvent, pages, signal })`
  - `runAudits(ctx, config, (completed, total) => …)` → use `runAudits(ctx, config, (event: AuditProgressEvent) => …)`; an optional precomputed `AuditPlan` from `planAudits` can be passed as a fourth argument
  - The `ProgressCallback` and `AuditProgressFn` types are no longer exported

## 0.3.0

### Minor Changes

- 5569df0: Add 8 new AI-readiness audits:
  - SVG context bloat — detects inline SVGs bloating agent context (6.18)
  - Token-to-content ratio — flags pages where markup tokens dwarf actual content (6.19)
  - Fake headings — detects heading-styled elements that skip semantic `<h1>`–`<h6>` tags (6.20)
  - Form backend actionability — checks forms expose actionable backends agents can submit to (5.27)
  - Product transactional certainty — verifies Product schema carries machine-readable offer/price/availability signals (3.24)
  - TDM-Rep data-mining rights — detects declared text-and-data-mining usage rights (2.27)
  - AI crawler vs conversational agent separation — checks robots.txt distinguishes training crawlers from user-driven agents (2.28)
  - OpenAPI description quality — scores endpoint descriptions for LLM tool-calling usability (5.26)

## 0.2.4

### Patch Changes

- 23ad2b8: Relicense the project and published packages from GPL-3.0-only to Apache-2.0.

## 0.2.3

### Patch Changes

- c845f40: Use package metadata for generated report and MCP version labels, and avoid stale static docs version badges.

## 0.2.2

### Patch Changes

- 229c08b: Add launch, showcase, and badge assets, and refresh generated report and MCP version labels.

## 0.2.1

### Patch Changes

- 939a2c6: Improve package discoverability with clearer descriptions, npm README pages, expanded keywords, promotion assets, and an accurate CLI version banner.

## 0.2.0

### Minor Changes

- 54ef55c: Initial release of Agent Lighthouse:
  - Core gatherer & audit engine with 10 audit categories for agentic readiness
  - Standalone zero-dependency HTML report generator with SVG score gauges
  - Zero-config terminal CLI (`@forkpoint/agent-lighthouse`)
  - Model Context Protocol (MCP) server
