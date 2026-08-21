---
audit: agent-tools/ai-plugin-json
category: agent-tools
status: sunset
verdict: dead
evidence_grade: D
reviewed: 2026-08-21
---

# ai-plugin-json — confirmed dead — delete

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **D**.

## Claimed mechanism (steelmanned)

Steelmanned: /.well-known/ai-plugin.json was a genuine, vendor-defined manifest — OpenAI specified it, ChatGPT read it to install third-party plugins, and it carried fields (name_for_model, description_for_model, api.url pointing at an OpenAPI spec) purpose-built for model consumption rather than human display. The audit's fallback claim is broader than ChatGPT: that the format became a de-facto cross-vendor tool manifest, so 'even if you do not build a ChatGPT plugin' the file helps any agent understand the site as a callable tool. For the audit to matter, some currently-shipping agent would have to fetch that path and act on it.

## What we searched

With WebSearch unavailable I went straight to OpenAI's own properties. I attempted OpenAI's help-center deprecation article (HTTP 403, blocked). I then tested the audit's own docsUrl and the plugins docs root with curl following redirects, to establish whether OpenAI still publishes the manifest spec. I fetched developers.openai.com/apps-sdk to determine what OpenAI's current third-party extensibility mechanism actually is. I used the GitHub API to check the archival status and README of OpenAI's official openai/plugins-quickstart and openai/chatgpt-retrieval-plugin repos, which is where an official deprecation notice would live. I checked the IANA Well-Known URIs registry for an 'ai-plugin' registration. Finally I fetched the GPT Actions docs to confirm what replaced plugins.

## Best evidence found for the audit

The best evidence for the audit is historical only: ai-plugin.json was unambiguously a real, first-party OpenAI-specified manifest with a documented consumer (ChatGPT) during the 2023 plugins beta, and OpenAI's official quickstart repo still has 4,236 stars attesting to that era. I could find no currently-shipping consumer of the path on any vendor property. Searching for a surviving cross-vendor role turned up nothing: no Anthropic, Google, Microsoft, or Perplexity documentation references ai-plugin.json, and the path is not in the IANA registry. The strongest surviving artifact is a stars count on an archived repo — that is, evidence the format once mattered, not that it now does.

## Counter-evidence

Direct positive proof of discontinuation: (1) OpenAI's official openai/plugins-quickstart repository is ARCHIVED (GitHub API archived=true), with last push 2024-01-30T23:23:11Z, and its README states verbatim: 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' (2) OpenAI deleted the manifest specification from its docs entirely: the audit's own docsUrl https://platform.openai.com/docs/plugins/getting-started/plugin-manifest 301-redirects to https://developers.openai.com/api/docs/actions, which returns HTTP 404. The plugins docs root https://platform.openai.com/docs/plugins/introduction resolves to the same 404. There is no longer any OpenAI page describing ai-plugin.json. (3) OpenAI's current third-party extensibility surface, the Apps SDK, is built on MCP, not on plugin manifests — its docs describe building an MCP server to give an app 'tools and access to external systems' and never mention ai-plugin.json or plugin manifests. (4) The GPT Actions documentation that replaced plugins makes no reference to ai-plugin.json. (5) 'ai-plugin' / 'ai-plugin.json' are absent from the IANA Well-Known URIs registry.

## Verdict

**confirmed dead — delete** (grade D)

Grade D: the sole documented consumer (ChatGPT plugins) was discontinued, OpenAI archived its official quickstart with an explicit 'superseded by GPTs' notice, and OpenAI removed the manifest spec from its documentation so thoroughly that the audit's own docsUrl now 404s. No successor vendor adopted the format; OpenAI itself moved to MCP via the Apps SDK. The audit is worse than merely useless — it actively penalizes sites for omitting a manifest for a shut-down program and hands users a 404 link as remediation guidance. This is the cleanest 'dead' of the four: it fails not for lack of evidence but on positive proof of discontinuation. If any of the four had a case for being retained as a cautionary/informative example of a deprecated agent standard, it would be this one, but the rubric's grade-D rule is unambiguous and the audit as written scores sites against it.

## Sources

- **[openai/plugins-quickstart (ARCHIVED) — official ChatGPT plugin quickstart](https://github.com/openai/plugins-quickstart)** — OpenAI (repo, URL verified 2026-08-21)
  - GitHub API confirms archived=true, pushed_at=2024-01-30T23:23:11Z, 4,236 stars. README states verbatim: 'Plugins have been superseded by GPTs, learn more about creating a GPT with actions.' This is OpenAI's own first-party notice that the plugins program (and its ai-plugin.json manifest) is over.
- **[OpenAI plugin manifest documentation — removed (301 to 404)](https://platform.openai.com/docs/plugins/getting-started/plugin-manifest)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - curl -L shows a single 301 to https://developers.openai.com/api/docs/actions, which returns HTTP 404 (final_code=404). The plugins docs root /docs/plugins/introduction lands on the same 404. This is the exact docsUrl the audit ships, so its remediation link is broken; OpenAI no longer publishes any ai-plugin.json specification.
- **[OpenAI Apps SDK — current third-party extensibility, built on MCP](https://developers.openai.com/apps-sdk/)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - OpenAI's current mechanism for third-party apps in ChatGPT uses the Model Context Protocol: docs describe building an MCP server to 'add live data and controlled tools' and give an app 'tools and access to external systems.' No mention of ai-plugin.json or plugin manifests anywhere — confirming the successor is MCP, not a revived manifest.
- **[GPT Actions — Introduction](https://developers.openai.com/api/docs/actions/introduction)** — OpenAI (vendor-doc, URL verified 2026-08-21)
  - The successor documentation to plugins. Explains Actions via Function Calling with an OpenAPI example; contains no reference to ai-plugin.json, plugin manifests, or the /.well-known/ path.
- **[IANA Well-Known URIs Registry (checked for ai-plugin)](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - 'ai-plugin' and 'ai-plugin.json' are absent from the 180+ registered well-known suffixes — the path was never standardized beyond OpenAI's own vendor convention, so nothing outlived the program's shutdown.
- **[Winding down the ChatGPT plugins beta (OpenAI Help Center)](https://help.openai.com/en/articles/8988022-winding-down-the-chatgpt-plugins-beta)** — OpenAI (announcement, URL verified 2026-08-21)
  - (Resolves; returns 403 to non-browser clients — page exists, bot-blocked.) Could not be verified — the help center returned HTTP 403 to automated fetching, and web.archive.org is not fetchable from this environment. No claim is based on this document; the discontinuation is instead established by the archived openai/plugins-quickstart repo and the 404'd manifest docs, both verified directly.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **sunset** (graceful sunset per evidence-policy deprecation process; condensed rationale kept in NOT-A-FACTOR.md).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
