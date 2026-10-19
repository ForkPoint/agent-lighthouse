/**
 * Weekly source watch.
 *
 * Re-checks every URL in docs/evidence/sources.json, every item in
 * docs/evidence/watchlist.json and every operator page the bot registry
 * (packages/core/src/bot-registry.ts) cites, compares the result with the previous run's
 * state, and writes a Markdown report that maps each changed source to the
 * audits whose dossiers cite it. It also diffs the IANA well-known URIs
 * registry.
 *
 * Like the review sweep, it never fails a build: a dead source is a reason
 * to re-review a dossier, not to block a merge. Individual fetch errors are
 * recorded in the state and the run exits 0; only a bug in the watch itself
 * exits 1.
 *
 * Usage:
 *   node --import tsx scripts/watch-sources.ts \
 *     [--state prev.json] [--out next.json] [--markdown report.md] \
 *     [--limit N] [--ids id1,id2]
 *
 * State lives outside the repo (the workflow keeps it as an artifact), so a
 * weekly run never adds a commit.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { BOT_REGISTRY } from "#core/bot-registry";
import {
  botRegistryWatchItems,
  diffIana,
  diffSnapshot,
  formatReport,
  githubRepoOf,
  groupBy,
  hashBody,
  ietfDraftOf,
  keepLastGood,
  mapSourcesToAudits,
  needsReview,
  parseIanaRegistry,
  type Change,
  type GithubSnapshot,
  type IetfSnapshot,
  type SourceEntry,
  type SourceSnapshot,
  type UrlSnapshot,
  type WatchIanaPath,
  type WatchItem,
  type WatchState,
} from "./lib/source-watch";

const root = resolve(__dirname, "..");
const USER_AGENT =
  "AgentLighthouseSourceWatch/1.0 (+https://github.com/ForkPoint/agent-lighthouse)";
const TIMEOUT_MS = 20_000;
const RETRIES = 2;
const HOST_CONCURRENCY = 8;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const IANA_CSV =
  "https://www.iana.org/assignments/well-known-uris/well-known-uris-1.csv";

const { values: args } = parseArgs({
  options: {
    state: { type: "string" },
    out: { type: "string" },
    markdown: { type: "string" },
    limit: { type: "string" },
    ids: { type: "string" },
  },
});

const githubToken = process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function errorCode(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: { code?: string } }).cause;
    if (cause?.code) return cause.code;
    if (err.name === "TimeoutError") return "TIMEOUT";
    return err.message;
  }
  return String(err);
}

/** Fetch with timeout and retry on network errors, 429 and 5xx. */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, ...headers },
      });
      if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
        await res.body?.cancel();
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_BODY_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk.subarray(0, size - offset), offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function probeUrl(url: string): Promise<UrlSnapshot> {
  try {
    const res = await fetchWithRetry(url);
    const ok = res.status >= 200 && res.status < 300;
    const hash = ok
      ? hashBody(await readCapped(res), res.headers.get("content-type") ?? "")
      : null;
    if (!ok) await res.body?.cancel();
    return { status: res.status, finalUrl: res.url, error: null, hash };
  } catch (err) {
    return { status: null, finalUrl: null, error: errorCode(err), hash: null };
  }
}

async function probeIetf(name: string): Promise<IetfSnapshot> {
  try {
    const res = await fetchWithRetry(
      `https://datatracker.ietf.org/doc/${name}/doc.json`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = (await res.json()) as {
      rev?: string;
      state?: string;
      expires?: string | null;
    };
    return {
      name,
      rev: doc.rev ?? null,
      state: doc.state ?? null,
      expires: doc.expires ?? null,
    };
  } catch {
    return { name, rev: null, state: null, expires: null };
  }
}

async function probeGithub(repo: string): Promise<GithubSnapshot> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  if (githubToken) headers["authorization"] = `Bearer ${githubToken}`;
  const empty = { repo, pushedAt: null, archived: null, latestRelease: null };
  try {
    const res = await fetchWithRetry(
      `https://api.github.com/repos/${repo}`,
      headers,
    );
    if (!res.ok) return empty;
    const info = (await res.json()) as {
      pushed_at?: string;
      archived?: boolean;
    };
    let latestRelease: string | null = null;
    const rel = await fetchWithRetry(
      `https://api.github.com/repos/${repo}/releases/latest`,
      headers,
    );
    if (rel.ok) {
      latestRelease =
        ((await rel.json()) as { tag_name?: string }).tag_name ?? null;
    } else {
      await rel.body?.cancel();
    }
    return {
      repo,
      pushedAt: info.pushed_at ?? null,
      archived: info.archived ?? null,
      latestRelease,
    };
  } catch {
    return empty;
  }
}

