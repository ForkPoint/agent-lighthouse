/**
 * Pure helpers for the weekly source watch (scripts/evidence/watch-sources.ts).
 *
 * Everything here is deterministic and network-free so it can be unit
 * tested: text normalization, URL classification, snapshot diffing, the
 * IANA registry CSV parse and diff, the source-to-audit map, and the issue
 * body. The network layer lives in the runner.
 */
import { createHash } from "node:crypto";

/** One row of docs/evidence/sources.json, as far as the watch reads it. */
export interface SourceEntry {
  id: string;
  url: string;
  title?: string;
}

/** One page or repo from docs/evidence/watchlist.json `items`. */
export interface WatchItem {
  id: string;
  title: string;
  url: string;
  why: string;
}

/** The slice of a bot registry row the watch reads. */
export interface WatchedBot {
  token: string;
  operator: string;
  docUrl: string | null;
}

/**
 * A watch id that depends only on the page, so reordering or removing a
 * registry row cannot rename an item. A renamed id has no previous snapshot,
 * and `diffEach` skips it, which would silently drop that week's change.
 */
function botWatchId(url: string): string {
  let key = url;
  try {
    const parsed = new URL(url);
    key = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // An unparseable URL keeps its raw text as the key.
  }
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `bot-registry:${slug}`;
}

/**
 * One watch item per operator page the bot registry cites, so a vendor that
 * renames a token, restates a purpose or changes a User-Agent string shows up
 * in the weekly report. Rows sharing a page share one item, which names
 * every token it backs. Undocumented rows cite no page and add nothing.
 *
 * A page that `already` watches (the hand-kept watchlist items) is skipped,
 * so one vendor edit is reported once rather than under two ids.
 */
export function botRegistryWatchItems(
  bots: readonly WatchedBot[],
  already: readonly WatchItem[] = [],
): WatchItem[] {
  const watched = new Set(already.map((item) => item.url));
  const byUrl = new Map<string, { operator: string; tokens: string[] }>();
  for (const bot of bots) {
    if (!bot.docUrl || watched.has(bot.docUrl)) continue;
    const existing = byUrl.get(bot.docUrl);
    if (existing) existing.tokens.push(bot.token);
    else byUrl.set(bot.docUrl, { operator: bot.operator, tokens: [bot.token] });
  }
  return [...byUrl].map(([url, { operator, tokens }]) => ({
    id: botWatchId(url),
    title: `${operator} crawler page (${tokens.join(", ")})`,
    url,
    why: "The bot registry (packages/core/src/bot-registry.ts) copies tokens, purposes and User-Agent strings from this page.",
  }));
}

/** One suffix from docs/evidence/watchlist.json `ianaPaths`. */
export interface WatchIanaPath {
  suffix: string;
  why: string;
}

export interface UrlSnapshot {
  /** HTTP status of the final response; null when no response arrived. */
  status: number | null;
  /** URL after redirects; null when no response arrived. */
  finalUrl: string | null;
  /** Network or TLS error code (e.g. CERT_HAS_EXPIRED); null on a response. */
  error: string | null;
  /** sha256 of the normalized body; null when there was no 2xx body. */
  hash: string | null;
}

export interface IetfSnapshot {
  name: string;
  rev: string | null;
  state: string | null;
  expires: string | null;
}

export interface GithubSnapshot {
  repo: string;
  pushedAt: string | null;
  archived: boolean | null;
  latestRelease: string | null;
}

export interface SourceSnapshot {
  url: UrlSnapshot;
  ietf?: IetfSnapshot;
  github?: GithubSnapshot;
}

export interface IanaRow {
  status: string;
  modified: string;
}

export interface WatchState {
  version: 1;
  checkedAt: string;
  sources: Record<string, SourceSnapshot>;
  watchlist: Record<string, SourceSnapshot>;
  iana: Record<string, IanaRow>;
}

/** What moved between two runs for one source. */
export const ChangeKind = {
  Broken: "broken",
  Recovered: "recovered",
  Moved: "moved",
  ContentChanged: "content-changed",
  DraftRevised: "draft-revised",
  DraftStateChanged: "draft-state-changed",
  RepoArchived: "repo-archived",
  RepoReleased: "repo-released",
  RepoPushed: "repo-pushed",
} as const;
export type ChangeKind = (typeof ChangeKind)[keyof typeof ChangeKind];

/**
 * Kinds that should prompt a dossier re-review. The rest (a page edit, a
 * push) are listed for context only: most are cosmetic.
 */
const REVIEW_KINDS: ReadonlySet<ChangeKind> = new Set([
  ChangeKind.Broken,
  ChangeKind.Recovered,
  ChangeKind.Moved,
  ChangeKind.DraftRevised,
  ChangeKind.DraftStateChanged,
  ChangeKind.RepoArchived,
  ChangeKind.RepoReleased,
]);

