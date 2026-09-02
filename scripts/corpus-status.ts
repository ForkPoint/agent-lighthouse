import * as fs from "node:fs";
import * as path from "node:path";
import {
  formatReport,
  mergeStatus,
  type CorpusStatus,
  type RunnerOutcome,
} from "../packages/core/src/tests/corpus-status";

/**
 * Read and write `status.json`.
 *
 *   pnpm corpus:status import <summary.json> [--date=YYYY-MM-DD]
 *   pnpm corpus:status report
 *
 * `import` accepts either runner's summary: both carry `outcomes[]` with a
 * `domain`, an optional `skipped`, the report's evidence map and its
 * `unscoredReason`. The date defaults to today, UTC; pass one to import an
 * older artifact under the day it ran.
 *
 * This file is flags and file I/O. The rules live in
 * `packages/core/src/tests/corpus-status.ts`, where they are tested.
 */

const STATUS_PATH = path.resolve(
  process.cwd(),
  "packages/core/test-data/sites/status.json",
);

function readStatus(): CorpusStatus | undefined {
  if (!fs.existsSync(STATUS_PATH)) return undefined;
  return JSON.parse(fs.readFileSync(STATUS_PATH, "utf8")) as CorpusStatus;
}

function flag(args: string[], name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "report") {
    const status = readStatus();
    if (!status) {
      console.log(`no status file at ${STATUS_PATH}`);
      return 0;
    }
    process.stdout.write(formatReport(status));
    return 0;
  }
  if (command === "import") {
    const file = rest.find((a) => !a.startsWith("--"));
    if (!file) {
      console.error(
        "usage: corpus-status import <summary.json> [--date=YYYY-MM-DD]",
      );
      return 2;
    }
    const date = flag(rest, "date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error(`--date must be YYYY-MM-DD, got "${date}"`);
      return 2;
    }
    const summary = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as {
      outcomes?: RunnerOutcome[];
    };
    if (!Array.isArray(summary.outcomes)) {
      console.error(`${file} has no outcomes[]; is it a runner summary?`);
      return 2;
    }
    const next = mergeStatus(readStatus(), summary.outcomes, date);
    fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
    fs.writeFileSync(STATUS_PATH, `${JSON.stringify(next, null, 2)}\n`);
    const counts: Record<string, number> = {};
    for (const o of Object.values(next.domains)) {
      counts[o.state] = (counts[o.state] ?? 0) + 1;
    }
    console.log(
      `${summary.outcomes.length} outcome(s) imported for ${date} -> ${STATUS_PATH} ` +
        `(${Object.entries(counts)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")})`,
    );
    return 0;
  }
  console.error("usage: corpus-status <import <summary.json> | report>");
  return 2;
}

process.exit(main(process.argv.slice(2)));
