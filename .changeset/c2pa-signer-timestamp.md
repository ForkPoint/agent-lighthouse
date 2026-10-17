---
"@forkpoint/agent-lighthouse-core": patch
---

`operability-safety/c2pa-signer-trust-status` now warns instead of failing when a Content Credential's signing certificate has expired but the manifest carries a time-stamp, since the C2PA specification judges a time-stamped signature at the time it was made. The self-signed failure now says no validator trusts such a certificate by default, because a user can still trust one by hand.
