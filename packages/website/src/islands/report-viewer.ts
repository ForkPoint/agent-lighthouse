import { badgeColor } from "./badge-generator";

/**
 * The report inspector's client half.
 *
 * It renders a scan report the visitor supplies from their own disk. That makes
 * every value in it untrusted input, so this module has two rules it does not
 * bend:
 *
 * 1. Nothing from the file is ever parsed as markup. Rows are built with
 *    `createElement` and filled with `textContent`, the way the sources table
 *    builds its rows. There is no `innerHTML` here, and therefore no hand-rolled
 *    escaping to forget on one branch.
 * 2. Nothing from the file is trusted to exist or to have a type. `summarize`
 *    reads a `unknown`, coerces what it recognises and drops what it does not,
 *    and a file that is not a report ends as a sentence the reader can act on
 *    rather than as a stack trace in a console they never open.
 *
 * The file never leaves the browser: it is read with `File.text()`, and nothing
 * here fetches, evals, or uploads.
 */

/** One category row of the summary. */
export interface CategorySummary {
  name: string;
  /** 0–100. */
  score: number;
  /** How many checks the category carried. */
  checks: number;
}

/** What the viewer renders — the report reduced to the facts it shows. */
export interface ReportSummary {
  /** The scanned site, as the report names it. */
  url: string;
  /** 0–100, or null when the scan obtained too little evidence to judge. */
  score: number | null;
  /** The report's own tier label, or `''` when it carries none. */
  tier: string;
  /** How many pages the scan covered. */
  pages: number;
  durationMs: number;
  categories: CategorySummary[];
}

/** Thrown when a file parses but is not an Agent Lighthouse report. */
export class ReportShapeError extends Error {
  override name = "ReportShapeError";
}

/**
 * The longest a value from the file is allowed to be once rendered.
 *
 * A report is written by this tool and its URLs are short. A megabyte-long
 * "url" is either a corrupt file or an attempt to hang the page laying out one
 * text node; either way the reader is better served by the first 300 characters.
 */
const MAX_TEXT = 300;

/** How many category rows are built. Beyond this the page says so instead. */
export const MAX_CATEGORIES = 100;

/**
 * The largest file the viewer opens. A full 100-page report is a few hundred
 * kilobytes; this leaves an order of magnitude of headroom and still refuses
 * the multi-gigabyte file that would otherwise be read into a string.
 */
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

/** A plain object, or nothing. Arrays are not records here. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** A finite number, or nothing — `NaN` and `Infinity` are not scores. */
function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** A non-empty string, cut to a length the page can lay out. */
function asText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed;
}

