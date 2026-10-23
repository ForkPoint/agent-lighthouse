---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
"@forkpoint/agent-lighthouse-website": patch
---

Record the URL that answered a page request when redirects moved it to another page. `pageAttempts[].finalUrl` is new and optional; it is absent when the requested URL answered, or when only a trailing slash or fragment differs, and it never carries credentials. The page scope in terminal, HTML, Markdown and the website report viewer now reads `Fetch: https://example.com (redirected to https://www.example.com/) — read, HTTP 200`.
