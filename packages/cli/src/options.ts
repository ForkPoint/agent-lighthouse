import {
  CATEGORY_IDS,
  type PresetName,
  type PageType,
} from "@forkpoint/agent-lighthouse-core";

/**
 * Argument parsing, lifted out of `main.ts`.
 *
 * `main.ts` reads `process.argv` at module scope and calls `main()` on import,
 * so nothing in it could be exercised by a test. Everything here is a pure
 * function of the argv array and the config file, which is where every flag
 * bug this CLI has shipped actually lived — `--categories` was in the help text
 * for a whole major version without being parsed at all.
 *
 * Effects stay in `main.ts`: this module never writes to a stream and never
 * calls `process.exit`.
 */

/** Where `--trace` writes when it is given no path of its own. */
export const DEFAULT_TRACE_FILE = "agent-lighthouse-trace.ndjson";

/** The subset of a config file that the flags override. */
export interface FileConfig {
  url?: string;
  preset?: string;
  minScore?: number;
  outputDir?: string;
  output?: string[];
}

export interface CliOptions {
  url: string | undefined;
  configPath: string | undefined;
  presetName: PresetName;
  minScore: number;
  outputDir: string;
  outputFormats: string[];
  categories: string[] | undefined;
  /** Names passed to `--categories` that no category answers to. */
  unknownCategories: string[];
  includeExperimental: boolean;
  isSilent: boolean;
  progressJson: boolean;
  shouldView: boolean;
  debugAudit: string | undefined;
  pageType: PageType | undefined;
  /** Where to write the per-audit NDJSON trace, if `--trace` was given. */
  tracePath: string | undefined;
}

/**
 * Read one flag's value, in either `--flag=value` or `--flag value` form.
 *
 * A following token that starts with `-` is treated as the next flag rather
 * than as this one's value, so `--preset --silent` reports no preset instead of
 * silently scanning with a preset named "--silent".
 */
export function getArgValue(
  args: string[],
  shortFlag: string,
  longFlag: string,
): string | undefined {
  for (const arg of args) {
    if (shortFlag && arg.startsWith(`${shortFlag}=`)) {
      return arg.slice(shortFlag.length + 1);
    }
    if (longFlag && arg.startsWith(`${longFlag}=`)) {
      return arg.slice(longFlag.length + 1);
    }
  }
  const shortIdx = shortFlag ? args.indexOf(shortFlag) : -1;
  if (
    shortIdx !== -1 &&
    args[shortIdx + 1] &&
    !args[shortIdx + 1]!.startsWith("-")
  ) {
    return args[shortIdx + 1];
  }
  const longIdx = longFlag ? args.indexOf(longFlag) : -1;
  if (
    longIdx !== -1 &&
    args[longIdx + 1] &&
    !args[longIdx + 1]!.startsWith("-")
  ) {
    return args[longIdx + 1];
  }
  return undefined;
}

