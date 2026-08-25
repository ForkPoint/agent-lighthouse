import { CATEGORY_IDS, type PresetName } from "@forkpoint/agent-lighthouse-core";

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
  if (shortIdx !== -1 && args[shortIdx + 1] && !args[shortIdx + 1]!.startsWith("-")) {
    return args[shortIdx + 1];
  }
  const longIdx = longFlag ? args.indexOf(longFlag) : -1;
  if (longIdx !== -1 && args[longIdx + 1] && !args[longIdx + 1]!.startsWith("-")) {
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
export function resolveUrl(positional: string | undefined, fileConfig: FileConfig): string | undefined {
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
    presetName: (getArgValue(args, "-p", "--preset") || fileConfig.preset || "full") as PresetName,
    minScore: minScoreArg ? Number(minScoreArg) : (fileConfig.minScore ?? 0),
    outputDir: getArgValue(args, "-d", "--output-dir") || fileConfig.outputDir || "./reports",
    outputFormats:
      splitList(getArgValue(args, "-o", "--output")) ??
      fileConfig.output ?? ["terminal", "html", "json"],
    categories,
    unknownCategories: (categories ?? []).filter((c) => !CATEGORY_IDS.includes(c)),
    includeExperimental: args.includes("--experimental"),
    isSilent: args.includes("--silent"),
    progressJson: args.includes("--progress-json"),
    shouldView: args.includes("-v") || args.includes("--view"),
    debugAudit: getArgValue(args, "", "--debug-audit"),
  };
}

/**
 * Which subcommand form was used.
 *
 * `al audit <url>`, `al <url>` and a bare `al` with a config file all reach the
 * same scan; anything starting with `-` is a flag, never a URL.
 */
export function resolveCommand(args: string[]): { action: "help" | "audit"; url?: string } {
  const command = args[0];
  if (!command || command === "-h" || command === "--help") return { action: "help" };
  if (command === "audit") return { action: "audit", url: args[1] };
  if (!command.startsWith("-")) return { action: "audit", url: command };
  return { action: "audit" };
}
