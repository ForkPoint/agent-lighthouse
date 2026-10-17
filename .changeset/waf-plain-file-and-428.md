---
"@forkpoint/agent-lighthouse-core": patch
---

Two bot-wall verdict fixes. When the homepage fails but answers (a 404, say), a vendor path named inside a plain-text or XML root file, such as `Disallow: /_Incapsula_Resource` in robots.txt, no longer reads as an Imperva wall: a vendor marker counts only in an HTML page or a refused response, while vendor headers still count. A homepage that answers HTTP 428 with a body is no longer reported as "the scan was throttled"; an empty 428 still is.
