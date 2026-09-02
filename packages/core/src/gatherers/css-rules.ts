import type { CheckContext, PageContext } from "../check-context";
import { isSafeUrl } from "../fetcher";
import { extractStylesheetUrls } from "../parser";

/** One `selector { declarations }` rule, with the at-rule it sits inside. */
export interface CssRule {
  /** The full selector list, verbatim, so a human can adjudicate a match. */
  selector: string;
  /** The declaration block, lowercased and whitespace-collapsed. */
  declarations: string;
  /** The enclosing at-rule prelude (`media print`, `supports (...)`), if any. */
  atRule?: string;
  /** Where the rule came from, for evidence. */
  origin: "inline" | string;
}

/** How many bytes of a single stylesheet to scan. */
const MAX_SHEET_BYTES = 512 * 1024;
/** How many linked stylesheets to fetch per page. */
const MAX_SHEETS = 5;

/** At-rules that hold declarations rather than nested rules, so carry no selector. */
const DECLARATION_AT_RULES =
  /^@(font-face|page|viewport|counter-style|property|layer\b[^{]*$)/i;

/**
 * Scan a stylesheet into flat selector/declaration pairs.
 *
 * Deliberately a scanner, not a parser: it performs no cascade, no specificity
 * ordering and no media-query evaluation. It exists so an audit can ask "does
 * any rule that could apply to this element declare display:none", and it
 * reports the matched selector text so a human can check the answer. A full CSS
 * engine would need a dependency the core package does not carry.
 */
export function parseCssRules(source: string, origin = "inline"): CssRule[] {
  const text = stripComments(source).slice(0, MAX_SHEET_BYTES);
  const rules: CssRule[] = [];
  // The at-rule preludes currently open, outermost first.
  const atStack: string[] = [];
  let buffer = "";

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === "{") {
      const prelude = buffer.trim();
      buffer = "";
      if (prelude.startsWith("@")) {
        if (
          DECLARATION_AT_RULES.test(prelude) ||
          /^@keyframes/i.test(prelude)
        ) {
          // The body holds declarations or keyframe steps, not selectors. Skip
          // it wholesale rather than reading its contents as rules.
          i = skipBlock(text, i);
          continue;
        }
        atStack.push(prelude.replace(/^@/, "").replace(/\s+/g, " ").trim());
        continue;
      }
      const end = text.indexOf("}", i);
      const declarations = (
        end === -1 ? text.slice(i + 1) : text.slice(i + 1, end)
      )
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (prelude) {
        rules.push({
          selector: prelude.replace(/\s+/g, " "),
          declarations,
          ...(atStack.length ? { atRule: atStack[atStack.length - 1]! } : {}),
          origin,
        });
      }
      i = end === -1 ? text.length : end;
      continue;
    }
    if (ch === "}") {
      buffer = "";
      atStack.pop();
      continue;
    }
    buffer += ch;
  }

  return rules;
}

/** Index of the `}` closing the block whose `{` is at `open`. */
function skipBlock(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

export interface PageCss {
  rules: CssRule[];
  /** Stylesheet URLs on another origin, which are never fetched. */
  skippedCrossOrigin: string[];
  /** Stylesheet URLs fetched and scanned. */
  fetched: string[];
}

/**
 * Collect every CSS rule a page's own markup and same-origin stylesheets carry.
 *
 * Cross-origin sheets are not fetched: a scan must not pull bytes from a third
 * party on the scanned site's behalf. They are reported instead, so a result
 * built on partial CSS says so rather than reading as complete.
 */
export async function collectPageCss(
  ctx: CheckContext,
  page: PageContext,
): Promise<PageCss> {
  const $ = page.$;
  const rules: CssRule[] = [];
  const skippedCrossOrigin: string[] = [];
  const fetched: string[] = [];

  $("style").each((_, el) => {
    rules.push(...parseCssRules($(el).text(), "inline <style>"));
  });

  const pageOrigin = safeOrigin(page.url);
  for (const href of extractStylesheetUrls($).slice(0, MAX_SHEETS)) {
    const absolute = resolveUrl(href, page.url);
    if (!absolute) continue;
    if (safeOrigin(absolute) !== pageOrigin) {
      skippedCrossOrigin.push(absolute);
      continue;
    }
    // The href comes out of site-controlled markup, so it is gated like any
    // other URL the scanner follows.
    if (!(await isSafeUrl(absolute))) {
      skippedCrossOrigin.push(absolute);
      continue;
    }
    const result = await ctx.fetch({ url: absolute });
    if (result.status !== 200 || !result.body) continue;
    fetched.push(absolute);
    rules.push(...parseCssRules(result.body, absolute));
  }

  return { rules, skippedCrossOrigin, fetched };
}

function resolveUrl(href: string, base: string): string | undefined {
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
