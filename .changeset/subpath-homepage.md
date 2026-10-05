---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Detect the homepage of a site mounted under a subpath. Page-type detection used to call the scanned URL a homepage only when its path was exactly `/`, so a GitHub project site (`/<project>/`), a store at `/shop/`, a docs portal or a locale root (`/en-us/`) was read as a content page, and article checks ran against its homepage. The scanned URL is now a homepage when its path is a directory and the page's own links say it is a site root: its header's first same-origin link points back at that path, or every same-origin link on the page stays under it. A section of a larger site, such as `/blog/` whose logo links to `/`, is unaffected. Scans of subpath sites change page type, which audits apply, and their scores — on this project's own docs site, from an unscored content page to a scored homepage.
