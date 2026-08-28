---
'@forkpoint/agent-lighthouse-core': minor
---

A scan can bring its own undici dispatcher, so a caller can bound how many
connections it opens per origin.

`ScanOptions` gains `dispatcher`, `createFetcher` takes an optional
`{ dispatcher }`, and `boundedDispatcher(connections)` is exported for callers
that would rather not depend on undici to express one line of politeness.

Nothing changes for a caller that passes none. The scanner keeps its shared
`new Agent()`, whose per-origin connection count is unlimited: a scan issues its
~28 root-file requests in one `Promise.all` and then up to five pages in
parallel, and for a site owner scanning their own site finishing quickly is the
right trade.

It is the wrong trade for a caller scanning origins that did not invite it. That
28-socket burst is what a per-IP WAF counts, and the nightly corpus job
(`scripts/scan-site-list.ts`) now passes `boundedDispatcher(2)` so the 400
strangers in a night's window each see at most two connections at a time.

**A bounded dispatcher alone measures the wrong thing**, which is why
`ScanOptions` and `createFetcher` also gain `maxConcurrent`. `Agent({
connections: 2 })` accepts all 26 root-file requests the scan fires in one
`Promise.all` and queues 24 of them inside undici — while the 10-second
per-request deadline and the `ttfbMs` clock both start when `fetch()` is
called. On an origin averaging more than ~770 ms per file the tail aborts on
the scanner's own queue and the report records those root files as unreachable,
and the same queueing inflates `ttfbMs` for the later sampled pages and the
UA-parity refetches — enough to move `content-extraction/server-responsiveness`,
which bands at 800 ms and 2500 ms, on a healthy origin.

`maxConcurrent` holds a request in a FIFO queue in front of the fetcher, before
either clock starts, so what the deadline and `ttfbMs` measure is the origin.
The library's own default is unchanged: omit it and every request is issued as
it arrives, with the timeout it always had. The nightly job passes it alongside
the dispatcher, at the same number, so a bounded run never queues inside undici.

`ScanOptions` also gains `robotsTxt`, a `robots.txt` response the caller
already holds, used in place of fetching it again. It is for a caller that must
read the file before it decides to scan at all — the nightly job asks
permission first, and without this every site it visits is asked twice for the
one file its owner watches. It must be the response to `<baseUrl>/robots.txt`
fetched with this scanner's own user agent; a caller that passes something else
makes the scan judge a file it was not served. Omitted, the scan fetches it as
before.
