// Keeps the agent-lighthouse plugin in step with the CLI release.
//
// The skill's scan guide pins an exact CLI version as its fallback, and both
// plugin manifests carry a version. All three follow packages/cli/package.json.
// `pnpm version-packages` runs this after `changeset version`, so the release
// PR carries the bump. `--check` exits non-zero on drift instead of writing.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "plugins/agent-lighthouse");

const cliVersion = JSON.parse(
  fs.readFileSync(path.join(root, "packages/cli/package.json"), "utf8"),
).version;

// Each target is rewritten with a regex rather than re-serialised, so the
// file's formatting survives untouched.
const targets = [
  {
    file: path.join(pluginDir, "skills/agent-lighthouse/references/scan.md"),
    pattern: /(@forkpoint\/agent-lighthouse@)\d+\.\d+\.\d+/g,
  },
  {
    file: path.join(pluginDir, "plugin.json"),
    pattern: /("version":\s*")\d+\.\d+\.\d+/,
  },
  {
    file: path.join(pluginDir, ".codex-plugin/plugin.json"),
    pattern: /("version":\s*")\d+\.\d+\.\d+/,
  },
];

const check = process.argv.includes("--check");
const drifted = [];

for (const { file, pattern } of targets) {
  const before = fs.readFileSync(file, "utf8");
  if (!pattern.test(before)) {
    console.error(`[sync-skill-version] no version found in ${file}`);
    process.exit(1);
  }
  const after = before.replace(pattern, `$1${cliVersion}`);
  if (after === before) continue;
  drifted.push(path.relative(root, file));
  if (!check) fs.writeFileSync(file, after);
}

if (check && drifted.length > 0) {
  console.error(
    `[sync-skill-version] not at CLI ${cliVersion}: ${drifted.join(", ")}\n` +
      "Run `node scripts/sync-skill-version.mjs` to update them.",
  );
  process.exit(1);
}
for (const file of drifted)
  console.log(`[sync-skill-version] ${file} -> ${cliVersion}`);