/** Run `task` over each host group, `HOST_CONCURRENCY` hosts at a time, one key at a time per host. */
async function probeAll<T>(
  keys: readonly string[],
  hostOf: (key: string) => string,
  task: (key: string) => Promise<T>,
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  const queue = groupBy(keys, hostOf);
  const workers = Array.from({ length: HOST_CONCURRENCY }, async () => {
    for (let group = queue.shift(); group; group = queue.shift()) {
      for (const key of group) out.set(key, await task(key));
    }
  });
  await Promise.all(workers);
  return out;
}

function readDossiers(dir: string): string[] {
  const texts: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) texts.push(...readDossiers(full));
    else if (entry.name.endsWith(".md")) texts.push(readFileSync(full, "utf8"));
  }
  return texts;
}

/** Snapshot every entry, probing each distinct URL, draft and repo once. */
async function snapshotAll(
  entries: readonly { id: string; url: string }[],
): Promise<Record<string, SourceSnapshot>> {
  const urls = [...new Set(entries.map((e) => e.url))];
  const drafts = [
    ...new Set(
      entries.map((e) => ietfDraftOf(e.url)).filter((d) => d !== null),
    ),
  ];
  const repos = [
    ...new Set(
      entries.map((e) => githubRepoOf(e.url)).filter((r) => r !== null),
    ),
  ];
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return u;
    }
  };
  const [urlSnaps, draftSnaps, repoSnaps] = await Promise.all([
    probeAll(urls, host, probeUrl),
    probeAll(drafts, () => "datatracker.ietf.org", probeIetf),
    probeAll(repos, () => "api.github.com", probeGithub),
  ]);
  const out: Record<string, SourceSnapshot> = {};
  for (const e of entries) {
    const url = urlSnaps.get(e.url);
    if (!url) continue;
    const snap: SourceSnapshot = { url };
    const draft = ietfDraftOf(e.url);
    const repo = githubRepoOf(e.url);
    const ietf = draft ? draftSnaps.get(draft) : undefined;
    const github = repo ? repoSnaps.get(repo) : undefined;
    if (ietf) snap.ietf = ietf;
    if (github) snap.github = github;
    out[e.id] = snap;
  }
  return out;
}

