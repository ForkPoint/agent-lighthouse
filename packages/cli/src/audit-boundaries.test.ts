import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

it("keeps the native parser boundary check strict without flagging inert text", () => {
  const fixture = mkdtempSync(join(tmpdir(), "agent-lighthouse-boundaries-"));
  try {
    mkdirSync(join(fixture, "scripts"));
    cpSync(
      join(root, "scripts/check-audit-boundaries.mjs"),
      join(fixture, "scripts/check-audit-boundaries.mjs"),
    );
    symlinkSync(
      join(root, "node_modules"),
      join(fixture, "node_modules"),
      "junction",
    );
    const audits = join(fixture, "packages/core/src/audits");
    mkdirSync(audits, { recursive: true });
    writeFileSync(
      join(fixture, "tsconfig.json"),
      JSON.stringify({ include: ["packages/**/*.ts"] }),
    );
    writeFileSync(
      join(audits, "safe.ts"),
      `
import type { Fetcher } from "./fetcher";
// fetch(); ctx.fetch; const { fetch } = ctx;
const example = "fetch()";
`,
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [join(fixture, "scripts/check-audit-boundaries.mjs")],
        { cwd: fixture, encoding: "utf8", timeout: 20_000 },
      );
    const safe = run();
    expect(safe.error).toBeUndefined();
    expect(safe.status, safe.stderr).toBe(0);
    expect(safe.stdout).toContain("all 1 production audit sources");
    writeFileSync(
      join(audits, "bad.ts"),
      `import { request } from "undici";
ctx.fetch;
const { fetch } = ctx;
fetch();
`,
    );
    const bad = run();
    expect(bad.error).toBeUndefined();
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("4 boundary violation(s)");
    expect(bad.stderr).toContain("Line 1: Direct HTTP/fetcher import 'undici'");
    expect(bad.stderr).toContain("Line 2: Accessing .fetch property");
    expect(bad.stderr).toContain("Line 3: Destructuring 'fetch'");
    expect(bad.stderr).toContain("Line 4: Direct fetch() call");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