export interface Change {
  kind: ChangeKind;
  detail: string;
}

export function needsReview(change: Change): boolean {
  return REVIEW_KINDS.has(change.kind);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Reduce an HTML page to its visible text so a markup-only change (a new
 * CSS hash, a reordered attribute, a fresh CSRF token in a script) does not
 * read as a content change.
 */
export function normalizeHtml(html: string): string {
  return collapseWhitespace(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, name: string) => {
        if (name.startsWith("#x") || name.startsWith("#X")) {
          return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
        }
        if (name.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
        }
        return ENTITIES[name.toLowerCase()] ?? match;
      }),
  );
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Hash a body by its media type: visible text for HTML, whitespace-collapsed text for other text, raw bytes otherwise. */
export function hashBody(body: Uint8Array, contentType: string): string {
  const type = contentType.toLowerCase();
  const hash = createHash("sha256");
  if (type.includes("html")) {
    hash.update(normalizeHtml(new TextDecoder().decode(body)));
  } else if (
    type.startsWith("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("csv")
  ) {
    hash.update(collapseWhitespace(new TextDecoder().decode(body)));
  } else {
    hash.update(body);
  }
  return hash.digest("hex");
}

/** GitHub path segments that are not an owner. */
const GITHUB_RESERVED = new Set([
  "orgs",
  "search",
  "topics",
  "marketplace",
  "features",
  "settings",
  "sponsors",
  "apps",
  "collections",
]);

/** `owner/repo` for a github.com or raw.githubusercontent.com URL. */
export function githubRepoOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "raw.githubusercontent.com") {
    return null;
  }
  const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !repo || GITHUB_RESERVED.has(owner.toLowerCase())) return null;
  return `${owner}/${repo.replace(/\.git$/, "")}`;
}

/** Internet-Draft name (without revision) for a datatracker or ietf.org draft URL. */
export function ietfDraftOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "datatracker.ietf.org" && !host.endsWith("ietf.org"))
    return null;
  const match =
    /\/(draft-[a-z0-9-]+?)(?:-\d{2})?(?:\.(?:html|txt|xml|pdf))?\/?$/i.exec(
      parsed.pathname.replace(/\/(?:doc\.json|history|referencedby)\/?$/, "/"),
    );
  return match?.[1]?.toLowerCase() ?? null;
}

function isOk(snapshot: UrlSnapshot): boolean {
  return (
    snapshot.status !== null && snapshot.status >= 200 && snapshot.status < 400
  );
}

function describeFailure(snapshot: UrlSnapshot): string {
  if (snapshot.error) return snapshot.error;
  return `HTTP ${snapshot.status ?? "no response"}`;
}

