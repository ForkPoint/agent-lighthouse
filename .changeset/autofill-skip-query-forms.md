---
"@forkpoint/agent-lighthouse-core": patch
---

Stop `operability-safety/form-autofill-token-coverage` failing site search and store-locator forms. Their fields take a query, not profile data, so they are skipped, and a location field offering a choice such as "City or postcode" no longer counts as a postal-code field.