async function main(): Promise<void> {
  const registry = JSON.parse(
    readFileSync(join(root, "docs/evidence/sources.json"), "utf8"),
  ) as { sources: SourceEntry[] };
  const watchlist = JSON.parse(
    readFileSync(join(root, "docs/evidence/watchlist.json"), "utf8"),
  ) as { items: WatchItem[]; ianaPaths: WatchIanaPath[] };
  const watchItems = [
    ...watchlist.items,
    ...botRegistryWatchItems(BOT_REGISTRY, watchlist.items),
  ];

  let sources = registry.sources.filter(
    (s) => typeof s.url === "string" && s.url,
  );
  if (args.ids) {
    const wanted = new Set(args.ids.split(",").map((s) => s.trim()));
    sources = sources.filter((s) => wanted.has(s.id));
  }
  if (args.limit) sources = sources.slice(0, Number(args.limit));
  const sampled = Boolean(args.ids || args.limit);

  const prev: WatchState | null =
    args.state && existsSync(args.state)
      ? (JSON.parse(readFileSync(args.state, "utf8")) as WatchState)
      : null;

  const [sourceSnaps, watchSnaps, ianaCsv] = await Promise.all([
    snapshotAll(sources),
    // A sampled run skips the watchlist so a local test stays small.
    snapshotAll(sampled ? [] : watchItems),
    fetchWithRetry(IANA_CSV)
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null),
  ]);
  // A failed registry fetch keeps the previous rows, so it cannot read as
  // every entry being removed.
  const iana = ianaCsv ? parseIanaRegistry(ianaCsv) : (prev?.iana ?? {});

  // The diff below compares against this run's raw probes; the saved state
  // keeps the last good draft and repo fields so a failed request today does
  // not erase the baseline the next run compares against.
  const saved = (
    before: Record<string, SourceSnapshot> | undefined,
    after: Record<string, SourceSnapshot>,
  ): Record<string, SourceSnapshot> =>
    Object.fromEntries(
      Object.entries(after).map(([id, snap]) => [
        id,
        keepLastGood(before?.[id], snap),
      ]),
    );
  const next: WatchState = {
    version: 1,
    checkedAt: new Date().toISOString(),
    sources: saved(prev?.sources, sourceSnaps),
    watchlist: saved(prev?.watchlist, watchSnaps),
    iana,
  };

  const citing = mapSourcesToAudits(
    readDossiers(join(root, "docs/evidence/audits")),
  );
  const diffEach = (
    before: Record<string, SourceSnapshot> | undefined,
    after: Record<string, SourceSnapshot>,
  ) => {
    const out = new Map<string, Change[]>();
    for (const [id, snap] of Object.entries(after)) {
      const old = before?.[id];
      if (!old) continue;
      const changes = diffSnapshot(old, snap);
      if (changes.length > 0) out.set(id, changes);
    }
    return out;
  };
  const sourceDiff = diffEach(prev?.sources, sourceSnaps);
  const watchDiff = diffEach(prev?.watchlist, watchSnaps);
  const ianaChanges = prev ? diffIana(prev.iana, iana) : [];
  const ianaChanged = new Set(ianaChanges.map((c) => c.suffix));

  const report = formatReport({
    checkedAt: next.checkedAt,
    baseline: prev === null,
    sourceCount: sources.length,
    sourceChanges: sources
      .filter((s) => sourceDiff.has(s.id))
      .map((s) => ({
        id: s.id,
        url: s.url,
        changes: sourceDiff.get(s.id) ?? [],
        audits: citing.get(s.id) ?? [],
      })),
    watchChanges: watchItems
      .filter((i) => watchDiff.has(i.id))
      .map((item) => ({ item, changes: watchDiff.get(item.id) ?? [] })),
    ianaChanges,
    ianaWatch: watchlist.ianaPaths.map((path) => ({
      path,
      row: iana[path.suffix] ?? null,
      changed: ianaChanged.has(path.suffix),
    })),
    unreachable: Object.values(sourceSnaps).filter(
      (s) => s.url.status === null || s.url.status >= 400,
    ).length,
  });

  if (args.out) writeFileSync(args.out, `${JSON.stringify(next, null, 2)}\n`);
  if (args.markdown) writeFileSync(args.markdown, report);
  // Only review-worthy changes open an issue; a page edit alone does not.
  const reviewCount = [...sourceDiff.values(), ...watchDiff.values()].filter(
    (changes) => changes.some(needsReview),
  ).length;
  // A machine-readable line for the workflow, like the review sweep's --json.
  console.log(
    JSON.stringify({
      baseline: prev === null,
      changedSources: sourceDiff.size,
      changedWatchItems: watchDiff.size,
      ianaChanges: ianaChanges.length,
      needsReview: reviewCount + ianaChanges.length,
    }),
  );
}

// Individual fetch errors never reach here; they are recorded per source.
// Only a bug in the watch itself exits non-zero, so a broken run is not
// taken as the "last successful" state by the next one.
main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