/** Compare URLs ignoring a trailing slash and the fragment. */
function sameUrl(a: string | null, b: string | null): boolean {
  const norm = (u: string | null) =>
    (u ?? "").replace(/#.*$/, "").replace(/\/$/, "");
  return norm(a) === norm(b);
}

/** Every change between two snapshots of one source. */
export function diffSnapshot(
  prev: SourceSnapshot,
  next: SourceSnapshot,
): Change[] {
  const changes: Change[] = [];
  const wasOk = isOk(prev.url);
  const nowOk = isOk(next.url);
  if (wasOk && !nowOk) {
    changes.push({
      kind: ChangeKind.Broken,
      detail: describeFailure(next.url),
    });
  } else if (!wasOk && nowOk) {
    changes.push({
      kind: ChangeKind.Recovered,
      detail: `was ${describeFailure(prev.url)}, now HTTP ${next.url.status}`,
    });
  } else if (wasOk && nowOk) {
    if (!sameUrl(prev.url.finalUrl, next.url.finalUrl)) {
      changes.push({
        kind: ChangeKind.Moved,
        detail: `${prev.url.finalUrl} → ${next.url.finalUrl}`,
      });
    }
    if (prev.url.hash && next.url.hash && prev.url.hash !== next.url.hash) {
      changes.push({
        kind: ChangeKind.ContentChanged,
        detail: "page text changed",
      });
    }
  }

  const pi = prev.ietf;
  const ni = next.ietf;
  if (pi && ni && ni.rev !== null) {
    if (pi.rev !== null && pi.rev !== ni.rev) {
      changes.push({
        kind: ChangeKind.DraftRevised,
        detail: `${ni.name} -${pi.rev} → -${ni.rev}`,
      });
    }
    if (pi.state !== null && ni.state !== null && pi.state !== ni.state) {
      changes.push({
        kind: ChangeKind.DraftStateChanged,
        detail: `${ni.name}: ${pi.state} → ${ni.state}`,
      });
    }
  }

  const pg = prev.github;
  const ng = next.github;
  if (pg && ng) {
    if (ng.archived === true && pg.archived === false) {
      changes.push({
        kind: ChangeKind.RepoArchived,
        detail: `${ng.repo} archived`,
      });
    }
    if (ng.latestRelease && pg.latestRelease !== ng.latestRelease) {
      changes.push({
        kind: ChangeKind.RepoReleased,
        detail: `${ng.repo} ${pg.latestRelease ?? "none"} → ${ng.latestRelease}`,
      });
    }
    if (ng.pushedAt && pg.pushedAt && pg.pushedAt !== ng.pushedAt) {
      changes.push({
        kind: ChangeKind.RepoPushed,
        detail: `${ng.repo} pushed ${ng.pushedAt}`,
      });
    }
  }
  return changes;
}

/**
 * The snapshot to save for the next run. A failed datatracker or GitHub call
 * comes back with null fields, and `diffSnapshot` never reports a change from
 * a null baseline, so saving the failure would hide the next real change.
 * Each failed part keeps its last good value instead. The URL probe is always
 * taken as new: a broken page is itself a finding.
 */
export function keepLastGood(
  prev: SourceSnapshot | undefined,
  next: SourceSnapshot,
): SourceSnapshot {
  if (!prev) return next;
  const out: SourceSnapshot = { ...next };
  if (next.ietf && next.ietf.rev === null && prev.ietf?.rev) {
    out.ietf = prev.ietf;
  }
  const pg = prev.github;
  const ng = next.github;
  if (ng && pg) {
    // A good repo response always carries `pushed_at`.
    if (ng.pushedAt === null && ng.archived === null) {
      out.github = pg;
    } else if (ng.latestRelease === null && pg.latestRelease !== null) {
      // The releases call can fail on its own; keep the last tag.
      out.github = { ...ng, latestRelease: pg.latestRelease };
    }
  }
  return out;
}

/** Parse RFC 4180 CSV, including quoted fields with commas, quotes and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** The IANA well-known URIs CSV, keyed by suffix. */
export function parseIanaRegistry(csv: string): Record<string, IanaRow> {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return {};
  const col = (name: string) => header.findIndex((h) => h.trim() === name);
  const suffix = col("URI Suffix");
  const status = col("Status");
  const modified = col("Date Modified");
  const registered = col("Date Registered");
  const out: Record<string, IanaRow> = {};
  for (const row of rows) {
    const key = row[suffix]?.trim();
    if (!key) continue;
    out[key] = {
      status: row[status]?.trim() ?? "",
      modified: (row[modified]?.trim() || row[registered]?.trim()) ?? "",
    };
  }
  return out;
}

export interface IanaChange {
  suffix: string;
  detail: string;
}

export function diffIana(
  prev: Record<string, IanaRow>,
  next: Record<string, IanaRow>,
): IanaChange[] {
  const changes: IanaChange[] = [];
  for (const [suffix, row] of Object.entries(next)) {
    const old = prev[suffix];
    if (!old) {
      changes.push({ suffix, detail: `registered (${row.status})` });
    } else if (old.status !== row.status) {
      changes.push({ suffix, detail: `status ${old.status} → ${row.status}` });
    } else if (old.modified !== row.modified) {
      changes.push({ suffix, detail: `modified ${row.modified}` });
    }
  }
  for (const suffix of Object.keys(prev)) {
    if (!(suffix in next))
      changes.push({ suffix, detail: "removed from registry" });
  }
  return changes.sort((a, b) => a.suffix.localeCompare(b.suffix));
}

/** The `sources:` ids of one dossier, read off the raw frontmatter block (same rule as check-dossiers.mjs). */
function dossierSourceIds(text: string): string[] {
  const block = /^sources:\n((?:\s+- .*\n)+)/m.exec(text)?.[1];
  if (!block) return [];
  return [...block.matchAll(/- ['"]?([^'"\n]+?)['"]?\s*$/gm)]
    .map((m) => m[1]?.trim() ?? "")
    .filter(Boolean);
}

function dossierAuditId(text: string): string | null {
  return /^audit:\s*['"]?([^'"\n]+?)['"]?\s*$/m.exec(text)?.[1] ?? null;
}

/** sourceId → audit ids whose dossier cites it, each list sorted. */
export function mapSourcesToAudits(
  dossierTexts: readonly string[],
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const text of dossierTexts) {
    const audit = dossierAuditId(text);
    if (!audit) continue;
    for (const id of dossierSourceIds(text)) {
      let set = map.get(id);
      if (!set) {
        set = new Set();
        map.set(id, set);
      }
      set.add(audit);
    }
  }
  return new Map([...map].map(([id, set]) => [id, [...set].sort()]));
}