/** Split a comma-separated flag value, dropping empty entries. */
export function splitList(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The target URL: the positional argument wins over the config file. */
export function resolveUrl(
  positional: string | undefined,
  fileConfig: FileConfig,
): string | undefined {
  return positional || fileConfig.url;
}

/** Whether a string parses as an absolute URL. */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve every option from argv and the config file.
 *
 * Precedence is flag, then config file, then default — the order the help text
 * documents.
 */
export function parseCliOptions(
  args: string[],
  positionalUrl: string | undefined,
  fileConfig: FileConfig = {},
): CliOptions {
  const categories = splitList(getArgValue(args, "", "--categories"));
  const minScoreArg = getArgValue(args, "", "--min-score");

  return {
    url: resolveUrl(positionalUrl, fileConfig),
    configPath: getArgValue(args, "-c", "--config"),
    presetName: (getArgValue(args, "-p", "--preset") ||
      fileConfig.preset ||
      "full") as PresetName,
    minScore: minScoreArg ? Number(minScoreArg) : (fileConfig.minScore ?? 0),
    outputDir:
      getArgValue(args, "-d", "--output-dir") ||
      fileConfig.outputDir ||
      "./reports",
    outputFormats: splitList(getArgValue(args, "-o", "--output")) ??
      fileConfig.output ?? ["terminal", "html", "json"],
    categories,
    unknownCategories: (categories ?? []).filter(
      (c) => !CATEGORY_IDS.includes(c),
    ),
    includeExperimental: args.includes("--experimental"),
    isSilent: args.includes("--silent"),
    progressJson: args.includes("--progress-json"),
    shouldView: args.includes("-v") || args.includes("--view"),
    debugAudit: getArgValue(args, "", "--debug-audit"),
    pageType: getArgValue(args, "", "--page-type") as PageType | undefined,
    // A bare `--trace` with no path is still a request to trace, so it gets
    // the default file rather than being read as "no trace".
    tracePath: args.includes("--trace")
      ? (getArgValue(args, "", "--trace") ?? DEFAULT_TRACE_FILE)
      : getArgValue(args, "", "--trace"),
  };
}

/**
 * Which subcommand form was used.
 *
 * `al audit <url>`, `al <url>` and a bare `al` with a config file all reach the
 * same scan; anything starting with `-` is a flag, never a URL.
 */
export function resolveCommand(args: string[]): {
  action: "help" | "audit";
  url?: string;
} {
  const command = args[0];
  if (!command || command === "-h" || command === "--help")
    return { action: "help" };
  if (command === "audit") return { action: "audit", url: args[1] };
  if (!command.startsWith("-")) return { action: "audit", url: command };
  return { action: "audit" };
}

/**
 * Per-category thresholds, from `--assert-category id:min` and the config file.
 *
 * The flag repeats, so this cannot go through `getArgValue`, which returns the
 * first occurrence only. A fresh object is returned rather than the config
 * file's own: merging into `fileConfig.assertCategories` mutated the loaded
 * config, which the caller may still read.
 */
export function parseCategoryAssertions(
  args: string[],
  fileConfig: FileConfig & { assertCategories?: Record<string, number> } = {},
): Record<string, number> {
  const out: Record<string, number> = {
    ...(fileConfig.assertCategories ?? {}),
  };

  const record = (pair: string | undefined) => {
    if (!pair) return;
    const [catId, min] = pair.split(":");
    if (catId && min) out[catId] = Number(min);
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--assert-category="))
      record(arg.slice("--assert-category=".length));
    else if (arg === "--assert-category") record(args[i + 1]);
  }
  return out;
}

/** A category as the assertions see it. */
export interface AssertableCategory {
  id: string;
  name: string;
  score: number;
}

export interface FailedAssertion {
  name: string;
  score: number;
  threshold: number;
}

/**
 * The first assertion the scan does not meet, or undefined if it meets all.
 *
 * A threshold naming a category that did not run is not a failure: `--preset`
 * and `--categories` both narrow the scan, and failing CI over a category the
 * operator deliberately excluded would make the two flags unusable together.
 */
export function failedAssertion(
  categories: AssertableCategory[],
  assertions: Record<string, number>,
): FailedAssertion | undefined {
  for (const [catId, threshold] of Object.entries(assertions)) {
    const matched = categories.find(
      (c) =>
        c.id === catId || c.name.toLowerCase().includes(catId.toLowerCase()),
    );
    if (matched && matched.score < threshold) {
      return { name: matched.name, score: matched.score, threshold };
    }
  }
  return undefined;
}

/** A check as the debugger selects it. */
export interface DebuggableCheck {
  id: string;
  title: string;
  status: string;
}

/**
 * The checks `--debug-audit` should print.
 *
 * `fails` is a reserved value meaning "everything that is not clean"; anything
 * else matches an audit id exactly or a title substring, so an operator can
 * type `faqpage` instead of the full id.
 */
export function selectDebugChecks<T extends DebuggableCheck>(
  checks: T[],
  debugAudit: string,
): T[] {
  if (debugAudit === "fails") {
    return checks.filter((c) => c.status === "fail" || c.status === "warn");
  }
  const needle = debugAudit.toLowerCase();
  return checks.filter(
    (c) => c.id === debugAudit || c.title.toLowerCase().includes(needle),
  );
}

/** The shell command that opens a file in the platform's default application. */
export function openCommand(
  platform: NodeJS.Platform,
  filePath: string,
): string {
  if (platform === "darwin") return `open "${filePath}"`;
  if (platform === "win32") return `start "" "${filePath}"`;
  return `xdg-open "${filePath}"`;
}
