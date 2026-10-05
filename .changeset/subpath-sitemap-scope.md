---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Discover sitemaps for sites mounted under a subpath. A detected or declared homepage directory supplies the sitemap scope. Robots declarations still come from the origin root; conventional sitemap paths are tried under the mount before origin fallbacks. Shared sitemap entries are filtered to the mount before caps and sampling, so sibling sites cannot supply page verdicts through the sitemap. Relative and malformed entries associated with the site remain visible to sitemap content audits. The sitemap-exists audit no longer fails absence when the child-walk limit or unreadable shared-index children prevented a verdict. Ordinary content-page scans and origin-level files retain their current scope.
