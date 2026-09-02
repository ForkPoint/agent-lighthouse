import * as fs from "node:fs";
import * as path from "node:path";
import { createFetcher, boundedDispatcher } from "../packages/core/src/fetcher";
import { normalize } from "../packages/core/src/tests/site-list";

/**
 * Fetch each candidate once and say whether it can join the corpus.
 *
 *   pnpm corpus:probe [--candidates=<path>] [--out=<path>] [--concurrency=<n>]
 *
 * A candidate joins when its homepage answers 200 with HTML at the requested
 * host or a permanent redirect of it. An `exemplar` candidate must also serve
 * at least one of `/llms.txt`, `/.well-known/agents.json` or
 * `/.well-known/mcp.json` with 200. The output is a runner summary —
 * `outcomes[]` with `domain`, `score`, `evidence` and `unscoredReason` — so
 * `corpus:status import` reads it as a first observation, and a second file
 * `<out>.survivors.json` lists the domains per category that passed, ready to
 * paste into `seeds.json`.
 *
 * One request per URL, the scanner's own user agent, no retries. This is a
 * visit, not a scan.
 */

function flag(name: string, fallback: string): string {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const CANDIDATES = flag(
  "candidates",
  "packages/core/test-data/sites/candidates.json",
);
const OUT = flag("out", "reports/corpus-probe.json");
const CONCURRENCY = Math.max(1, Number(flag("concurrency", "6")) || 6);

const AGENT_ARTIFACTS = [
  "/llms.txt",
  "/.well-known/agents.json",
  "/.well-known/mcp.json",
];

const fetcher = createFetcher({
  dispatcher: boundedDispatcher(2),
  maxConcurrent: 2,
});

interface Outcome {
  domain: string;
  category: string;
  score: number | null;
  evidence: Record<string, boolean>;
  unscoredReason?: string;
  artifacts?: string[];
}

async function probe(domain: string, category: string): Promise<Outcome> {
  const home = await fetcher.fetch({ url: `https://${domain}/` });
  const finalHost = (() => {
    try {
      return new URL(home.finalUrl ?? home.url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const html = (home.contentType ?? "").toLowerCase().includes("html");
  const reachable =
    !home.error &&
    home.status === 200 &&
    html &&
    (finalHost === domain || finalHost.endsWith(`.${domain}`));
  const evidence = {
    "origin-reachable": reachable,
    "unblocked-fetches": home.status !== 403 && home.status !== 429,
    "rendered-body": reachable && home.body.length > 0,
    "sample-adequate": reachable,
  };
  const outcome: Outcome = {
    domain,
    category,
    score: reachable ? 100 : null,
    evidence,
  };
  if (!reachable) {
    outcome.unscoredReason = home.error
      ? `The homepage could not be fetched: ${home.error}.`
      : home.status !== 200
        ? `The homepage answered HTTP ${home.status}.`
        : finalHost !== domain
          ? `The requested host redirected to ${finalHost}, a different site.`
          : `The homepage served ${home.contentType || "no content type"}, not HTML.`;
    return outcome;
  }
  if (category === "exemplar") {
    const found: string[] = [];
    for (const artifact of AGENT_ARTIFACTS) {
      const r = await fetcher.fetch({ url: `https://${domain}${artifact}` });
      if (!r.error && r.status === 200 && r.body.trim().length > 0)
        found.push(artifact);
    }
    outcome.artifacts = found;
    if (found.length === 0) {
      outcome.score = null;
      outcome.unscoredReason =
        "No agent artifact: none of /llms.txt, /.well-known/agents.json, /.well-known/mcp.json answered 200.";
    }
  }
  return outcome;
}

async function main(): Promise<void> {
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES, "utf8")) as Record<
    string,
    string[]
  >;
  const queue: Array<{ domain: string; category: string }> = [];
  for (const [category, domains] of Object.entries(candidates)) {
    for (const raw of domains) {
      const domain = normalize(raw);
      if (domain === "") {
        console.error(
          `skipping ${category}: ${JSON.stringify(raw)} is not a bare hostname`,
        );
        continue;
      }
      queue.push({ domain, category });
    }
  }
  const outcomes: Outcome[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < queue.length) {
        const item = queue[next++]!;
        const outcome = await probe(item.domain, item.category);
        outcomes.push(outcome);
        const mark = outcome.score === null ? "✗" : "✓";
        console.log(
          `${mark} ${item.category.padEnd(11)} ${item.domain}${outcome.unscoredReason ? `  ${outcome.unscoredReason}` : ""}${outcome.artifacts?.length ? `  ${outcome.artifacts.join(" ")}` : ""}`,
        );
      }
    }),
  );
  outcomes.sort((a, b) => a.domain.localeCompare(b.domain));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    `${JSON.stringify({ probedAt: new Date().toISOString(), outcomes }, null, 2)}\n`,
  );
  const survivors: Record<string, string[]> = {};
  for (const o of outcomes) {
    if (o.score === null) continue;
    (survivors[o.category] ??= []).push(o.domain);
  }
  const survivorsPath = OUT.replace(/\.json$/, ".survivors.json");
  fs.writeFileSync(survivorsPath, `${JSON.stringify(survivors, null, 2)}\n`);
  console.log(
    `\n${outcomes.length} probed -> ${OUT}; survivors -> ${survivorsPath}`,
  );
  for (const [category, domains] of Object.entries(survivors).sort()) {
    console.log(
      `  ${category.padEnd(11)} ${domains.length} of ${candidates[category]?.length ?? 0}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
