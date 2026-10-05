import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// The plugin's scan guide pins this CLI's exact version as a fallback. A
// release that bumps the CLI without the plugin would point agents at an old
// engine; `pnpm version-packages` syncs it, and this test catches a miss.
describe("agent-lighthouse plugin version", () => {
  it("matches packages/cli/package.json", () => {
    const script = resolve(
      __dirname,
      "../../../scripts/sync-skill-version.mjs",
    );
    const run = spawnSync(process.execPath, [script, "--check"], {
      encoding: "utf8",
    });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});
