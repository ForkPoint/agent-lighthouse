---
'@forkpoint/agent-lighthouse-core': major
---

The text metric behind `content-extraction/server-rendered` now reads the served HTML body instead of the first `<main>` element.

The audit used to measure `getMainContentText`, which returns a page's main content region. That helper took the first `<main>` whenever any existed, so a site that ships an empty `<main>` wrapper, or several `<main>` elements of which the first is a stub, was measured as serving no content at all. Two real storefronts in the benchmark were failed at critical priority on that basis: one with a single empty `<main>` and 194 words elsewhere in its body, one with four `<main>` elements the first of which held 49 characters. Both now pass.

The audit reads a new exported helper, `getRenderedText`, which returns the whole `<body>` minus `script`, `style`, `noscript` and `template`. Its word count comes from that same text. The pass threshold is unchanged: more than 50 words or more than 200 characters.

`getMainContentText` keeps its job of describing the main content region, with its selection corrected. Among several `<main>` elements it now returns the one holding the most text rather than the first, and it falls back to `<body>` only when no `<main>` holds any text. The content audits that read it — dates, numbers, keyword density, content depth — still see navigation, headers and footers excluded. Pages with a single non-empty `<main>` are measured exactly as before.

Scan output changes for any site whose `<main>` is empty or fragmented: it stops being reported as serving no content.
