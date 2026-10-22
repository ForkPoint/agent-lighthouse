---
"@forkpoint/agent-lighthouse-core": major
---

Correct the remaining five broad audit scopes using observed features across all page types.

- `external-citations` and `unique-data` change from grade B/scored (weight 0.6 each) to grade C/informative (weight 0). Remove the unsupported two-link and three-number thresholds. Their titles become "External content links" and "Statistics in research context". They report observations and return not applicable when none exists; they do not judge authority, originality or AI answer quality.
- `time-element` selects date-bearing content independently of time markup. Its title becomes "Machine-readable time markup". No dates returns not applicable; mixed page coverage warns. Machine-readable text can satisfy the convention when datetime is absent.
- `comparison-tables` selects explicit comparison headings or captions rather than all pages or arbitrary tables. Ordinary prose returns not applicable; mixed comparison-page coverage warns.
- `breadcrumb-schema` selects observed breadcrumb trails or existing markup instead of URL depth. Flat URLs can qualify; deep URLs without hierarchy return not applicable. Its grade A and weight 1 remain unchanged.

`time-element`, `comparison-tables`, `external-citations` and `unique-data` ignore only site-level chrome: a header or footer inside an article, such as a post header carrying its date, counts as content. `unique-data` no longer counts bare durations such as "24 hours" as figures.

Keep all audit IDs. Preserve the historical study evidence in the dossiers and document detector limits. Consumers must account for the two removed score contributions and revised verdict populations.

Exclude page wrappers from breadcrumb trails and share-action URLs from external content links. Recognize punctuated comparison headings, US dates and abbreviated English months. Stop date checks once a page has qualifying time markup. Respect explicit sectioning ARIA roles when deciding whether headers and footers are site chrome. `unique-data` drops figures followed by offer words such as "100% satisfaction guaranteed" or "30% off". Breadcrumb detection assesses each labelled trail on its own steps, including a plain nav inside a labelled wrapper, and ignores state classes such as `breadcrumbs-disabled`. More share services are excluded from external content links. "VS Code", "Compare-at" price labels and a bare "Compare" heading no longer establish comparison intent, while "compares" and "compared" do. `comparison-tables` and `time-element` ignore headings and dates inside `aside` or `role="complementary"` regions, as the other rescoped audits already did. `time-element` also reads dates in headings, table cells, links and leaf `div` elements, and accepts an ISO date that runs into a time. `unique-data` accepts plural research words such as "studies" and "surveys". Breadcrumb trails are recognised in `section`, `p` and `span` wrappers, with an icon-only home link, and as one link followed by a text step such as "Home / Product".