export interface ReportInput {
  checkedAt: string;
  baseline: boolean;
  sourceCount: number;
  sourceChanges: {
    id: string;
    url: string;
    changes: Change[];
    audits: string[];
  }[];
  watchChanges: { item: WatchItem; changes: Change[] }[];
  ianaChanges: IanaChange[];
  ianaWatch: { path: WatchIanaPath; row: IanaRow | null; changed: boolean }[];
  unreachable: number;
}

/** GitHub caps an issue body at 65,536 characters. */
const ISSUE_BODY_LIMIT = 60_000;

function changeList(changes: Change[]): string {
  return changes.map((c) => `${c.kind}: ${c.detail}`).join("; ");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** The rolling issue body. Review-worthy changes come first; cosmetic ones are truncated first. */
export function formatReport(input: ReportInput): string {
  const lines = [
    "# Source Watch",
    "",
    `_Checked ${input.checkedAt.slice(0, 10)} · ${input.sourceCount} sources · ${input.unreachable} without a 2xx/3xx response this run_`,
    "",
  ];
  if (input.baseline) {
    lines.push(
      "No previous state was found, so this run recorded a baseline. Changes are reported from the next run on.",
      "",
    );
  }

  const review = input.sourceChanges
    .map((s) => ({ ...s, changes: s.changes.filter(needsReview) }))
    .filter((s) => s.changes.length > 0);
  const cosmetic = input.sourceChanges
    .map((s) => ({ ...s, changes: s.changes.filter((c) => !needsReview(c)) }))
    .filter((s) => s.changes.length > 0);

  lines.push("## Needs review", "");
  if (review.length === 0) {
    lines.push("Nothing broke, moved, was revised or archived.", "");
  } else {
    lines.push("| Source | Change | Audits citing it |", "| :-- | :-- | :-- |");
    for (const s of review) {
      lines.push(
        `| [${s.id}](${s.url}) | ${escapeCell(changeList(s.changes))} | ${s.audits.map((a) => `\`${a}\``).join(", ") || "none"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## IANA well-known registry", "");
  if (input.ianaChanges.length === 0) {
    lines.push("No registry change.", "");
  } else {
    for (const c of input.ianaChanges)
      lines.push(`- \`${c.suffix}\`: ${c.detail}`);
    lines.push("");
  }

  lines.push(
    "## Watchlist",
    "",
    "| Path | Registry | Why it is watched |",
    "| :-- | :-- | :-- |",
  );
  for (const w of input.ianaWatch) {
    const row = w.row
      ? [w.row.status, w.row.modified].filter(Boolean).join(", ")
      : "not registered";
    lines.push(
      `| \`/.well-known/${w.path.suffix}\`${w.changed ? " **changed**" : ""} | ${row} | ${escapeCell(w.path.why)} |`,
    );
  }
  lines.push("");
  if (input.watchChanges.length === 0) {
    lines.push("No watched page or repo changed.", "");
  } else {
    for (const w of input.watchChanges) {
      lines.push(
        `- [${w.item.title}](${w.item.url}): ${changeList(w.changes)}`,
      );
    }
    lines.push("");
  }

  const footer = ["---", "_Generated by `scripts/evidence/watch-sources.ts`._"];
  const cosmeticLines = [
    "## Changed for context",
    "",
    "Page text edits and repository pushes. Usually cosmetic; listed so a quiet wording change is still visible.",
    "",
    ...cosmetic.map(
      (s) =>
        `- [${s.id}](${s.url}): ${changeList(s.changes)} (${s.audits.length} audit${s.audits.length === 1 ? "" : "s"})`,
    ),
    "",
  ];
  let body = lines.join("\n");
  let extra = cosmetic.length > 0 ? cosmeticLines.join("\n") : "";
  const room = ISSUE_BODY_LIMIT - body.length - 200;
  if (extra.length > room) {
    extra = `${extra.slice(0, Math.max(0, room)).replace(/\n[^\n]*$/, "")}\n\n_List truncated; the full report is in the workflow artifact._\n`;
  }
  body = `${body}\n${extra}\n${footer.join("\n")}`;
  return body.slice(0, ISSUE_BODY_LIMIT);
}

/** Split keys into groups that share `keyOf`, keeping first-seen order. */
export function groupBy(
  keys: readonly string[],
  keyOf: (key: string) => string,
): string[][] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const k = keyOf(key);
    const group = groups.get(k);
    if (group) group.push(key);
    else groups.set(k, [key]);
  }
  return [...groups.values()];
}
