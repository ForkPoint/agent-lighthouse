---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Remove presets. A preset never changed which audits run or how they score after v2 replaced category weights with evidence mass; it only printed a name in the run header, and its descriptions claimed otherwise.

- Core no longer exports `PresetName`, `PRESETS`, `getPreset` or `PresetOptions`, and `AgentLighthouseConfig` has no `preset` field.
- The CLI no longer prints a preset in the run header. `-p`/`--preset` and the config key `preset` are still accepted for this release, do nothing, and print a warning.
- The GitHub Action input `preset` is deprecated and ignored.

Use `--categories` to narrow a scan.
