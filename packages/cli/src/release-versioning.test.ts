import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const releaseRequire = createRequire(join(root, "package.json"));

it("versions the private website when a core major release updates its dependency", () => {
  const fixture = mkdtempSync(join(tmpdir(), "agent-lighthouse-versioning-"));
  const packages = ["cli", "core", "mcp", "report", "website"];
  const versions = new Map<string, string>();
  try {
    // Pin the repository's pnpm. Without `packageManager` the fixture runs
    // whatever pnpm the machine has globally, and pnpm 11 checks the
    // dependency state before `pnpm exec prettier` and refuses the linked
    // `node_modules`, so the result would depend on the developer's setup.
    const { packageManager } = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { packageManager: string };
    writeFileSync(
      join(fixture, "package.json"),
      JSON.stringify({
        name: "release-versioning-fixture",
        private: true,
        packageManager,
      }),
    );
    writeFileSync(
      join(fixture, "pnpm-workspace.yaml"),
      "packages:\n  - 'packages/*'\n",
    );
    // Resolve the installed changelog generator without installing fixture dependencies.
    symlinkSync(
      join(root, "node_modules"),
      join(fixture, "node_modules"),
      "junction",
    );
    mkdirSync(join(fixture, ".changeset"));
    writeFileSync(
      join(fixture, ".changeset/config.json"),
      readFileSync(join(root, ".changeset/config.json")),
    );
    writeFileSync(
      join(fixture, ".changeset/core-major.md"),
      '---\n"@forkpoint/agent-lighthouse-core": major\n---\n\nExercise dependent versioning.\n',
    );
    for (const name of packages) {
      const source = readFileSync(
        join(root, "packages", name, "package.json"),
        "utf8",
      );
      versions.set(name, JSON.parse(source).version as string);
      mkdirSync(join(fixture, "packages", name), { recursive: true });
      writeFileSync(join(fixture, "packages", name, "package.json"), source);
    }

    execFileSync(
      process.execPath,
      [releaseRequire.resolve("@changesets/cli/bin.js"), "version"],
      {
        cwd: fixture,
        timeout: 20_000,
        stdio: "pipe",
      },
    );

    for (const name of packages) {
      const manifest = JSON.parse(
        readFileSync(join(fixture, "packages", name, "package.json"), "utf8"),
      );
      const [major, minor, patch] = versions.get(name)!.split(".").map(Number);
      expect(manifest.version, name).toBe(
        name === "website"
          ? `${major}.${minor}.${patch! + 1}`
          : `${major! + 1}.0.0`,
      );
    }
    const changelog = readFileSync(
      join(fixture, "packages/website/CHANGELOG.md"),
      "utf8",
    );
    expect(changelog).toContain("@forkpoint/agent-lighthouse-core@");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
