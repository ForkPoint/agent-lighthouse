import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import * as source from "#core/contracts";

const PACKAGE = resolve(__dirname, "../..");
const DIST = resolve(PACKAGE, "dist");
const built = existsSync(resolve(DIST, "contracts.mjs"));

/**
 * Bundles `code` for the browser, resolving imports the way a consumer's
 * bundler would: through `node_modules` and the package `exports` map. Returns
 * every file that ended up in the bundle, relative to the core package.
 */
async function browserInputs(code: string): Promise<string[]> {
  const result = await build({
    stdin: { contents: code, resolveDir: PACKAGE, loader: "js" },
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
    logLevel: "silent",
  });
  return Object.keys(result.metafile.inputs)
    .filter((input) => input !== "<stdin>")
    .map((input) => relative(PACKAGE, resolve(input)));
}

describe("contracts source", () => {
  it("guards page types, and rejects retired names", () => {
    for (const type of source.PAGE_TYPES) {
      expect(source.isPageType(type)).toBe(true);
      expect(source.PAGE_TYPE_LABELS[type]).toBeTruthy();
    }
    expect(source.isPageType("unknown")).toBe(false);
    expect(source.isPageType("content")).toBe(false);
    expect(source.isPageType(1)).toBe(false);
  });

  it("bands scores at the documented tier limits", () => {
    expect(source.getScoreTier(90)).toBe(source.ScoreTier.AgentReady);
    expect(source.getScoreTier(89)).toBe(source.ScoreTier.PartiallyReady);
    expect(source.getScoreTier(70)).toBe(source.ScoreTier.PartiallyReady);
    expect(source.getScoreTier(69)).toBe(source.ScoreTier.NeedsWork);
    expect(source.getScoreTier(50)).toBe(source.ScoreTier.NeedsWork);
    expect(source.getScoreTier(49)).toBe(source.ScoreTier.NotReady);
  });

  it("names every category", () => {
    for (const id of source.CATEGORY_IDS)
      expect(source.CATEGORY_NAMES[id], id).toBeTruthy();
  });
});

// The suite skips when `dist` is absent, so `pnpm test` on a fresh clone stays
// green. CI builds the whole workspace before it tests, so it runs there.
describe.skipIf(!built)("built contracts entry", () => {
  it("bundles for the browser from its own files only", async () => {
    const inputs = await browserInputs(
      `export * from "@forkpoint/agent-lighthouse-core/contracts";`,
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).toMatch(/^dist\/[^/]+\.mjs$/);
  });

  it("fails the same check on the root entry, so the check can fail", async () => {
    // The root entry carries the scanner. If this stops throwing, the browser
    // build above has stopped proving anything.
    await expect(
      browserInputs(`export * from "@forkpoint/agent-lighthouse-core";`),
    ).rejects.toThrow(/Could not resolve "node:/);
  });

  it("hands out the same objects from both ESM entries", async () => {
    const root = await import(pathToFileURL(resolve(DIST, "index.mjs")).href);
    const contracts = await import(
      pathToFileURL(resolve(DIST, "contracts.mjs")).href
    );
    for (const name of Object.keys(source)) {
      expect(contracts[name], name).toBeDefined();
      expect(root[name], name).toBe(contracts[name]);
    }
  });

  it("hands out the same objects from both CJS entries", () => {
    const require = createRequire(__filename);
    const root = require(resolve(DIST, "index.js"));
    const contracts = require(resolve(DIST, "contracts.js"));
    for (const name of Object.keys(source)) {
      expect(contracts[name], name).toBeDefined();
      expect(root[name], name).toBe(contracts[name]);
    }
  });
});
