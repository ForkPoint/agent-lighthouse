#!/usr/bin/env node
/**
 * Checks that core's CommonJS and ESM bundles build the same audits. Run after
 * `pnpm build`.
 *
 * Unit tests import the TypeScript sources, so they never run either bundle.
 * The CLI and the MCP bin load the CommonJS one. Up to 9.1.0, tsup's CJS
 * output lowered the `rules` instance field of every audit made by
 * `defineA11yAudit` into a prototype method that the constructor reached
 * through one module-scope variable, so 16 of 17 accessibility audits
 * evaluated the last audit's rule. The ESM bundle was correct and no test
 * noticed.
 *
 * For every registered audit this script loads both bundles, builds an
 * instance from each, and compares its meta and its observable state: every
 * non-function property and getter value on the instance and its prototype
 * chain. Any difference fails the check.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "packages", "core", "dist");

const require = createRequire(import.meta.url);
const cjs = require(join(dist, "index.js"));
const esm = await import(pathToFileURL(join(dist, "index.mjs")).href);

/** Every non-function value an instance exposes, own or inherited. */
function observableState(instance) {
  const state = {};
  for (
    let obj = instance;
    obj && obj !== Object.prototype;
    obj = Object.getPrototypeOf(obj)
  ) {
    for (const [key, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(obj),
    )) {
      if (key === "constructor" || key in state) continue;
      let value;
      if (desc.get) {
        try {
          value = desc.get.call(instance);
        } catch (err) {
          value = `<getter threw: ${String(err)}>`;
        }
      } else {
        value = desc.value;
      }
      if (typeof value === "function") continue;
      state[key] = value;
    }
  }
  return state;
}

/** id -> { meta, staticMeta, state } for one bundle's default registry. */
function snapshot(mod) {
  const out = new Map();
  for (const regs of Object.values(mod.defaultConfig.audits)) {
    for (const reg of regs) {
      const instance = reg.create();
      out.set(reg.meta.id, {
        meta: reg.meta,
        staticMeta: instance.constructor.meta,
        state: observableState(instance),
      });
    }
  }
  return out;
}

const fromCjs = snapshot(cjs);
const fromEsm = snapshot(esm);
const failures = [];

for (const id of new Set([...fromCjs.keys(), ...fromEsm.keys()])) {
  const c = fromCjs.get(id);
  const e = fromEsm.get(id);
  if (!c || !e) {
    failures.push(`${id}: registered only in the ${c ? "CJS" : "ESM"} bundle`);
    continue;
  }
  if (!isDeepStrictEqual(c.meta, e.meta))
    failures.push(`${id}: meta differs between bundles`);
  for (const [name, s] of [
    ["CJS", c],
    ["ESM", e],
  ]) {
    if (s.staticMeta !== s.meta)
      failures.push(`${id}: ${name} instance's class meta is not its registration's`);
  }
  for (const key of new Set([
    ...Object.keys(c.state),
    ...Object.keys(e.state),
  ])) {
    if (!isDeepStrictEqual(c.state[key], e.state[key]))
      failures.push(
        `${id}: \`${key}\` differs — CJS ${JSON.stringify(c.state[key])}, ESM ${JSON.stringify(e.state[key])}`,
      );
  }
}

if (failures.length > 0) {
  console.error(`FAIL core CJS and ESM bundles disagree (${failures.length}):`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nRun `pnpm build` first if the bundles are stale.");
  process.exit(1);
}
console.log(`ok   core CJS and ESM bundles agree on ${fromEsm.size} audits`);
