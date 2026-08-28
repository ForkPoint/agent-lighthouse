# The real-page corpus

`packages/core/test-data/corpus/real/` holds 41 responses that real sites
served to the scanner's own fetcher on the dates below. Each fixture is a
gzipped body plus a provenance record — url, capture date, sha256, status,
kind, headers, content type, redirect chain, timings.

## Why it exists

Every fixture in the older corpus was hand-written HTML: one clean `<main>`
holding a paragraph of text. A defect shipped straight through it. The parser
read the first `<main>` on the page, and two storefronts that ship an empty
one were failed at critical priority for content nobody had looked for. No
hand-written fixture would have caught that, because nobody writes a fixture
with four `<main>` elements and 49 characters in the first.

The corpus is the answer: pages nobody designed for the test suite.

## How the fixtures are read

`kind` is decided from the response, never from what the capture meant to
take. `packages/core/src/tests/fixture-io.ts` re-runs that decision against
the stored bytes, so a regression that reclassified a refusal as readable
content fails the suite.

- **`page`** — a 2xx that `pageRendersText` reads as carrying text.
- **`shell`** — a 2xx whose served body renders nothing a non-JS consumer can
  read.
- **`wall`** — a non-2xx, or a 2xx the WAF detector calls blocked.

`page` is the classifier's verdict, not a promise that a human would call the
response an article. Three fixtures below are exactly that gap, and they are
in the corpus because of it.

Fixtures whose kind is not `page` carry it in the name. The four captured
first — `velasca-com`, `chase-com`, `reuters-com`, `myfritz-net` — predate the
convention; `reuters-com` is a wall and `myfritz-net` is a shell.

## Adding one

```bash
npx tsx scripts/capture-fixture.ts <url> [--name=<name>] [--allow-non-page] [--allow-small] [--force]
```

One request per page. A site that refuses twice is a wall fixture or is
skipped; it is not retried into submission.

## The fixtures

All captured 2026-08-28. Sizes are gzipped bytes on disk.

### Shapes that broke something

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `hiutdenim-co-uk` | hiutdenim.co.uk | page | 30.5 KB | Four `<main>` elements; the first holds 49 characters of the 2,470 the page renders. The defect that started this corpus. |
| `velasca-com` | velasca.com | page | 99.3 KB | One empty `<main>`, 194 words rendered outside it. |
| `gymshark-com-shell` | gymshark.com → us.checkout.gymshark.com | shell | 14.5 KB | Redirects to a checkout host whose 47 KB body renders one word. |
| `tattly-com-shell` | tattly.com | shell | 24.1 KB | 20 words, 127 characters — under both arms of the shell rule, in a 105 KB body. |
| `quitenice-co-shell` | quitenice.co | shell | 0.1 KB | 114-byte parked origin. The smallest thing a 200 can be. |
| `chase-com` | chase.com | page | 48.1 KB | Akamai-fronted bank homepage that answers the scanner normally. |
| `myfritz-net` | myfritz.net | shell | 1.9 KB | Zero words, zero characters. The floor of the shell rule. |
| `reuters-com` | reuters.com | wall | 0.6 KB | HTTP 401. A wall decided by status alone. |

### The two blind-spot fixtures

Both were found by mutation testing in Task 6. Neither existed in the corpus
before, and each kills a mutant that the whole suite otherwise survived.

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `walmart-com-wall-200` | walmart.com/help | wall | 62.9 KB | **Blind spot 1 — the 2xx WAF branch.** A 200 that `detectWafProtection` calls blocked, on a `_pxAppId` marker in the body. Before it, every wall in the corpus was a wall by status, so deleting the WAF call entirely left the suite green. |
| `lobsters-login-threshold` | lobste.rs/login | page | 1.6 KB | **Blind spot 2 — the shell threshold.** 54 words, 321 characters: just over `wordCount > 50 \|\| textLength > 200` on both arms. Before it, the lowest `page` in the corpus rendered 194 words, so the threshold could be raised or lowered and nothing failed. |

### Where the classifier and a reader disagree

These are kept deliberately. Each is a live disagreement between what the
scanner concludes and what the response is.

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `vercel-com-wall-200` | vercel.com/pricing | wall | 6.7 KB | Served `text/markdown` to the scanner UA — content negotiated for agents, which is the thing this project asks sites to do. Classified a Kasada wall because the prose links `.../attack-challenge-mode`, and `k-challenge` is a substring of it. |
| `walmart-com-wall-200` | walmart.com/help | wall | 62.9 KB | The real help page, 823 words of it, called a wall on a PerimeterX bootstrap variable that every Walmart page carries. |
| `tirerack-com-soft-block-200` | tirerack.com | page | 0.6 KB | A genuine 200 soft block — Akamai's "this page is currently unavailable" with a reference number — read as a readable page. The Akamai branch only fires at 403, and 36 words over 270 characters clears the text rule. |

### News

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `bbc-co-uk-article` | bbc.co.uk/news/articles/… | page | 66.7 KB | News article at an article URL, 436 KB of body around 1,368 words. |
| `theguardian-com-article` | theguardian.com/technology/… | page | 56.0 KB | News article, dated URL, 1,574 words. |
| `npr-org-article` | npr.org/2026/08/28/… | page | 39.7 KB | News article, 957 words. |
| `aljazeera-com-article` | aljazeera.com/news/… | page | 48.3 KB | News article, 400 words — the short end of the type. |

