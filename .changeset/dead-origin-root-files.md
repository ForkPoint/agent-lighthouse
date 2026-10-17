---
"@forkpoint/agent-lighthouse-core": patch
---

A site whose host accepts no connection no longer waits out the connect timeout once per root file. The scan now fetches `/robots.txt` first, and tries it a second time when it fails to connect. When both attempts fail to connect, the other root files are not sent and read as not sent. The homepage fetch still runs and still decides whether the site is reachable. One such scan took 120 s; it now takes about 30 s.
