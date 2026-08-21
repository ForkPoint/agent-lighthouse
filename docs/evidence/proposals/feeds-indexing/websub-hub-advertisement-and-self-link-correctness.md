---
check: websub-hub-advertisement-and-self-link-correctness
title: "WebSub hub advertisement and self-link correctness"
domain: feeds-indexing
status: proposed
evidence_grade: C
uniqueness: unique
difficulty: static-fetch
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# WebSub hub advertisement and self-link correctness

> Proposed check. Evidence grade **C** · unique · implementation: `static-fetch`

## What it checks

Checks whether feeds advertise a push hub per the WebSub Recommendation, and — more importantly — whether the mandatory rel=self link is present, absolute, and equal to the URL the feed was actually fetched from, since a wrong self-link breaks hub verification even when a hub is configured.

## Claimed mechanism (falsifiable)

WebSub is a W3C Recommendation requiring publishers to advertise at least one rel=hub and exactly one rel=self via Link headers or embedded link elements, with Link headers taking discovery precedence. Falsifiable claim: a feed declaring a hub but carrying a missing, relative, or non-canonical rel=self cannot complete hub subscription verification, so the push path silently degrades to whatever polling cadence subscribers happen to use — the failure is invisible to the publisher because the hub appears configured. This check is scored as advisory only: the WebSub conformance assertion is exact and standards-backed, but no AI answer engine is documented as a WebSub subscriber, so the consumer-side benefit is a plausible convention rather than documented behaviour.

## Evidence

- **[WebSub (W3C Recommendation)](https://www.w3.org/TR/websub/)** — W3C (spec, URL verified 2026-08-20)
  - W3C Recommendation. Publishers 'MUST implement at least one' of Link Headers or embedded link elements, advertising at least one rel=hub and exactly one rel=self (the canonical topic URL). Discovery checks Link headers first, then embedded link elements; for HTML, link elements are recommended in <head> only.
- **[RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287)** — IETF (spec, URL verified 2026-08-20)
  - Sec 4.1.2: atom:entry MUST contain exactly one atom:id (permanent, universally unique IRI that 'must not change across different instantiations of the entry') and exactly one atom:updated ('most recent modification time that the publisher considers significant'). atom:entry MUST contain atom:summary when atom:content carries a src attribute (and is thus empty), or when content is Base64-encoded. MUST NOT contain more than one atom:summary.
- **[schema.org DataFeed](https://schema.org/DataFeed)** — schema.org (spec, URL verified 2026-08-20)
  - DataFeed = 'a single feed providing structured information about one or more entities or topics'; hierarchy Thing > CreativeWork > Dataset > DataFeed; primary property dataFeedElement accepting DataFeedItem/Text/Thing; DataFeedItem examples use dateCreated, dateModified, item. Adoption is only 1K-10K domains per Google's web index (July 2026 aggregation) — too thin to score against.

## Competitor coverage

The W3C Feed Validator flags a missing atom:link rel=self but does not compare it to the fetch URL, does not check Link headers, and does not liveness-probe the hub. No SEO or AI-visibility product covers WebSub at all.

## Implementation sketch

For each discovered feed: (1) inspect HTTP Link response headers first (per the spec's precedence order) for rel=hub and rel=self; (2) fall back to <link rel="hub"> / <atom:link rel="self"> elements inside the feed document, and for HTML pages accept them only within <head>. (3) Assert exactly one rel=self and that its href is absolute and, after normalization, equal to the URL the feed was fetched from (FAIL on relative hrefs, http-vs-https mismatch, or a self-link pointing at a different path). (4) Assert at least one rel=hub with an absolute HTTPS href; HEAD the hub URL and accept 2xx/400/405 as alive, FAIL on DNS failure, connection refused, or 5xx. (5) When no hub is declared, emit INFO with a remediation pointing at hosted hubs, never a FAIL. Report as an advisory badge outside the scored total until an AI-side subscriber is documented.

## Example failure

A WordPress site with the PubSubHubbub plugin emits `<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>` alongside `<atom:link rel="self" href="/feed/"/>` — a relative href. Every hub subscription attempt fails verification because the topic URL cannot be resolved to the canonical feed, so the site has push infrastructure installed, a plugin reporting success, and zero actual fanout.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
