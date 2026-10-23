---
"@forkpoint/agent-lighthouse-core": patch
---

Close inline `<script>` and `<style>` blocks the way browsers do in the three places that read raw HTML as text. An end tag written with whitespace, a slash or attributes, such as `</style >`, `</style/>` or `</script x>`, no longer hides the page content that follows it. This affects bot-wall detection, the text-length check in `agentic-commerce/cart-handoff-reachability`, and the script and style token counts in `content-extraction/token-ratio`.