### Docs

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `mdn-cache-control` | developer.mozilla.org | page | 32.3 KB | Reference page for one HTTP header; redirected from the pre-2025 path. |
| `python-docs-json` | docs.python.org/3/library/json.html | page | 17.4 KB | Sphinx-built library reference, no `<main>`. |
| `nodejs-docs-fs` | nodejs.org/api/fs.html | page | 100.8 KB | 35,290 words on one page. The upper bound on text volume. |
| `kubernetes-docs-pods` | kubernetes.io/docs/concepts/… | page | 56.6 KB | Hugo-built concept page, 6,216 words. |
| `react-dev-usestate` | react.dev/reference/react/useState | page | 58.5 KB | API reference from a React-rendered docs site that still ships its text. |

### SaaS

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `stripe-com-pricing` | stripe.com/en-bg/pricing | page | 99.2 KB | Pricing page reached through a geo redirect; 4,627 words, no `<main>`. |
| `cloudflare-com-plans` | cloudflare.com/plans/ | page | 82.0 KB | Plan comparison page — prices and tiers in a table. |
| `atlassian-com-pricing-shell` | atlassian.com/software/jira/pricing | shell | 127.0 KB | 1.34 MB served, zero words rendered. The extreme hydration payload. |
| `vercel-com-wall-200` | vercel.com/pricing | wall | 6.7 KB | See above — markdown for agents, classified as a wall. |

### Government

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `irs-gov-form-1040` | irs.gov/forms-pubs/about-form-1040 | page | 20.0 KB | Tax form landing page — a document index, not prose. |
| `gov-uk-vehicle-tax` | gov.uk/vehicle-tax | page | 13.6 KB | Government service start page, deliberately minimal markup. |
| `canada-ca-income-tax` | canada.ca/en/services/taxes/… | page | 8.5 KB | Bilingual government hub page; the smallest `page` body in the corpus. |
| `cdc-gov-flu-about` | cdc.gov/flu/about/index.html | page | 14.3 KB | Public-health explainer, 1,895 words in 72 KB. |

### Marketplace

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `otto-de-category` | otto.de/technik/marken/ | page | 133.8 KB | 1.78 MB category page rendering 778 words — payload far outweighing text. |
| `rakuten-co-jp-home` | rakuten.co.jp | page | 53.9 KB | Japanese-language marketplace. Word counting on text without spaces. |
| `walmart-com-wall-200` | walmart.com/help | wall | 62.9 KB | See above. |
| `ebay-com-category-wall` | ebay.com/b/… | wall | 0.9 KB | HTTP 403 to the scanner UA, 1.8 KB of refusal. |

Amazon, Etsy, Booking, Bol, Allegro, Mercado Libre, Target and Flipkart all
refused or timed out on the capture attempt. The marketplace category is
mostly closed to an honest user agent, and that is the finding.

### Forum

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `hackernews-thread` | news.ycombinator.com/item?id=8863 | page | 17.1 KB | 5,112 words of threaded discussion in table markup, no `<main>`. |
| `discourse-meta-topic` | meta.discourse.org/t/… | page | 7.8 KB | Discourse topic — a JS forum that server-renders its posts. |
| `lobsters-front-page` | lobste.rs | page | 7.6 KB | Link-aggregator index: 594 words, almost all of it link text. |
| `lobsters-login-threshold` | lobste.rs/login | page | 1.6 KB | See above. |
| `stackoverflow-thread-wall` | stackoverflow.com/questions/11227809/… | wall | 3.0 KB | HTTP 403 on a canonical Q&A URL. Stack Exchange refuses the scanner UA. |
| `reddit-r-programming-shell` | reddit.com/r/programming | shell | 2.6 KB | 200 with a `<main>` and zero rendered words. |

### Bank

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `wellsfargo-com-checking` | wellsfargo.com/checking/ | page | 19.0 KB | Product page for a regulated financial product; disclosure-heavy text. |
| `capitalone-com-savings` | capitalone.com/bank/savings-accounts/… | page | 89.3 KB | Rate-bearing product page, no `<main>`, 580 KB body. |
| `barclays-co-uk-current-accounts` | barclays.co.uk/current-accounts/ | page | 33.9 KB | UK bank product index, no `<main>`. |
| `chase-com` | chase.com | page | 48.1 KB | See above. |

### Storefront

| Fixture | Served | Kind | Size | The shape it covers |
| :-- | :-- | :-- | --: | :-- |
| `magicspoon-com-product` | magicspoon.com/products/… | page | 151.3 KB | Shopify product page at a product URL — the page type commerce audits gate on. |
| `allbirds-com-collection` | allbirds.com/products/… → /collections/mens | page | 172.3 KB | A product URL that permanently redirects to a collection, and 15,140 words of collection text behind it. |
| `velasca-com`, `hiutdenim-co-uk`, `gymshark-com-shell`, `tattly-com-shell`, `quitenice-co-shell` | | | | See the first table. |

## What the corpus still lacks

- **A genuine 200 bot interstitial.** Around twenty candidate hosts were
  probed. Every real challenge answered 403 or 429 — Cloudflare, PerimeterX
  "press & hold", Kasada, DataDome — so it lands in the corpus as a wall by
  status, which the corpus already had. The 2xx WAF branch is covered by
  `walmart-com-wall-200`, but by a false positive on a served page rather than
  by a challenge page. Replace it if one is ever found.
- **A marketplace product page.** Every marketplace that publishes one refused
  the capture.
- **A page whose word count is 51–80 but whose text is under 200 characters.**
  It probably does not exist: 60 words of any natural language run past 200
  characters, so the `wordCount` arm of the shell rule cannot be pinned on its
  own.
