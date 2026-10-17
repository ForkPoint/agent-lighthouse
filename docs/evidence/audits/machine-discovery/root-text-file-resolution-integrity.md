---
audit: machine-discovery/root-text-file-resolution-integrity
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/root-text-file-resolution-integrity.ts
slug: root-text-file-resolution-integrity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - indexnow-doc
  - indexnow-faq
  - bing-indexnow
---

# Root text-file resolution integrity (IndexNow key-file precondition)

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Proves the origin can actually serve and correctly 404 root-level .txt resources — the physical precondition for IndexNow key verification and for every other .txt-based agent discovery surface (llms.txt, ai.txt, security.txt, ads.txt). Sites behind SPA rewrites, WAF challenge pages, or HTML-404-with-200 handlers silently fail all of them.

## Claimed mechanism (falsifiable)

IndexNow proves ownership by fetching https://host/{key}.txt and byte-comparing the body to {key}; a non-matching body yields HTTP 403 ('key not found in file') and the submission is discarded by every participating engine (Bing, Yandex, Naver, Seznam, Yep, Amazon). Falsifiable claim: if GET https://host/<random-32-hex>.txt returns 200 rather than 404, the origin has a catch-all that returns non-key content for arbitrary root .txt paths. Key rotation, key removal and key-file health are then undetectable. The same catch-all makes every probe-based discovery file — llms.txt, ai.txt, security.txt — indistinguishable from a soft-404. Predicts: sites failing this probe cannot be given a trustworthy 'llms.txt present' verdict either, because a 200 response there carries no information.

## Evidence

- **[IndexNow Protocol Documentation](https://www.indexnow.org/documentation)** — IndexNow (Microsoft/Yandex) (spec, URL verified 2026-08-20)
  - Ownership is proven by hosting a UTF-8 text file at the host root named {key}.txt whose body is the key. Key must be 8-128 chars from [a-zA-Z0-9-]. Verification is a byte comparison. HTTP 403 is returned when the key is 'not found in the key file' or invalid. 422 signals a host or schema mismatch, 429 a rate limit, and 202 means 'key validation pending'. keyLocation restricts submittable URLs to the key file's directory and deeper. Batch POST accepts up to 10,000 URLs.
- **[IndexNow FAQ — participating search engines](https://www.indexnow.org/faq)** — IndexNow (vendor-doc, URL verified 2026-08-20)
  - Participating engines: Amazon, Bing, Naver, Seznam.cz, Yandex, Yep. Submissions to the global endpoint are shared with all participants. States IndexNow 'helps keep your content current in AI-powered search results' but names no specific LLM/Copilot consumer — the AI-consumer link is a vendor claim, not a documented pipeline.
- **[IndexNow: Instantly Index your Web Content in Search Engines](https://blogs.bing.com/webmaster/october-2021/IndexNow-Instantly-Index-your-web-content-in-Search-Engines)** — Microsoft Bing Webmaster Blog (vendor-doc, URL verified 2026-08-20)
  - Confirms the key-file-at-root verification flow and the motivation (organic discovery 'can take days or even weeks'). No published crawl-latency SLA.

## Example failure

A Next.js site deployed on a host with a catch-all rewrite `/(.*) -> /index.html` returns 200 text/html for `/a3f2c9d1e4b70856.txt`. The owner's real IndexNow key file also 200s, so Bing Webmaster shows 'key verified'. Then a framework upgrade reorders the rewrite ahead of static file serving. Every key fetch now returns the app shell, IndexNow starts answering 403 to all submissions, and the site loses push indexing across six engines with no visible symptom. The same origin returns 200 for /llms.txt, so an 'llms.txt present' badge from any auditor is a false positive.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- **Renamed** from `root-text-file-resolution-integrity-indexnow-key-file-precon`,
  which exceeds the 64-character id cap. The title and guidance state the
  IndexNow precondition instead.
- **Three requests only:** two random 32-hex `.txt` probes with
  `Cache-Control: no-cache`, and `/robots.txt` as the positive control. Each is
  `isSafeUrl()`-gated.
- **A missing `/robots.txt` warns rather than fails.** The positive control did
  not run. A served but mislabelled robots.txt is a different defect.
- **The redirect cap is the fetcher's shared limit of 20**, not the three a
  probe would need.
- **A probe redirected to another path reads as absent**, like a 404. A
  missing key file that redirects does not look like a real one. A redirect
  that keeps the path, such as a scheme or host change, is followed and judged
  on its final answer.
- **The audit never guesses an IndexNow key.** The catch-all precondition is
  what is measurable from outside.
- **The audit rests on IndexNow's byte-comparison behaviour**, not on the FAQ's
  AI-consumer claim.

## Deferred

- **Other audits do not consume `details.discoveryProbeReliable`.** Downgrading
  `llms.txt`, `ai.txt` and `security.txt` verdicts needs a channel between
  audits that the engine lacks.
- **A WAF challenge page is not told apart from an app shell.** Both land in
  the HTML classification arm.
- **The verdict is not narrowed to sites that rely on a root `.txt` file.** No
  signal shows that a site uses an IndexNow key, so every origin is judged.
