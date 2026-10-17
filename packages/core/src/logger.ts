/**
 * The scanner's logger.
 *
 * The call shape is pino's: `log.info({ fields }, "Message")`, or
 * `log.info("Message")` with no fields. A caller can therefore hand `runScan`
 * its own pino (or any logger with the same methods) through
 * `ScanOptions.logger`, and every line of that scan goes there instead of to
 * the built-in sinks. A library should log through its host's logger, not
 * beside it.
 *
 * Lines group by fields, never by text in the message:
 *
 * - A module takes a child logger with its component name,
 *   `logger.child({ component: "fetcher" })`.
 * - {@link withLogContext} adds fields to every line logged inside it,
 *   across awaits. `runScan` sets `site` and `scan`, so a line from the
 *   fetcher deep under an audit still says which scan sent it.
 *
 * Field names follow the OpenTelemetry semantic conventions where one exists
 * ({@link LogField}); errors go under `err`, as in pino. Every line passes one
 * redaction step before it is written: credentials in URLs and secret-named
 * keys never reach a sink, wherever the caller forgot them.
 *
 * The built-in output goes to sinks. The default sink writes to stderr, never
 * stdout: stdout carries the CLI's report and the MCP server's protocol. Each
 * sink has its own level and format. `LOG_LEVEL` (silent, error, warn, info,
 * debug, trace; default info, and warn in the CLI) and `LOG_FORMAT` (text or json; default text)
 * set the default sink.
 *
 * Levels: `error` is a fault in the scanner; `warn` is something that changes
 * a result, such as a budget that ran out; `info` is one line per scan;
 * `debug` is a decision or a phase; `trace` is one line per request or audit.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export const LogLevel = {
  Silent: "silent",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: "debug",
  Trace: "trace",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/** A level a line can be written at. */
export type LineLevel = Exclude<LogLevel, typeof LogLevel.Silent>;

export const LogFormat = {
  Text: "text",
  Json: "json",
} as const;

export type LogFormat = (typeof LogFormat)[keyof typeof LogFormat];

/**
 * Field names shared by every module, so one query finds a value whichever
 * module wrote it. HTTP and URL names are OpenTelemetry's.
 */
export const LogField = {
  Component: "component",
  Site: "site",
  Scan: "scan",
  /** The scan phase a line was written in; see `PhaseId`. */
  Phase: "phase",
  /** The audit whose run wrote the line, directly or through a gatherer. */
  Audit: "audit",
  /** The shared gatherer whose work wrote the line. */
  Gatherer: "gatherer",
  /** Where a warn or error line was logged, as `file.ts:line`. */
  Caller: "caller",
  Error: "err",
  DurationMs: "durationMs",
  HttpMethod: "http.request.method",
  HttpStatus: "http.response.status_code",
  Url: "url.full",
  UserAgent: "user_agent.original",
} as const;

export type LogFields = Record<string, unknown>;

/** One log line before it is formatted. */
export interface LogRecord {
  /** ISO 8601 time the line was written. */
  time: string;
  level: LineLevel;
  msg: string;
  /** Context, then the logger's bindings, then the call's own fields. */
  fields: LogFields;
}

export interface LogSink {
  /** The least severe level this sink writes. */
  level: LogLevel;
  format: LogFormat;
  /** Receives one formatted line, without a trailing newline. */
  write: (line: string) => void;
}

type LogMethod = {
  (fields: LogFields, msg?: string): void;
  (msg: string): void;
};

/**
 * What core logs through. pino's `Logger` has all of it, so a pino instance
 * can be passed as `ScanOptions.logger` as it is.
 */
export interface LoggerLike {
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  trace: LogMethod;
  child(bindings: LogFields): LoggerLike;
  isLevelEnabled?(level: string): boolean;
}