/** A score reduced to the integer 0–100 the page renders. */
function asScore(value: unknown): number {
  const number = asNumber(value) ?? 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

/** How many entries an array field holds, counting a non-array as none. */
function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Reduce a parsed report to what the viewer shows.
 *
 * The field names are `ScanReport`'s, read from `packages/core/src/types.ts`:
 * `url`, `domain`, `overallScore`, `scoreTier`, `categories[].name`,
 * `categories[].checks`, `pagesScanned`, `durationMs`. `targetUrl` and `pages`
 * are accepted too — the page this one replaces guessed those names, and a
 * report saved by a reader from that era should still open.
 *
 * `overallScore` is the one field required — but an explicit `null` is a
 * value, not an absence: it is what a scan writes when it saw too little to
 * judge the site. A document *missing* the field is still not a scan report,
 * and pretending it scored 0 would be a lie dressed as a result.
 */
export function summarize(report: unknown): ReportSummary {
  const record = asRecord(report);
  if (!record) {
    throw new ReportShapeError(
      "That file is not a JSON object, so it cannot be a scan report.",
    );
  }

  const unscored = record["overallScore"] === null;
  const score = asNumber(record["overallScore"]);
  if (score === undefined && !unscored) {
    throw new ReportShapeError(
      "That JSON file has no numeric overallScore, so it is not an Agent Lighthouse report.",
    );
  }

  const rawCategories = Array.isArray(record["categories"])
    ? record["categories"]
    : [];
  const categories: CategorySummary[] = [];
  for (const entry of rawCategories) {
    const category = asRecord(entry);
    // A category that is not an object says nothing; skipping it keeps the
    // other seven readable rather than failing the whole file over one.
    if (!category) continue;
    categories.push({
      name:
        asText(category["name"]) ??
        asText(category["title"]) ??
        asText(category["id"]) ??
        "Unnamed category",
      score: asScore(category["score"]),
      checks: count(category["checks"]),
    });
  }

  const pages =
    count(record["pagesScanned"]) ||
    count(record["pagesData"]) ||
    count(record["pages"]);
  const duration = asNumber(record["durationMs"]) ?? 0;

  return {
    url:
      asText(record["url"]) ??
      asText(record["targetUrl"]) ??
      asText(record["domain"]) ??
      "Unnamed target",
    score: unscored || score === undefined ? null : asScore(score),
    tier: asText(record["scoreTier"]) ?? "",
    pages,
    durationMs: Math.max(0, Math.round(duration)),
    categories,
  };
}

/**
 * The colour a score is written in.
 *
 * Derived from `badgeColor` rather than from a second set of thresholds, so the
 * number the viewer shows in green is the number the badge generator would put
 * a green badge on.
 */
const TONE: Record<string, string> = {
  "22c55e": "text-emerald-400",
  "4f46e5": "text-indigo-300",
  f59e0b: "text-amber-300",
  ef4444: "text-red-400",
};

/** The Tailwind text colour for a score, following the published bands. */
export function scoreClass(score: number): string {
  return TONE[badgeColor(score)] ?? "text-slate-300";
}

/** Seconds, to one decimal, from a duration in milliseconds. */
export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** The line under the target: how much was scanned, and how long it took. */
export function scanLine(summary: ReportSummary): string {
  const pages = summary.pages === 1 ? "1 page" : `${summary.pages} pages`;
  return summary.durationMs > 0
    ? `${pages} scanned in ${formatDuration(summary.durationMs)}`
    : `${pages} scanned`;
}

/** A `<div>` with a class and text, the shape most of this panel is made of. */
function div(className: string, text?: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** One category card. Built from nodes, never from an HTML string. */
function categoryCard(category: CategorySummary): HTMLElement {
  const card = div(
    "flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface p-4",
  );

  const label = document.createElement("div");
  const name = document.createElement("h4");
  name.className = "text-sm font-semibold text-white";
  name.textContent = category.name;
  const checks = div(
    "mt-0.5 text-xs text-slate-400",
    category.checks === 1
      ? "1 audit evaluated"
      : `${category.checks} audits evaluated`,
  );
  label.append(name, checks);

  const score = document.createElement("span");
  score.className = `shrink-0 text-sm font-bold ${scoreClass(category.score)}`;
  score.textContent = `${category.score}/100`;

  card.append(label, score);
  return card;
}

/** The header block: the target, what was scanned, and the overall score. */
function header(summary: ReportSummary): HTMLElement {
  const wrap = div(
    "flex flex-col items-start justify-between gap-6 border-b border-border-subtle pb-6 sm:flex-row sm:items-center",
  );

  const left = document.createElement("div");
  const eyebrow = div(
    "text-xs font-bold uppercase tracking-wider text-slate-400",
    "Scanned target",
  );
  const target = document.createElement("h3");
  // `break-all`: the target is arbitrary text from the file and may have no
  // spaces to wrap at.
  target.className = "mt-1 break-all text-xl font-extrabold text-white";
  target.textContent = summary.url;
  left.append(
    eyebrow,
    target,
    div("mt-1 text-xs text-slate-400", scanLine(summary)),
  );

  const right = div("text-left sm:text-right");
  // A scan that saw too little carries no number. Showing 0 here would read as
  // a verdict about the site rather than about the scan.
  const score =
    summary.score === null
      ? div("text-2xl font-black text-amber-300", "Not scored")
      : div(
          `text-4xl font-black ${scoreClass(summary.score)}`,
          `${summary.score}/100`,
        );
  right.append(score);
  if (summary.score === null) {
    right.append(
      div(
        "mt-1 max-w-xs text-xs text-slate-400",
        "This scan obtained too little evidence to judge the site.",
      ),
    );
  }
  if (summary.tier) {
    right.append(
      div(
        "mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400",
        summary.tier,
      ),
    );
  }

  wrap.append(left, right);
  return wrap;
}

/** The rendered summary, as one detached node the caller drops into the page. */
export function renderSummary(summary: ReportSummary): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(header(summary));

  if (summary.categories.length === 0) {
    fragment.append(
      div(
        "text-sm text-slate-400",
        "The report carries no category scores, so there is nothing to break down.",
      ),
    );
    return fragment;
  }

  const grid = div("grid grid-cols-1 gap-4 sm:grid-cols-2");
  const shown = summary.categories.slice(0, MAX_CATEGORIES);
  for (const category of shown) grid.append(categoryCard(category));
  fragment.append(grid);

  const hidden = summary.categories.length - shown.length;
  if (hidden > 0) {
    fragment.append(
      div(
        "text-xs text-slate-400",
        `…and ${hidden} more categories this view does not render.`,
      ),
    );
  }
  return fragment;
}

/** Read one chosen file into a summary, or throw a sentence explaining why not. */
export async function readReport(file: File): Promise<ReportSummary> {
  if (file.size > MAX_REPORT_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new ReportShapeError(
      `That file is ${mb} MB. Reports are a few hundred kilobytes, so it was not opened.`,
    );
  }

  let parsed: unknown;
  try {
    // `File.text()` reads from the visitor's own disk. Nothing is uploaded, and
    // `JSON.parse` executes none of what it reads.
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ReportShapeError(
      "That file is not valid JSON. Open the report your scan wrote, not the HTML version.",
    );
  }
  return summarize(parsed);
}

/**
 * Bind the inspector to the page. The only DOM-touching export beyond the
 * builders above, and the only one that reads a file.
 */
export function mountReportViewer(): void {
  const input = document.querySelector<HTMLInputElement>("#report-file");
  const zone = document.querySelector<HTMLElement>("#report-dropzone");
  const status = document.querySelector<HTMLElement>("#report-status");
  const output = document.querySelector<HTMLElement>("#report-output");
  if (!input || !zone || !status || !output) return;

  // Only the text changes. The region is in the document, visible and empty from
  // first paint, so every message it is given is an actual content change to a
  // region assistive tech is already watching.
  const say = (message: string): void => {
    status.textContent = message;
  };

  const show = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    say(`Reading ${file.name}…`);
    let summary: ReportSummary;
    try {
      summary = await readReport(file);
    } catch (error) {
      output.hidden = true;
      output.replaceChildren();
      // Only this module's own message is shown. A `TypeError` from somewhere
      // deeper would say nothing useful to a reader and could quote the file
      // back at them, so it becomes the generic sentence instead.
      say(
        error instanceof ReportShapeError
          ? error.message
          : "That file could not be read as a scan report.",
      );
      return;
    }

    output.replaceChildren(renderSummary(summary));
    output.hidden = false;
    say(
      `Showing ${file.name}: ${summary.url} scored ${summary.score} out of 100.`,
    );
    // Optional-chained because it is genuinely optional: jsdom has no layout and
    // so no `scrollIntoView`. No `behavior` is passed, which leaves the choice
    // to the stylesheet — and to its `prefers-reduced-motion` rule.
    output.scrollIntoView?.();
  };

  input.addEventListener("change", () => {
    void show(input.files?.[0]);
  });

  // The two classes are swapped rather than layered. Both set `border-color`,
  // so leaving the resting one in place would make the highlight depend on the
  // order Tailwind emitted them in — which is not something this file controls.
  const light = (on: boolean): void => {
    zone.classList.toggle("border-brand", on);
    zone.classList.toggle("border-border-subtle", !on);
  };

  zone.addEventListener("dragover", (event) => {
    // Without this the browser navigates to the dropped file and the page is
    // gone: `dragover` is the event that has to be cancelled, not just `drop`.
    event.preventDefault();
    light(true);
  });
  zone.addEventListener("dragleave", () => light(false));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    light(false);
    void show(event.dataTransfer?.files?.[0]);
  });
}
