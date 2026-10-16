---
"@forkpoint/agent-lighthouse-core": major
---

Remove the preset fields nothing read. `PresetOptions` now carries only `name`: the `description`, `categoryFilter` and `customWeights` fields are gone, together with the hand-tuned weights and descriptions in `PRESETS`. A preset never changed which audits run or how they score after v2 replaced category weights with evidence mass; the descriptions claimed otherwise. Use `--categories` to narrow a scan.
