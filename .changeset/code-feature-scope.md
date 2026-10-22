---
"@forkpoint/agent-lighthouse-core": patch
---

Apply the informative code-language check to code blocks on every page type. Return not applicable when no blocks exist. Require a complete, nonempty language-* class token. Keep grade C and weight 0. Clarify the supported annotation convention and remove unsupported claims about AI answer quality.

Ignore hidden code elements. Count each `<pre>` once, by its first visible `<code>`, as Turndown does.
