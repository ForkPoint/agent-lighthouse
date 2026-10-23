/**
 * Accessibility rule runner.
 *
 * Runs a subset of the accessibility rule set over a page's static HTML using
 * jsdom (no browser). We adopt only the rules that describe how an AI agent
 * reads/acts on a page via the accessibility tree — programmatic roles, names,
 * relationships, structure — NOT human-perception rules (color contrast, focus
 * visibility, target size), which a non-human consumer doesn't care about.
 *
 * The check/commons/standards logic for the 26 supported rules lives in
 * `./engine` and runs directly against the parsed DOM. Nothing is injected into
 * the jsdom window, so there is no heavyweight runtime to load per page.
 */
import { JSDOM } from "jsdom";
import { setImmediate as yieldForCancellation } from "node:timers/promises";
import { LogField, logger } from "#core/logger";

const log = logger.child({ [LogField.Component]: "a11y" });
import { runRules } from "./engine/rules";
import { RuleStatus } from "./engine/rules";

export interface A11yNodeFinding {
  target: string;
  summary: string;
}

/** One rule outcome, as the engine reports it. */
export type A11yStatus = RuleStatus;

export interface A11yRuleResult {
  status: A11yStatus;
  nodes: A11yNodeFinding[];
}

/** ruleId → result for a single page. */
export type A11yPageResult = Record<string, A11yRuleResult>;

// Bound how many jsdom instances are alive at once (process-wide) to cap memory
// under concurrent scans. Each run is independent, so this is a throughput
// limiter, not a correctness lock.
const MAX_CONCURRENT_A11Y = Math.max(
  1,
  Number(process.env["A11Y_CONCURRENCY"] ?? 3),
);
let activeA11y = 0;
const a11yQueue: Array<() => void> = [];
async function acquire(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  if (activeA11y < MAX_CONCURRENT_A11Y) {
    activeA11y++;
    return true;
  }
  return new Promise<boolean>((resolve) => {
    const grant = () => {
      signal?.removeEventListener("abort", cancel);
      resolve(true);
    };
    const cancel = () => {
      const index = a11yQueue.indexOf(grant);
      if (index === -1) return;
      a11yQueue.splice(index, 1);
      signal?.removeEventListener("abort", cancel);
      resolve(false);
    };
    a11yQueue.push(grant);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}
function release(): void {
  const next = a11yQueue.shift();
  // Transfer the reserved slot; a queued caller must not acquire it twice.
  if (next) next();
  else activeA11y--;
}

/**
 * Strip `<style>` blocks and stylesheet `<link>`s from an HTML string.
 *
 * jsdom parses every inline stylesheet into CSSOM *synchronously* when the
 * document is constructed — real storefronts ship hundreds of KB of inline CSS
 * across dozens of `<style>` blocks, which grinds the event loop for seconds
 * (and floods logs with "Could not parse CSS stylesheet"). None of our adopted
 * rules read CSS or layout (contrast/focus-visibility are deliberately
 * excluded, and jsdom has no layout engine anyway), so this CSS is pure dead
 * weight. Inline `style="…"` attributes are left intact — they carry per-element
 * state some rules inspect and cost nothing to keep.
 */
export function stripStyles(html: string): string {
  return stripStylesheetLinks(stripStyleBlocks(html));
}

/*
 * Both passes are linear in the input. The earlier regexes rescanned to the end
 * of the string for every unclosed `<style` or `<link`, which is quadratic, and
 * the input can be a client-supplied capture. Each search below starts where the
 * previous one ended, and a pass stops as soon as no later match is possible.
 */

/** True when the character after a tag name ends the name, like regex `\b`. */
function endsName(html: string, at: number): boolean {
  return at >= html.length || !/\w/.test(html[at]!);
}

/** Remove `<style …>…</style>` blocks, matching tag names case-insensitively. */
function stripStyleBlocks(html: string): string {
  const open = /<style/gi;
  const close = /<\/style[\t\n\f\r ]*>/gi;
  let out = "";
  let kept = 0;
  let match: RegExpExecArray | null;
  while ((match = open.exec(html))) {
    const start = match.index;
    if (!endsName(html, start + 6)) continue;
    const tagEnd = html.indexOf(">", start + 6);
    // No `>` left: no later block can open either.
    if (tagEnd === -1) break;
    close.lastIndex = tagEnd + 1;
    const end = close.exec(html);
    // No valid style end tag left: no later block can close either.
    if (!end) break;
    out += html.slice(kept, start);
    kept = end.index + end[0].length;
    open.lastIndex = kept;
  }
  return out + html.slice(kept);
}

const STYLESHEET_REL = /\brel\s*=\s*["']?stylesheet\b/i;

/** Remove `<link>` tags whose attributes declare `rel=stylesheet`. */
function stripStylesheetLinks(html: string): string {
  const open = /<link/gi;
  let out = "";
  let kept = 0;
  let match: RegExpExecArray | null;
  while ((match = open.exec(html))) {
    const start = match.index;
    if (!endsName(html, start + 5)) continue;
    const tagEnd = html.indexOf(">", start + 5);
    if (tagEnd === -1) break;
    // The attribute text is bounded by this tag, so the test is local to it.
    if (STYLESHEET_REL.test(html.slice(start + 5, tagEnd))) {
      out += html.slice(kept, start);
      kept = tagEnd + 1;
    }
    open.lastIndex = tagEnd + 1;
  }
  return out + html.slice(kept);
}

/**
 * Run the given accessibility rule ids over one HTML document. Returns a map of
 * ruleId → {status, nodes}. Never throws — on any jsdom/internal failure it logs
 * and returns an empty map so the calling audits degrade to "not applicable".
 * A canceled waiter returns an empty map without starting jsdom or logging a failure.
 */
export async function runA11yForHtml(
  html: string,
  url: string,
  ruleIds: string[],
  signal?: AbortSignal,
): Promise<A11yPageResult> {
  if (!(await acquire(signal))) return {};
  let dom: JSDOM | undefined;
  try {
    // A slot can be granted just before the owner cancels its work.
    if (signal?.aborted) return {};
    // Promise-only handoffs can drain the whole queue before abort events run.
    await yieldForCancellation();
    if (signal?.aborted) return {};
    dom = new JSDOM(stripStyles(html), {
      url,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const doc = dom.window.document;
    const results = runRules(doc, ruleIds);

    const out: A11yPageResult = {};
    for (const id of ruleIds) {
      const r = results[id];
      if (!r) continue;
      out[id] = {
        status: r.status,
        nodes: r.nodes.slice(0, 5).map((n) => ({
          target: n.target,
          summary: (n.summary ?? "").replace(/\s+/g, " ").trim(),
        })),
      };
    }
    return out;
  } catch (err) {
    log.warn(
      { [LogField.Url]: url, [LogField.Error]: err },
      "Accessibility run failed; rules read as not applicable",
    );
    return {};
  } finally {
    try {
      dom?.window.close();
    } catch {
      /* ignore */
    }
    release();
  }
}
