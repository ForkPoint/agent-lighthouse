---
audit: operability-safety/change-password-url
category: operability-safety
source_file: packages/core/src/audits/operability-safety/change-password-url.ts
slug: change-password-url
evidence_grade: C
disposition: "new 2026-10-18 — consumer-evidence review, IANA well-known gap"
reviewed: 2026-10-18
public_extra:
  - Limits
recommended_tier: informative
consumers:
  - Safari
  - Chrome password manager
  - Chrome Automated Password Change (preview)
sources:
  - w3c-change-password-url
  - webdev-change-password-url
  - chrome-automated-password-change
  - iana-well-known-uris
---

# change-password-url

> operability-safety · source `change-password-url.ts` · evidence grade **C** · tier **informative** (weight 0)

## What it checks

On a site with accounts, whether `/.well-known/change-password` sends the user to the change-password form.

| State                                                                                | Verdict       |
| :----------------------------------------------------------------------------------- | :------------ |
| No sampled page has a password field                                                 | notApplicable |
| The probe gets no response, or a status other than those below                       | notApplicable |
| 200 with no redirect and no password field (a catch-all page)                        | notApplicable |
| 404 or 410                                                                           | warn          |
| 302, 303 or 307 to a page that answers 200, 401 or 403                               | pass          |
| 200 with a meta refresh                                                              | pass          |
| 301 or 308 to a page that answers 200                                                | warn          |
| 200 with a password field at the well-known URL itself                               | warn          |
| A redirect with no usable `Location`, or to a page that answers another 4xx or a 5xx | fail          |

## Claimed mechanism (falsifiable)

A password manager that wants a user to change a password opens `/.well-known/change-password` on the site. If the URL redirects to the form, the user, or the browser acting for the user, lands on it. If it does not, the password manager has nowhere to send them.

## Evidence

- The W3C draft: servers redirect "by returning a response with a redirect status of 302, 303, or 307, and a Location header", may instead answer with an HTML meta refresh, and "must not locate the actual change password page at the change password url" — https://w3c.github.io/webappsec-change-password-url/ (verified 2026-10-18)
- Safari has supported the URL since 2019, and Chrome's password manager since version 86 — https://web.dev/articles/change-password-url (verified 2026-10-18)
- Chrome Automated Password Change navigates the site and completes the change for the user. "The URL /.well-known/change-password must redirect to your password change form." The page is marked as information about an upcoming feature — https://developer.chrome.com/docs/identity/automated-password-change (verified 2026-10-18)
- IANA registers `change-password` as provisional, change controller W3C — https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml (verified 2026-10-18)

**Counter-evidence:** No consumer is documented as an AI agent. Chrome's automated feature acts on the site for the user, but Google does not call it AI and still marks it as upcoming. The web.dev browser list dates from 2020.

## Scoring

**Grade: C** — the consumers are documented, but none is an AI agent, and the one automated consumer is still a preview. The audit is informative, so it never moves a score. It can be re-graded once Chrome ships Automated Password Change and the project decides whether browser automation that is not AI is in scope.

## Example failure

`/.well-known/change-password` answers `302 Location: /account/password`, and `/account/password` answers 404. A password manager sends the user to an error page.

## Limits

- A site counts as having accounts only when a sampled page shows a password field. A login page outside the sample is not seen.
- A 200 at the well-known URL with no redirect and no form is read as a catch-all page, not as support.
- The redirect target is checked for its status only, not for a password form.
- Chrome Automated Password Change is still a preview. Its page says Google is "expanding feature coverage through testing across selected websites" and was last updated 2025-07-30 — https://developer.chrome.com/docs/identity/automated-password-change (verified 2026-10-18). The grade does not rest on it.

## Implementation deviations

- 2026-10-18, after independent review: a redirect target that answers 401 or 403 passes. A change-password page refuses an anonymous visitor by design, so the redirect reached the right page.

- The probe goes through `sharedProbeUrl` (`gatherers/discovery.ts`) without following redirects, then one follow-up probe of the `Location` target. Both pass `isSafeUrl()`. It is not a root file, because `rootFiles` treats an HTML body as absent and this URL legitimately answers with a redirect or HTML.
