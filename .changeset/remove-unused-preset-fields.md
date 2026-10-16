---
"@forkpoint/agent-lighthouse-core": major
"@forkpoint/agent-lighthouse": major
---

Remove presets. A preset never changed which audits run or how they score after v2 replaced category weights with evidence mass; it only printed a name in the run header, and its descriptions claimed otherwise.

- Core no longer exports `PresetName`, `PRESETS`, `getPreset` or `PresetOptions`, and `AgentLighthouseConfig` has no `preset` field.
- The CLI drops `-p`/`--preset` and the config key `preset`, and the run header no longer names a preset. The CLI ignores flags and config keys it does not know, so a script that still passes them keeps running unchanged.
- The GitHub Action drops its `preset` input. A workflow that still sets it gets GitHub's unexpected-input warning; the run is not affected.

Use `--categories` to narrow a scan.
