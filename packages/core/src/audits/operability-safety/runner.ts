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
import { logger } from "../../logger";
import { runRules } from "./engine/rules";

export interface A11yNodeFinding {
  target: string;
  summary: string;
}

export type A11yStatus = "pass" | "fail" | "incomplete" | "inapplicable";

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
  Number(process.env.A11Y_CONCURRENCY ?? 3),
);
let activeA11y = 0;
const a11yQueue: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (activeA11y < MAX_CONCURRENT_A11Y) {
    activeA11y++;
    return;
  }
  await new Promise<void>((resolve) => a11yQueue.push(resolve));
  activeA11y++;
}
function release(): void {
  activeA11y--;
  a11yQueue.shift()?.();
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
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*\brel\s*=\s*["']?stylesheet\b[^>]*>/gi, "");
}

/**
 * Run the given accessibility rule ids over one HTML document. Returns a map of
 * ruleId → {status, nodes}. Never throws — on any jsdom/internal failure it logs
 * and returns an empty map so the calling audits degrade to "not applicable".
 */
export async function runA11yForHtml(
  html: string,
  url: string,
  ruleIds: string[],
): Promise<A11yPageResult> {
  await acquire();
  let dom: JSDOM | undefined;
  try {
    dom = new JSDOM(stripStyles(html), {
      url,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const doc = dom.window.document as unknown as Document;
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
    logger.warn(
      { err, url },
      "[a11y-runner] accessibility run failed; treating rules as not-applicable",
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
