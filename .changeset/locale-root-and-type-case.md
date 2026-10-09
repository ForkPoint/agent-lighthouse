---
"@forkpoint/agent-lighthouse-core": patch
---

Page-type detection reads two more real storefront shapes.

- A locale root scanned directly — a path made only of locale segments such as `/us/`, `/us/en`, `/en-gb/` or `/en/home/` — is the homepage when its hreflang alternates name at least two sibling locale roots and every path segment is a language or region those alternates declare. `/us/en/` beside `en-US` and `en-CA` is a locale root. A section such as `/en/tv/` is not: no hreflang code names `tv`. The new signal is `locale-root`.
- Product, listing and article schema types are matched without regard to case or a `www.schema.org` host, so `"@type": "product"` still marks a product page. Only classification is lenient; audits that judge the markup stay strict.
- A homepage served as a `home` page, such as `/en/home/`, scopes sitemap discovery to the directory that holds it (`/en/`), not to `/en/home/`.
