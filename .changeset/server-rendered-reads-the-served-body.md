---
'@forkpoint/agent-lighthouse-core': major
---

The text metric behind `content-extraction/server-rendered` now reads the served HTML body instead of the first `<main>` element.

The audit used to measure `getMainContentText`, which returns a page's main content region. That helper took the first `<main>` whenever any existed, so a site that ships an empty `<main>` wrapper, or several `<main>` elements of which the first is a stub, was measured as serving no content at all. Two real storefronts in the benchmark were failed at critical priority on that basis: one with a single empty `<main>` and 194 words elsewhere in its body, one with four `<main>` elements the first of which held 49 characters. Both now pass.

The audit reads a new exported helper, `getRenderedText`, which returns the whole `<body>` minus `script`, `style`, `noscript` and `template`. Its word count comes from that same text. The pass threshold is unchanged: more than 50 words or more than 200 characters.

`getMainContentText` keeps its job of describing the main content region, with its selection corrected. Among several `<main>` elements it now returns the one holding the most text rather than the first, and it falls back to `<body>` only when no `<main>` holds any text. A `<main>` inside a `<template>` is never counted: the page does not render it. Pages with a single non-empty `<main>` are measured exactly as before, so navigation, headers and footers stay out of the content audits that read it — dates, numbers, unique data, publication dates, content depth, hydration payload share and the user-agent parity gatherer.

The `<body>` fallback is the one place that changes for those audits. A page whose every `<main>` is empty used to measure as zero words; it now measures its body text, page chrome included. That is the correction `velasca.com` needed, and it is also why a chrome-only shell can now clear a word-count threshold it used to fail. `answer-readiness/content-without-clickthrough` carried a private copy of the old first-`<main>` rule and now reads the shared helper, so it stops warning about low content on pages whose real content sits in a later `<main>`.

Scan output changes for any site whose `<main>` is empty or fragmented: it stops being reported as serving no content.
