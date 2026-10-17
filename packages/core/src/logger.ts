/**
 * The scanner's logger.
 *
 * Every line carries a level, a time, a message and named fields. A module
 * takes a child logger with its component name (`logger.child({ component:
 * "fetcher" })`), so lines group by a field, not by a prefix in the text.
 * Inside
 * {@link withLogContext} it also carries that context — `runScan` sets the
 * scan id and the site — so a line from the fetcher, deep under an audit,
 * still says which scan sent it. Six scans in one process no longer write
 * lines nobody can attribute.
 *
 * Output goes to sinks. The default sink writes to stderr, never stdout:
 * stdout carries the CLI's report and the MCP server's protocol, and a log
 * line there corrupts both. Each sink has its own level and format, so a run
 * can keep the terminal at `warn` while a file receives every `debug` line as
 * JSON.
 *
 * The environment sets the default sink: `LOG_LEVEL` (silent, error, warn,
 * info, debug; default info) and `LOG_FORMAT` (text or json; default text).
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const LogLevel = {
  Silent: "silent",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: "debug",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogFormat = {
  Text: "text",
  Json: "json",
} as const;

export type LogFormat = (typeof LogFormat)[keyof typeof LogFormat];

export type LogFields = Record<string, unknown>;

/** One log line before it is formatted. */
export interface LogRecord {
  /** ISO 8601 time the line was written. */
  time: string;
  level: Exclude<LogLevel, typeof LogLevel.Silent>;
  msg: string;
  /** Context from {@link withLogContext}, then the call's own fields. */
  fields: LogFields;
}

export interface LogSink {
  /** The least severe level this sink writes. */
  level: LogLevel;
  format: LogFormat;
  /** Receives one formatted line, without a trailing newline. */
  write: (line: string) => void;
}

/** Severity order; a sink writes a record whose rank is at least its own. */
const RANK: Record<LogLevel, number> = {
  [LogLevel.Debug]: 10,
  [LogLevel.Info]: 20,
  [LogLevel.Warn]: 30,
  [LogLevel.Error]: 40,
  [LogLevel.Silent]: 100,
};

const LEVELS = new Set<string>(Object.values(LogLevel));
const FORMATS = new Set<string>(Object.values(LogFormat));

/** Parse a level name; undefined for anything that is not one. */
export function parseLogLevel(value: string | undefined): LogLevel | undefined {
  const lower = value?.trim().toLowerCase();
  return lower !== undefined && LEVELS.has(lower)
    ? (lower as LogLevel)
    : undefined;
}

/** Parse a format name; undefined for anything that is not one. */
export function parseLogFormat(
  value: string | undefined,
): LogFormat | undefined {
  const lower = value?.trim().toLowerCase();
  return lower !== undefined && FORMATS.has(lower)
    ? (lower as LogFormat)
    : undefined;
}

const context = new AsyncLocalStorage<LogFields>();

/**
 * Run `fn` with `fields` added to every line it logs, including lines from
 * async work it starts. Nested calls add to the outer context.
 */
export function withLogContext<T>(fields: LogFields, fn: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, fn);
}

/** An Error as plain fields; JSON.stringify drops an Error's own message. */
function plainError(error: Error): LogFields {
  const code = (error as { code?: unknown }).code;
  return {
    name: error.name,
    message: error.message,
    ...(code !== undefined && { code }),
  };
}

function toJson(record: LogRecord): string {
  const seen = new WeakSet();
  const replace = (_key: string, value: unknown): unknown => {
    if (value instanceof Error) return plainError(value);
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[circular]";
      seen.add(value);
    }
    return value;
  };
  return JSON.stringify(
    {
      time: record.time,
      level: record.level,
      msg: record.msg,
      ...record.fields,
    },
    replace,
  );
}

function textValue(value: unknown): string {
  if (value instanceof Error) return JSON.stringify(value.message);
  if (typeof value === "string")
    return /^[\w.:/@%+-]+$/.test(value) ? value : JSON.stringify(value);
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
  return String(value);
}

/**
 * `07:12:03.456 WARN  [example.com a1b2c3d4] fetcher: message key=value`.
 * The site and scan id lead because they are what a reader of a mixed log
 * looks for; the component names the part of the scanner that wrote it.
 */
