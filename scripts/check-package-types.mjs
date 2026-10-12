#!/usr/bin/env node
/**
 * Checks that each published package's type declarations resolve the way its
 * JavaScript does, with @arethetypeswrong/cli. Run after `pnpm build`.
 *
 * Two known problems are accepted, each for a stated reason:
 *
 * - `node10` resolution. The declarations import core modules as `#core/*`
 *   (see CLAUDE.md, Style), a package `imports` map that `moduleResolution:
 *   node10` cannot read. node10 also ignores `exports`, so it cannot see a
 *   subpath entry such as core's `./contracts`. TypeScript 7 no longer offers node10, and
 *   `node16`, `nodenext` and `bundler` resolve the map.
 * - `FalseCJS`. One `index.d.ts` serves both the CJS and the ESM entry. An
 *   ESM consumer sees CommonJS-shaped types; named imports still type-check.
 *   Emitting a separate `.d.mts` tree is a build change of its own.
 *
 * attw 0.18 exits non-zero for a node10 problem even with `--profile node16`,
 * so this script reads its JSON report and applies the two exceptions itself.
 */
import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["core", "report", "mcp", "cli"];
const IGNORED_RESOLUTIONS = new Set(["node10"]);
const IGNORED_KINDS = new Set(["FalseCJS"]);

let failed = false;
for (const name of PACKAGES) {
  const cwd = join(root, "packages", name);
  // attw exits 1 on any problem, before a piped stdout is fully flushed, so
  // the report goes to a file, which Node writes synchronously.
  const dir = mkdtempSync(join(tmpdir(), "attw-"));
  const out = join(dir, "report.json");
  const fd = openSync(out, "w");
  const run = spawnSync("attw", ["--pack", ".", "--format", "json"], {
    cwd,
    stdio: ["ignore", fd, "inherit"],
  });
  closeSync(fd);
  const raw = readFileSync(out, "utf8");
  rmSync(dir, { recursive: true, force: true });
  if (run.error) throw run.error;
  const report = JSON.parse(raw);
  const problems = Object.values(report.problems ?? {})
    .flat()
    .filter(
      (p) =>
        !IGNORED_KINDS.has(p.kind) &&
        !IGNORED_RESOLUTIONS.has(p.resolutionOption) &&
        // Entry-point problems (a subpath such as `./contracts` that node10
        // cannot see, because it ignores `exports`) name the resolution here.
        !IGNORED_RESOLUTIONS.has(p.resolutionKind),
    );
  if (problems.length === 0) {
    console.log(`ok   packages/${name}`);
    continue;
  }
  failed = true;
  console.error(`FAIL packages/${name}`);
  for (const p of problems)
    console.error(
      `  ${p.kind} [${p.resolutionOption ?? p.resolutionKind ?? "any"}] ${p.moduleSpecifier ?? p.entrypoint ?? ""}`,
    );
}
if (failed) {
  console.error(
    "\nRun `pnpm build` first. Details: npx attw --pack packages/<name>",
  );
  process.exit(1);
}
