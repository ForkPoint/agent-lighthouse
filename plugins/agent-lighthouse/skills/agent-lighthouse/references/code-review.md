# Trace the report into the implementation

## Establish the code and deployment context

Read repository instructions and worktree status. Identify the package manager, build/test commands, routing model, content source, server behavior, and hosting configuration. Use the files present; do not assume Node.js, Astro, or a static build.

Check the report domain against site configuration. Identify the deployed revision when evidence is available. If the revision is unknown, state that source and deployment may differ. A present source file can still be absent from deployed output because of routing, build, cache, or hosting behavior.

Build a bounded inventory of route types and shared owners. Inspect key routes and their shared dependencies. Expand the review when evidence points to a broader defect; list unreviewed areas instead of claiming exhaustive coverage.

## Follow each relevant finding

| Finding area              | Trace through                                                                   | Useful proof                                                           |
| ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Access and crawling       | robots generator/static file, page metadata, middleware, CDN/WAF rules          | Target URL and user-agent responses; final redirect destination        |
| Content extraction        | route, shared layout, content loader, rendering/hydration boundary              | Initial HTML and rendered content; browser behavior                    |
| Discovery                 | canonical builder, sitemap/feed generator, resource links, public-file handling | Built and deployed URLs; response status and content type              |
| Structured data           | schema builder, page data, serialization, visible content                       | Parsed JSON-LD and matching visible facts on applicable routes         |
| Answers and trust         | source content, author data, citations, content dates                           | Actual claims and source links; no invented facts                      |
| Accessibility and actions | controls, labels, handlers, validation, backend integration                     | Keyboard/browser checks and safe tests of success/error paths          |
| Agent protocols           | advertised discovery path, live handler, transport, auth configuration          | Real protocol behavior; JSON file presence is insufficient             |
| Commerce and safety       | product source, price/stock output, cart/checkout, consent and retries          | Consistency and safe service tests; no live purchase without authority |

Trace the full relevant path from source data to the rendered response or action handler. A helper unit test alone does not prove the page uses that helper. A declaration does not prove the service implements it.

When the report contradicts the code, inspect built output and deployed responses before editing. Determine whether the cause is stale deployment, conditional rendering, wrong target, hosting configuration, report limits, or a source defect. Preserve the original engine verdict while documenting your assessment.

## Check beyond reported failures

Look for the same defect in shared components and other applicable routes. Check broken links, missing content, inaccessible controls, unsupported claims in manifests, and schema that disagrees with visible content. Inspect relevant error paths and no-JavaScript behavior when the site claims support.

Give additional findings a clear `code:` label and file/page evidence. Do not attach invented engine IDs or imply that Lighthouse assessed unscanned code.

## Choose and verify fixes

Use the existing implementation seam. Preserve business policy and intended access restrictions. Do not add invented reviews, prices, credentials, API routes, or MCP endpoints. Remove inaccurate declarations or fix their real implementation according to the user's request.

Verify each change at the layer it affects: focused regression tests, build output, browser interaction, or deployed HTTP/protocol behavior. Avoid production side effects during tests. Keep missing credentials, service access, or deployment authority visible as unresolved proof gaps.

Stop when the agreed findings have an evidence-backed disposition and authorized fixes have appropriate proof. Report any remaining deployment or review work explicitly.
