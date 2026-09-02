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

## Competitor coverage

No evidence any tool probes for root .txt soft-404 as a discovery precondition. The Lighthouse Agentic Browsing category (per brief: llms.txt quality, WebMCP tools, agent a11y, layout stability) assumes the file it fetched is real. SEO crawlers detect soft-404s on HTML pages, not on the .txt discovery namespace, and none tie the result to IndexNow key verification.

## Implementation sketch

1. GET https://{host}/{32 lowercase hex}.txt with a cache-busting random name, no-cache headers, following <=3 redirects. Assert final status in {404,410}. 2) Repeat once with a second random name to exclude a coincidental real file. 3) If either returns 2xx, classify: body starts with '<' or contains '<html' in the first 512 bytes -> 'SPA/HTML catch-all'; Content-Type is text/html -> 'wrong content type'; body identical between the two random probes -> 'static catch-all'. 4) Positive control: GET /robots.txt and assert 200 with Content-Type starting 'text/plain' (some CDNs rewrite it to application/octet-stream or text/html, which breaks strict parsers). 5) Emit a derived flag 'discovery_probe_reliable' consumed by every other probe-based audit in the tool, so llms.txt/ai.txt/security.txt checks downgrade to INDETERMINATE instead of falsely passing. PASS = both random probes 404 AND robots.txt is text/plain.

## Example failure

A Next.js site deployed on a host with a catch-all rewrite `/(.*) -> /index.html` returns 200 text/html for `/a3f2c9d1e4b70856.txt`. The owner's real IndexNow key file also 200s, so Bing Webmaster shows 'key verified'. Then a framework upgrade reorders the rewrite ahead of static file serving. Every key fetch now returns the app shell, IndexNow starts answering 403 to all submissions, and the site loses push indexing across six engines with no visible symptom. The same origin returns 200 for /llms.txt, so an 'llms.txt present' badge from any auditor is a false positive.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `root-text-file-resolution-integrity-indexnow-key-file-precon`,
which would make a 76-character id; the schema caps an audit id at 64. The
IndexNow precondition is stated in the title copy and the guidance instead.

Steps 1–4 of the sketch ship exactly: two GETs of a 32-hex `.txt` name under
the scanned origin with `Cache-Control: no-cache`, the 404/410 assertion, the
three-way classification of a 2xx answer, and the `/robots.txt` positive
control. The audit sends exactly three requests and nothing else, each one
`isSafeUrl()`-gated.

**A missing `/robots.txt` warns rather than fails.** The sketch makes
`text/plain` a pass condition, which it remains — a warn is not a pass. But an
origin that serves no robots.txt at all has simply not run the positive
control, which is a different defect from one that serves the file and
mislabels it. `access-crawl-control/robots-directives` owns what robots.txt says when it
is there.

**The redirect cap is the fetcher's five, not the sketch's three.** The fetcher
refuses a redirect that leaves public address space and reports the final URL;
its hop limit is shared by every audit and is not worth a second code path.
Between three hops and five, no origin's answer for a missing `.txt` changes.

**Evidence hygiene.** All three sources are IndexNow documentation and support
the key-file mechanism. The AI-consumer link in the FAQ is a vendor claim, as
the dossier itself records; this audit rests on the byte-comparison behaviour,
which is documented, not on that claim.

## Deferred

- **Consuming `details.discoveryProbeReliable` from other audits.** The flag is
  emitted and reported, but downgrading `llms.txt`, `ai.txt` and `security.txt`
  verdicts to indeterminate needs a scan-level artefact bus that does not
  exist: audits receive a `CheckContext` and return a result, with no channel
  between them. Wiring it is a v2 engine change, not an audit change.
- **Fetching a real IndexNow key file.** The audit never guesses a key, and a
  key it does not know cannot be verified. The precondition is what is
  measurable from outside.
- **WAF challenge-page detection.** A challenge page answering 200 is caught by
  the HTML classification arm; telling a challenge apart from an app shell
  needs signals this audit does not collect.