/** Severity order; a sink writes a record whose rank is at least its own. */
const RANK: Record<LogLevel, number> = {
  [LogLevel.Trace]: 5,
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

interface Context {
  fields: LogFields;
  /** The caller's logger for this scan, when it passed one. */
  target?: LoggerLike;
}

const context = new AsyncLocalStorage<Context>();

/**
 * Run `fn` with `fields` added to every line it logs, including lines from
 * async work it starts. Nested calls add to the outer context. With `target`,
 * every line inside goes to that logger instead of the built-in sinks.
 */
export function withLogContext<T>(
  fields: LogFields,
  fn: () => T,
  target?: LoggerLike,
): T {
  const outer = context.getStore();
  const inner = target ?? outer?.target;
  return context.run(
    {
      fields: { ...outer?.fields, ...fields },
      ...(inner !== undefined && { target: inner }),
    },
    fn,
  );
}

/**
 * Set fields on the current context from here on, for the rest of the work
 * that context runs. A scan moves through its phases this way: each phase
 * sets `phase`, and lines written after that carry it. Work that already
 * opened its own nested context keeps the fields it started with. Outside a
 * context this does nothing.
 */
export function setLogContextFields(fields: LogFields): void {
  const store = context.getStore();
  if (store) Object.assign(store.fields, fields);
}

/**
 * `file.ts:line` of the code that called a log method, read from a stack
 * taken inside `Logger.log`. Its depth is fixed: the message line, `log`, the
 * public method (`warn` or `error`), then the caller.
 * With source maps on (the CLI turns them on), a bundled build still names
 * the source file.
 */
function callerOf(stack: string | undefined): string | undefined {
  const frame = stack?.split("\n")[3];
  const match = frame && /\(?([^\s()]+?):(\d+):\d+\)?\s*$/.exec(frame);
  if (!match) return undefined;
  const file = match[1]!.replace(/^file:\/\//, "");
  return `${file.slice(file.lastIndexOf("/") + 1)}:${match[2]}`;
}

// ── Redaction ─────────────────────────────────────────────────────────────

const SECRET_KEY =
  /^(authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|access_token|api[-_]?key|x-api-key)$/i;
// The userinfo runs to the last "@" before the path, query or fragment, as the
// WHATWG URL parser reads it: a raw "@" inside a password is part of the
// password, and stopping at the first one logged the rest of it.
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#]+@/gi;
const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

function redactString(value: string): string {
  return value.includes("@")
    ? value.replace(URL_CREDENTIALS, `$1${REDACTED}@`)
    : value;
}

/**
 * Remove credentials before a line leaves the logger: a URL's `user:pass@`,
 * and the value of any key named like a secret, at any depth. Errors become
 * plain objects here, with their stack.
 */
function redact(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return serializeError(value, depth, seen);
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[circular]";
  if (depth >= MAX_DEPTH) return "[truncated]";
  seen.add(value);
  if (Array.isArray(value))
    return value.map((item) => redact(item, depth + 1, seen));
  const out: LogFields = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return out;
}

/** pino's error shape: `type`, `message`, `stack`, plus `code` and `cause`. */
function serializeError(
  error: Error,
  depth: number,
  seen: WeakSet<object>,
): LogFields {
  const code = (error as { code?: unknown }).code;
  return {
    type: error.name,
    message: redactString(error.message),
    ...(error.stack !== undefined && { stack: redactString(error.stack) }),
    ...(code !== undefined && { code }),
    ...(error.cause !== undefined && {
      cause: redact(error.cause, depth + 1, seen),
    }),
  };
}

/** Errors are logged under `err`; a bare string there means its message. */
function prepareFields(fields: LogFields): LogFields {
  const err = fields[LogField.Error];
  const withErr =
    typeof err === "string"
      ? { ...fields, [LogField.Error]: { message: err } }
      : fields;
  return redact(withErr) as LogFields;
}

// ── Formats ───────────────────────────────────────────────────────────────

function toJson(record: LogRecord): string {
  return JSON.stringify({
    time: record.time,
    level: record.level,
    msg: record.msg,
    ...record.fields,
  });
}

function textValue(value: unknown): string {
  if (typeof value === "string")
    return /^[\w.:/@%+-]+$/.test(value) ? value : JSON.stringify(value);
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

/**
 * `07:12:03.456 WARN  [example.com a1b2c3d4] fetcher: Message key=value`.
 * The site and scan id lead because they are what a reader of a mixed log
 * looks for; the component names the part of the scanner that wrote it. An
 * error shows its message inline, and at level `error` its stack follows on
 * indented lines.
 */
function toText(record: LogRecord): string {
  const { site, scan, component, err, ...rest } = record.fields;
  const where = [
    site === undefined ? undefined : textValue(site),
    typeof scan === "string" ? scan.slice(0, 8) : undefined,
  ]
    .filter((v) => v !== undefined)
    .join(" ");
  const error = err as { message?: unknown; stack?: unknown } | undefined;
  const extras = Object.entries(rest)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${textValue(value)}`);
  if (error?.message !== undefined)
    extras.push(`err=${textValue(error.message)}`);
  const line = [
    record.time.slice(11, 23),
    record.level.toUpperCase().padEnd(5),
    where ? `[${where}]` : "",
    component === undefined
      ? record.msg
      : `${textValue(component)}: ${record.msg}`,
    extras.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  return record.level === LogLevel.Error && typeof error?.stack === "string"
    ? `${line}\n${error.stack.replace(/^/gm, "    ")}`
    : line;
}

export function formatLogRecord(record: LogRecord, format: LogFormat): string {
  return format === LogFormat.Json ? toJson(record) : toText(record);
}

// ── Sinks ─────────────────────────────────────────────────────────────────

function stderrSink(level: LogLevel, format: LogFormat): LogSink {
  return {
    level,
    format,
    // A pipe write is asynchronous in Node, so a piped stderr never blocks
    // the scan. A terminal write is synchronous, which keeps lines in order
    // with the CLI's own output.
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

// ── Logger ────────────────────────────────────────────────────────────────

/**
 * Split a call's arguments into fields and a message. pino's order is
 * `(fields, msg)`; a bare `(msg)` has no fields. The reverse order is still
 * read, so a caller written against the first version of this logger keeps
 * working, and anything further lands in `args`.
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
    return { msg, fields: { ...fields, [LogField.Error]: extra[0] } };
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

class Logger implements LoggerLike {
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
   * A logger that adds `bindings` to every line and writes where this one
   * does. Each module takes one with its component name.
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

  /**
   * True when a line at `level` would be written: by the caller's logger
   * inside a scan that passed one, else by some sink.
   */
  isLevelEnabled(level: LogLevel): boolean {
    if (level === LogLevel.Silent) return false;
    const target = context.getStore()?.target;
    if (target) return target.isLevelEnabled?.(level) ?? true;
    return this.output.sinks.some((sink) => RANK[level] >= RANK[sink.level]);
  }

  /** Alias of {@link isLevelEnabled}. */
  enabled(level: LogLevel): boolean {
    return this.isLevelEnabled(level);
  }

  error(first: string | LogFields, ...rest: unknown[]): void {
    this.log(LogLevel.Error, first, rest);
  }

  warn(first: string | LogFields, ...rest: unknown[]): void {
    this.log(LogLevel.Warn, first, rest);
  }

  info(first: string | LogFields, ...rest: unknown[]): void {
    this.log(LogLevel.Info, first, rest);
  }

  debug(first: string | LogFields, ...rest: unknown[]): void {
    this.log(LogLevel.Debug, first, rest);
  }

  trace(first: string | LogFields, ...rest: unknown[]): void {
    this.log(LogLevel.Trace, first, rest);
  }

  private log(
    level: LineLevel,
    first: string | LogFields,
    rest: unknown[],
  ): void {
    if (!this.isLevelEnabled(level)) return;
    const store = context.getStore();
    const { msg: rawMsg, fields: callFields } = normalize(first, rest);
    const msg = redactString(rawMsg);
    // Only warn and error lines pay for a stack: they are rare, and they are
    // the ones a reader needs to trace back to the code.
    const caller =
      RANK[level] >= RANK[LogLevel.Warn]
        ? callerOf(new Error().stack)
        : undefined;
    const fields = prepareFields({
      ...store?.fields,
      ...this.bindings,
      ...callFields,
      ...(caller !== undefined && { [LogField.Caller]: caller }),
    });
    if (store?.target) {
      try {
        store.target[level](fields, msg);
      } catch {
        // The caller's logger failing must not fail the scan.
      }
      return;
    }
    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      msg,
      fields,
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
