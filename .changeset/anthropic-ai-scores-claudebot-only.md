---
"@forkpoint/agent-lighthouse-core": major
---

`access-crawl-control/anthropic-ai` now scores ClaudeBot only, and scores the access robots.txt grants rather than the shape of the file.

The check used to treat `anthropic-ai` and `ClaudeBot` as one bot family and pass if either token was allowed. Its own evidence never supported that. Anthropic's current crawler documentation names only ClaudeBot, Claude-User and Claude-SearchBot; the audit's research grades the legacy `anthropic-ai` token C with no known consumer and states that no points should be awarded or deducted for it. The combination rule moved points in both directions anyway: a site with `User-agent: anthropic-ai` / `Allow: /` beside `User-agent: ClaudeBot` / `Disallow: /` scored full marks while Anthropic's only documented training crawler was completely blocked, and a stale legacy-only `Disallow: /` line produced a high-priority failure on a site ClaudeBot was free to crawl.

ClaudeBot alone now decides the result for this audit. A `User-agent: anthropic-ai` or `User-agent: Claude-Web` group is still detected and reported — the result carries a note saying the group is not a documented Anthropic access control, and `details.legacyTokens` lists what was found — but it no longer moves this audit's status or score in either direction. Note that `access-crawl-control/agent-governance` still recognises the legacy spelling when it counts named training crawlers; that is tracked separately in its own dossier.

The pass condition changed at the same time, for the same reason `access-crawl-control/meta-external-agent` changed earlier: the grade-A evidence is that Anthropic honours robots.txt, which is a fact about whether a disallow takes effect, not about whether a group names the token. Under RFC 9309 §2.2.1 an open catch-all grants a named crawler exactly the access a named group would, so both now pass. The `warn` band is gone.

**Which direction scores move.** Most sites go up. Any site whose robots.txt leaves ClaudeBot able to fetch `/` — through its own group, through an open `User-agent: *` group, or because no group applies to it — now scores 1.0 where an unnamed crawler previously took 0.5. Sites that block ClaudeBot still score 0, but the failure drops from `high` priority to `medium`, and its text no longer claims the block costs you visibility in AI search: Cloudflare Radar measures Anthropic's crawl-to-refer ratio at roughly 50,000:1, so what a block actually costs is inclusion in the training corpus. Sites that score 0 solely because of a stale `User-agent: anthropic-ai` / `Disallow: /` line, with ClaudeBot unrestricted, now pass. Sites that scored 1.0 on an `anthropic-ai` allow while blocking ClaudeBot now fail, which is the result that was always correct.

Sites that serve no robots.txt, serve a non-200, serve an empty body, or serve an HTML error page at `/robots.txt` are now **not applicable** instead of `warn`. A not-applicable check is excluded from scoring entirely, so the access-crawl-control category score for those sites is computed over one fewer check rather than being dragged toward 0.5 by a fact about a missing file.

The audit id, `access-crawl-control/anthropic-ai`, is unchanged, so nothing referencing it breaks. Its title, description and fix guidance now lead with ClaudeBot.
