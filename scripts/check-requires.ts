#!/usr/bin/env node
/**
 * check-requires — CI guard for audit ↔ scan-evidence linkage.
 *
 * Every audit declares, in its meta, which classes of scan evidence it needs
 * to say anything true (`requires`). This script proves that declaration
 * against what the source actually reads:
 *
 *   (a) an audit that touches `ctx.pages`, or imports a page-fed gatherer,
 *       must require all four keys;
 *   (b) an audit that reads only root files must require `origin-reachable`;
 *   (c) the deliberate disagreements — audits whose subject *is* the missing
 *       evidence — come from the allowlist in `lib/requires-analysis.ts`, not
 *       from the absence of a rule;
 *   (d) a gatherer missing from that file's map fails the build, which is what
 *       keeps the map honest when a new gatherer is added.
 *
 * The check is a ratchet, not a proof: a helper that reaches the pages outside
 * both `ctx.pages` and the gatherer layer still slips past it.
 *
 * Reads the registry from the *built* core bundle, so `pnpm build` must run
 * first — same contract as `check-dossiers.mjs`.
 *
 * Exits 0 when every audit agrees, 1 with a per-violation list otherwise.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import {
  auditSourceFiles,
  declaredIds,
  declaredRequires,
  expectedRequires,
} from "./lib/requires-analysis";

async function main() {
  const repoRoot = process.cwd();
  const coreDist = resolve(repoRoot, "packages/core/dist/index.mjs");

  if (!existsSync(coreDist)) {
    console.error(
      `check-requires: built core not found at ${coreDist}\n` +
        "Run `pnpm --filter @forkpoint/agent-lighthouse-core build` first.",
    );
    process.exit(1);
  }

  const { defaultConfig } = await import(pathToFileURL(coreDist).href);

  /** Registered audit metas, by id. */
  const registered = new Map<string, { id: string; requires?: string[] }>();
  for (const category of defaultConfig.categories) {
    for (const reg of defaultConfig.audits[category.id] ?? []) {
      registered.set(reg.meta.id, reg.meta);
    }
  }

  const violations: string[] = [];
  const seen = new Set<string>();

  for (const file of auditSourceFiles(repoRoot)) {
    const source = readFileSync(file, "utf8");
    const id = declaredIds(source).find((candidate) =>
      registered.has(candidate),
    );
    if (!id) continue;
    seen.add(id);

    const where = relative(repoRoot, file);
    const { expected, unknownGatherers } = expectedRequires(source, id);

    for (const name of unknownGatherers) {
      violations.push(
        `${where}: imports gatherer '${name}', which is missing from GATHERER_EVIDENCE ` +
          "in scripts/lib/requires-analysis.ts. Add it with the evidence its input needs.",
      );
    }

    // The declaration the runtime will use is the meta the registry holds, which
    // already resolves the a11y base spread.
    const declared = registered.get(id)?.requires ?? declaredRequires(source);
    if (!declared) {
      violations.push(
        `${where}: no \`requires\` in meta. Expected [${expected.join(", ")}].`,
      );
      continue;
    }

    const declaredSorted = [...declared].sort().join(",");
    const expectedSorted = [...expected].sort().join(",");
    if (declaredSorted !== expectedSorted) {
      violations.push(
        `${where}: declares [${declared.join(", ")}] but its source reads [${expected.join(", ")}].`,
      );
    }
  }

  for (const id of registered.keys()) {
    if (!seen.has(id)) {
      violations.push(
        `${id}: registered, but no source file under packages/core/src/audits declares it.`,
      );
    }
  }

  if (violations.length > 0) {
    console.error("check-requires: found problems\n");
    for (const line of violations) console.error(`  - ${line}`);
    console.error(`\n${violations.length} problem(s).`);
    process.exit(1);
  }

  console.log(
    `check-requires: ${registered.size} audits OK (declared requires match what each source reads).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
