---
"@forkpoint/agent-lighthouse-core": patch
---

Read hostile page content in linear time. Five patterns could backtrack for
seconds on crafted input: the llms.txt link reader, the HTML tag and title
readers in bot-wall detection, the CSS comment stripper, the root-file HTML
sniffer and the URL fragment trim. Each now scans once.

Two of the rewrites also correct a reading:

- An llms.txt bullet that ended in a bare URL took the next bullet as its
  description, so that next link was lost. Each bullet now stands alone.
- A CSS comment that never closes now runs to the end of the sheet, as
  browsers read it. Rules after it were scanned before.

`table-markdown-round-trip-loss` escapes backslashes as well as pipes when it
writes a table as Markdown.