function toText(record: LogRecord): string {
  const { site, scan, component, ...rest } = record.fields;
  const where = [site, scan]
    .filter((v) => v !== undefined)
    .map((v) => textValue(v))
    .join(" ");
  const extras = Object.entries(rest)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${textValue(value)}`)
    .join(" ");
  return [
    record.time.slice(11, 23),
    record.level.toUpperCase().padEnd(5),
    where ? `[${where}]` : "",
    component === undefined
      ? record.msg
      : `${textValue(component)}: ${record.msg}`,
    extras,
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatLogRecord(record: LogRecord, format: LogFormat): string {
  return format === LogFormat.Json ? toJson(record) : toText(record);
}

function stderrSink(level: LogLevel, format: LogFormat): LogSink {
  return {
    level,
    format,
    write: (line) => {
      process.stderr.write(`${line}\n`);
    },
  };
}

function envSink(): { sink: LogSink; warning?: string } {
  const rawLevel = process.env["LOG_LEVEL"];
  const rawFormat = process.env["LOG_FORMAT"];
  const level = parseLogLevel(rawLevel);
  const format = parseLogFormat(rawFormat);
  const bad = [
    rawLevel && !level ? `LOG_LEVEL=${rawLevel}` : undefined,
    rawFormat && !format ? `LOG_FORMAT=${rawFormat}` : undefined,
  ].filter(Boolean);
  return {
    sink: stderrSink(level ?? LogLevel.Info, format ?? LogFormat.Text),
    ...(bad.length > 0 && {
      warning: `Ignoring ${bad.join(" and ")}; levels: ${[...LEVELS].join(", ")}; formats: ${[...FORMATS].join(", ")}`,
    }),
  };
}

/**
 * Split a call's arguments into a message and fields. Both orders are
 * accepted, `(msg, fields)` and the older `(fields, msg)`; anything further
 * lands in `args` so nothing a caller passed is lost.
 */
function normalize(
  first: string | LogFields,
  rest: unknown[],
): { msg: string; fields: LogFields } {
  let msg: string;
  let fields: LogFields = {};
  let extra = rest;
  if (typeof first === "string") {
    msg = first;
    const next = rest[0];
    if (isFields(next)) {
      fields = next;
      extra = rest.slice(1);
    }
  } else {
    fields = first;
    const next = rest[0];
    msg = typeof next === "string" ? next : "";
    if (typeof next === "string") extra = rest.slice(1);
  }
  if (extra.length === 1 && extra[0] instanceof Error)
    return { msg, fields: { ...fields, err: extra[0] } };
  if (extra.length > 0) return { msg, fields: { ...fields, args: extra } };
  return { msg, fields };
}

function isFields(value: unknown): value is LogFields {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

/** What every logger derived from one root shares: where lines go. */
interface Output {
  sinks: LogSink[];
}

class Logger {
  private constructor(
    private readonly output: Output,
    private readonly bindings: LogFields,
  ) {}

  /** The root logger, with the stderr sink the environment asks for. */
  static root(): Logger {
    const { sink, warning } = envSink();
    const root = new Logger({ sinks: [sink] }, {});
    if (warning) root.warn(warning);
    return root;
  }

  /**
   * A logger that adds `bindings` to every line and writes to the same sinks.
   * Each module takes one with its component name, so the grouping is a
   * field of the line and not part of the message:
   *
   *     const log = logger.child({ component: "fetcher" });
   */
  child(bindings: LogFields): Logger {
    return new Logger(this.output, { ...this.bindings, ...bindings });
  }

  /**
   * The level of the first sink, the terminal one by default. Setting it
   * changes only that sink, so `logger.level = LogLevel.Silent` quiets the
   * terminal and leaves a log file running.
   */
  get level(): LogLevel {
    return this.output.sinks[0]?.level ?? LogLevel.Silent;
  }

  set level(level: LogLevel) {
    const first = this.output.sinks[0];
    if (first) first.level = parseLogLevel(level) ?? LogLevel.Info;
    else this.output.sinks = [stderrSink(level, LogFormat.Text)];
  }

  /** Add a sink. Returns a function that removes it again. */
  addSink(sink: LogSink): () => void {
    this.output.sinks.push(sink);
    return () => {
      this.output.sinks = this.output.sinks.filter((s) => s !== sink);
    };
  }

  /** True when some sink would write a line at `level`. */
  enabled(level: LogLevel): boolean {
    return this.output.sinks.some((sink) => RANK[level] >= RANK[sink.level]);
  }

  debug(msg: string | LogFields, ...args: unknown[]): void {
    this.log(LogLevel.Debug, msg, args);
  }

  info(msg: string | LogFields, ...args: unknown[]): void {
    this.log(LogLevel.Info, msg, args);
  }

  warn(msg: string | LogFields, ...args: unknown[]): void {
    this.log(LogLevel.Warn, msg, args);
  }

  error(msg: string | LogFields, ...args: unknown[]): void {
    this.log(LogLevel.Error, msg, args);
  }

  private log(
    level: LogRecord["level"],
    first: string | LogFields,
    rest: unknown[],
  ): void {
    if (!this.enabled(level)) return;
    const { msg, fields } = normalize(first, rest);
    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      msg,
      fields: { ...context.getStore(), ...this.bindings, ...fields },
    };
    for (const sink of this.output.sinks) {
      if (RANK[level] < RANK[sink.level]) continue;
      try {
        sink.write(formatLogRecord(record, sink.format));
      } catch {
        // A failing sink must never fail the scan that is logging.
      }
    }
  }
}

export type { Logger };

export const logger = Logger.root();
export default logger;
