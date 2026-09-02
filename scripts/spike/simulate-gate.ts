/**
 * Spike step 3: what does the gate do to the score?
 *
 * Replays the recorded traces twice — as scanned, and with every page-reading
 * audit forced to `na` — through the real scorer arithmetic. Answers the one
 * question §7.1 and §7.5 of the design are arguing about: does silencing an
 * audit that had no evidence make a blocked site score better?
 */
import * as fs from "node:fs";
import { CATEGORY_MASS } from "../../packages/core/src/index";

interface Trace {
  id: string;
  category: string;
  status: string;
  score: number;
  weight: number;
}
interface Site {
  url: string;
  kind: string;
  score: number | null;
  pagesScanned: number;
  traces?: Trace[];
}

const READS_PAGES = new Set(
  fs
    .readFileSync(`${__dirname}/reads-pages.txt`, "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** `calculateCategoryScore`, restated over traces. Weight-0 audits cancel out. */
function categoryScore(traces: Trace[]): number | null {
  const scored = traces.filter((t) => t.status !== "na" && t.weight > 0);
  const total = scored.reduce((s, t) => s + t.weight, 0);
  if (total === 0) return null;
  return Math.round(
    (scored.reduce((s, t) => s + t.score * t.weight, 0) / total) * 100,
  );
}

/** `calculateOverallScore`, restated. A category with no assessable check drops out. */
function overall(traces: Trace[]): {
  score: number;
  droppedCategories: string[];
} {
  const byCat = new Map<string, Trace[]>();
  for (const t of traces) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t);
  }
  let weighted = 0;
  let mass = 0;
  const dropped: string[] = [];
  for (const [cat, list] of byCat) {
    const m = (CATEGORY_MASS as Record<string, number>)[cat] ?? 0;
    if (m <= 0) continue;
    const cs = categoryScore(list);
    if (cs === null) {
      dropped.push(cat);
      continue;
    }
    weighted += cs * m;
    mass += m;
  }
  return {
    score: mass === 0 ? 0 : Math.round(weighted / mass),
    droppedCategories: dropped,
  };
}

function main() {
  const sites: Site[] = JSON.parse(
    fs.readFileSync(`${__dirname}/results-traces.json`, "utf8"),
  );
  console.log(
    "site                          pages  baseline  gated   delta  categories dropped",
  );
  console.log("─".repeat(96));
  for (const s of sites) {
    if (!s.traces) continue;
    const before = overall(s.traces);
    const after = overall(
      s.traces.map((t) => (READS_PAGES.has(t.id) ? { ...t, status: "na" } : t)),
    );
    const delta = after.score - before.score;
    console.log(
      `${s.url.padEnd(30)}${String(s.pagesScanned).padStart(4)}  ${String(before.score).padStart(8)}  ${String(after.score).padStart(5)}  ${(delta >= 0 ? "+" : "") + delta}`.padEnd(
        72,
      ) + after.droppedCategories.join(", "),
    );
  }
}

main();
