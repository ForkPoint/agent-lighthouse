---
"@forkpoint/agent-lighthouse-core": patch
---

A hiding marker on `<html>` or `<body>` no longer hides the page from the visibility helpers. Themes serve `<body style="visibility: hidden">` and reveal it on load; Readability removes the hidden body and rebuilds it from its children, so the text still reaches that reader. Audits that read visible text, among them `time-element`, `breadcrumb-schema`, `external-citations`, `fake-headings`, `semantic-lists` and `extractor-survival-recall`, now report on such pages instead of returning not applicable. Visible text also keeps a space at block boundaries and line breaks, so words from adjacent cells, list items or lines no longer fuse.
