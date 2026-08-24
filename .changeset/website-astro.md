---
"@forkpoint/agent-lighthouse-core": minor
"@forkpoint/agent-lighthouse-report": minor
---

Every audit result now carries `details.evidenceUrl`, the address of that audit's
evidence dossier on the documentation site, and the HTML report links it. The
address is also available on its own: `evidenceUrl(id)` is a new public export of
`@forkpoint/agent-lighthouse-core`, so a consumer can build the dossier link for
any audit id without running a scan.

The 68 audits whose `docsUrl` pointed at raw markdown on GitHub now point at the
rendered page; the 92 that point at an external specification are unchanged.

Those addresses are served by the documentation site, which is now an Astro build
publishing all 215 dossiers as their own pages rather than a single hand-maintained
HTML file.
