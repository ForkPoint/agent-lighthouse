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
import { runScan, defineConfig, PageScopeOptionsSchema, ScannedPageSchema, PageAttemptSchema, type ScanOptions, type AuditCoverage } from "@forkpoint/agent-lighthouse-core";
import { generateHtmlReport, buildReportView, formatPageScope, formatAuditScope } from "@forkpoint/agent-lighthouse-report";
import { auditWebsite } from "@forkpoint/agent-lighthouse-mcp";
import "@forkpoint/agent-lighthouse";
const options: ScanOptions = { timeoutMs: 1000, pageType: "article", pages: [{ url: "https://example.com/product", pageType: "product" }] };
const scan = runScan("https://example.com", options);
scan.then(report => {
  generateHtmlReport(report);
  const scope = buildReportView(report).pageScope;
  if (scope) {
    formatPageScope(scope);
    scope.audits.forEach(formatAuditScope);
  }
  const coverage: AuditCoverage | undefined = report.categories[0]?.checks[0]?.coverage;
  void coverage;
  report.pagesScanned.forEach(page => ScannedPageSchema.parse(page));
  report.pageAttempts?.forEach(attempt => PageAttemptSchema.parse(attempt));
});
PageScopeOptionsSchema.parse(options);
void auditWebsite("https://example.com", { pageType: "article", pages: options.pages });
void defineConfig;
// @ts-expect-error the URL must be a string
runScan(1);
// @ts-expect-error author is not a supported page purpose
void auditWebsite("https://example.com", { pageType: "author" });
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
    // Run the built exports as well as compiling their declarations. No network.
    const runtime = `
const oldPage = { url: "https://example.com/", pageType: "content" };
if (JSON.stringify(core.ScannedPageSchema.parse(oldPage)) !== JSON.stringify(oldPage)) throw new Error("Legacy page changed");
if (core.PageScopeOptionsSchema.safeParse({ pageType: "author" }).success) throw new Error("Invalid purpose accepted");
const scope = { pages: [{ url: oldPage.url, pageType: "article", classification: { type: "article", source: "detected", confidence: "hint", signals: ["article-url-hint"] } }], audits: [] };
if (!report.formatPageScope(scope).includes("detected, hint")) throw new Error("Scope export lost evidence");
if (typeof mcp.auditWebsite !== "function") throw new Error("MCP export absent");
`;
    for (const mode of ["cjs", "mjs"]) {
      const imports = [
        ["core", "@forkpoint/agent-lighthouse-core"],
        ["report", "@forkpoint/agent-lighthouse-report"],
        ["mcp", "@forkpoint/agent-lighthouse-mcp"],
      ]
        .map(([name, pkg]) =>
          mode === "cjs"
            ? `const ${name} = require("${pkg}");`
            : `import * as ${name} from "${pkg}";`,
        )
        .join("\n");
      const path = join(fixture, `runtime.${mode}`);
      writeFileSync(path, imports + runtime);
      const run = spawnSync(process.execPath, [path], {
        cwd: fixture,
        encoding: "utf8",
        timeout: 20_000,
      });
      expect(run.error).toBeUndefined();
      expect(run.status, run.stdout + run.stderr).toBe(0);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
