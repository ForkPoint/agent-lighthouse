import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

it("exposes usable declarations to ESM and CommonJS consumers without workspace sources", () => {
  const fixture = mkdtempSync(
    join(tmpdir(), "agent-lighthouse-package-types-"),
  );
  try {
    const modules = join(fixture, "node_modules");
    mkdirSync(join(modules, "@forkpoint"), { recursive: true });
    symlinkSync(
      join(root, "node_modules/@types"),
      join(modules, "@types"),
      "junction",
    );
    for (const name of ["core", "cli", "report", "mcp"]) {
      const source = join(root, "packages", name);
      const manifest = JSON.parse(
        readFileSync(join(source, "package.json"), "utf8"),
      );
      const target = join(modules, manifest.name);
      mkdirSync(target);
      cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
      writeFileSync(join(target, "package.json"), JSON.stringify(manifest));
      for (const dependency of Object.keys(manifest.dependencies)) {
        if (dependency.startsWith("@forkpoint/")) continue;
        const link = join(modules, dependency);
        mkdirSync(resolve(link, ".."), { recursive: true });
        symlinkSync(join(source, "node_modules", dependency), link, "junction");
      }
    }
    const consumer = `
import { runScan, defineConfig, type ScanOptions } from "@forkpoint/agent-lighthouse-core";
import { generateHtmlReport } from "@forkpoint/agent-lighthouse-report";
import { auditWebsite } from "@forkpoint/agent-lighthouse-mcp";
import "@forkpoint/agent-lighthouse";
const options: ScanOptions = { timeoutMs: 1000 };
const scan = runScan("https://example.com", options);
scan.then(report => generateHtmlReport(report));
void auditWebsite("https://example.com");
void defineConfig;
// @ts-expect-error the URL must be a string
runScan(1);
`;
    writeFileSync(join(fixture, "consumer.mts"), consumer);
    writeFileSync(join(fixture, "consumer.cts"), consumer);
    writeFileSync(
      join(fixture, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          types: ["node"],
        },
        files: ["consumer.mts", "consumer.cts"],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        join(root, "node_modules/typescript/bin/tsc"),
        "-p",
        join(fixture, "tsconfig.json"),
      ],
      { cwd: fixture, encoding: "utf8", timeout: 20_000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
