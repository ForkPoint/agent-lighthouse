---
audit: operability-safety/duplicate-id
category: operability-safety
source_file: packages/core/src/audits/operability-safety/duplicate-id.ts
slug: duplicate-id
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - mdn-getelementbyid
  - w3c-accname-11
  - w3c-accname-12
  - probe-aria-snapshot-images
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
  - axe-duplicate-id-aria
public_extra:
  - Browser view
---

# Unique IDs for ARIA references (`7.14`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

aria-labelledby / aria-describedby / for resolve by id. Duplicate ids make resolution ambiguous, so an agent may read the wrong label or description.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** `aria-labelledby`, `aria-describedby` and `for` resolve an IDREF by id lookup, which returns the first element in tree order. When two elements share an id, the accessible name computed per accname — the one exposed in the accessibility tree an agent reads — is taken from the first occurrence. A control referencing the second one is therefore announced with the wrong label.

**Grade: A** — id resolution (first element in tree order) and the accname IDREF traversal are both ratified, universally implemented behavior, and role + accessible name is precisely what documented agent snapshot tools serialise for the model.

**Evidence:**

- `getElementById`: "IDs should be unique inside a document. If two or more elements in a document have the same ID, this method returns the first element found" — https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById (verified 2026-08-21)
- Accessible Name and Description Computation 1.1 is a W3C Recommendation of 18 December 2018. It defines the LabelledBy step: "For each IDREF: Set the current node to the node referenced by the IDREF… Compute the text alternative of the current node" — https://www.w3.org/TR/accname-1.1/ (verified 2026-08-21). The same step text is carried in the 1.2 Working Draft — https://www.w3.org/TR/accname-1.2/ (verified 2026-08-21)
- Playwright ARIA snapshots serialise each node's role and accessible name for the model — https://playwright.dev/docs/aria-snapshots (verified 2026-08-21)
- Playwright MCP and Chrome DevTools MCP both address elements by reference/uid taken from an accessibility-tree snapshot, so a wrong name is what the agent selects on — https://github.com/microsoft/playwright-mcp and https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (both verified 2026-08-21)
- axe rule: the id "must be unique to prevent the second instance from being overlooked by assistive technology"; "only the first instance gets acted upon by client-side scripting" (impact: critical) — https://dequeuniversity.com/rules/axe/4.10/duplicate-id-aria (verified 2026-08-21)

**Counter-evidence:** Deque frames the effect as the second instance being _overlooked_ rather than misresolved. The harm materialises only when a duplicated id is actually the target of an ARIA reference or a `for` attribute. A duplicated id that nothing references changes nothing in the accessibility tree. Duplicate ids from repeated third-party embeds are true positives the site owner cannot fix. Independently of the signal's grade, this audit as wired can essentially never report the failure: `reviewOnFail` turns it into an incomplete result, which another page's pass then overrides.

## Browser view

Anthropic's `find` searches "for elements matching a natural-language description such as 'search field' or 'add to cart button'", and `form_input` will "Set a form element's value directly" on the element it returns (verified 2026-10-20). A `for`, `aria-labelledby` or `aria-describedby` reference to a duplicated id resolves to the first element with that id, so the name `find` matches against can belong to the wrong control. A supplied browser snapshot is the rendered DOM those tools read, so the browser view runs this audit on it.

The browser view runs on each complete, unredacted, non-loading capture that carries readable text and whose accessibility rule pass completed. The pass runs the audit's rules over the capture HTML with page scripts off and no resource loading. A pass with no results records missing evidence instead of a verdict. The finding is informative with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review appears in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
