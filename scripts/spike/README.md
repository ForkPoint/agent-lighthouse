# Evidence-gate spike

Measurement run behind `docs/architecture/history/scan-evidence-gate-design.md`.
Kept so every number in that document can be reproduced or refuted.

```bash
npx tsx scripts/spike/probe-shells.ts   results-shells.json   # find real client-rendered sites
npx tsx scripts/spike/spike-scan.ts     results-traces.json   # scan them, record every audit trace
npx tsx scripts/spike/simulate-gate.ts                        # replay traces through the scorer, gate on/off
npx tsx scripts/spike/probe-stores.ts                         # false-positive rate on 43 real storefronts
```

`reads-pages.txt` is the 143 audit ids that read `ctx.pages`, regenerated with:

```bash
cd packages/core/src/audits
for f in $(ls */*.ts | grep -v '\.test\.' | grep -v index.ts); do
  grep -q "ctx\.pages" "$f" && grep -m1 "id: '" "$f" | sed "s/.*id: '\([^']*\)'.*/\1/"
done
```

The `results-*.json` files are the run of 2026-08-25. They hit live sites, so a
rerun will not match exactly; treat large divergence as a finding, not as noise.
