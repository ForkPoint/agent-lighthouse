import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLogRecord,
  LogField,
  LogFormat,
  logger,
  LogLevel,
  parseLogFormat,
  parseLogLevel,
  withLogContext,
  type LogFields,
  type LoggerLike,
  type LogRecord,
} from "./logger";
import { captureLogs } from "./tests/capture-logs";

const restores: Array<() => void> = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
  vi.restoreAllMocks();
});

/** Capture lines at `level` with the terminal silenced, undone after each test. */
function capture(level: LogLevel = LogLevel.Trace): LogFields[] {
  const logs = captureLogs(level);
  restores.push(logs.restore);
  return logs.lines;
}

describe("logger", () => {
  it.each([
    [LogLevel.Silent, []],
    [LogLevel.Error, ["error"]],
    [LogLevel.Warn, ["warn", "error"]],
    [LogLevel.Info, ["info", "warn", "error"]],
    [LogLevel.Debug, ["debug", "info", "warn", "error"]],
    [LogLevel.Trace, ["trace", "debug", "info", "warn", "error"]],
  ] as const)("filters messages at level %s", (level, expected) => {
    const lines = capture(level);
    for (const method of ["trace", "debug", "info", "warn", "error"] as const)
      logger[method]("scan started");
    expect(lines.map((l) => l["level"])).toEqual(expected);
  });

  it("writes to stderr, never stdout", () => {
    const previous = logger.level;
    restores.push(() => {
      logger.level = previous;
    });
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    logger.level = LogLevel.Debug;
    logger.debug("hello");
    expect(err).toHaveBeenCalledOnce();
    expect(String(err.mock.calls[0]?.[0])).toContain("DEBUG hello");
    expect(out).not.toHaveBeenCalled();
  });

  it("reads pino's (fields, message) order, and the reverse", () => {
    const lines = capture();
    logger.warn({ [LogField.Url]: "https://example.com/" }, "pino order");
    logger.warn("reverse order", { [LogField.Url]: "https://example.com/" });
    logger.warn("no fields");
    expect(lines).toMatchObject([
      { msg: "pino order", "url.full": "https://example.com/" },
      { msg: "reverse order", "url.full": "https://example.com/" },
      { msg: "no fields" },
    ]);
  });

  it("serializes an error under err with its type, message, stack and code", () => {
    const lines = capture();
    const error = Object.assign(new Error("connection refused"), {
      code: "ECONNREFUSED",
      cause: new Error("socket closed"),
    });
    logger.error({ [LogField.Error]: error }, "failed");
    logger.error("positional", new Error("second"));
    logger.debug({ [LogField.Error]: "plain text" }, "string error");
    expect(lines[0]).toMatchObject({
      err: {
        type: "Error",
        message: "connection refused",
        code: "ECONNREFUSED",
        stack: expect.stringContaining("logger.test"),
        cause: { message: "socket closed" },
      },
    });
    expect(lines[1]).toMatchObject({ err: { message: "second" } });
    expect(lines[2]).toMatchObject({ err: { message: "plain text" } });
  });

  it("keeps extra arguments", () => {
    const lines = capture();
    logger.error({ a: 1 }, "more", 2, 3);
    expect(lines[0]).toMatchObject({ msg: "more", a: 1, args: [2, 3] });
  });

  it("survives circular and deep fields", () => {
    const lines = capture();
    const loop: LogFields = {};
    loop["self"] = loop;
    logger.info({ loop, deep: { a: { b: { c: { d: { e: { f: 1 } } } } } } });
    expect(lines[0]).toMatchObject({
      loop: { self: "[circular]" },
      deep: { a: { b: { c: { d: { e: "[truncated]" } } } } },
    });
  });

  describe("redaction", () => {
    it("removes credentials from URLs in fields, messages and errors", () => {
      const lines = capture();
      logger.warn(
        {
          [LogField.Url]: "https://user:secret@example.com/a",
          list: ["ftp://bob:hunter2@files.test/"],
          [LogField.Error]: new Error("GET https://user:secret@example.com/"),
        },
        "Fetching https://user:secret@example.com/",
      );
      const text = JSON.stringify(lines);
      expect(text).not.toContain("secret");
      expect(text).not.toContain("hunter2");
      expect(lines[0]).toMatchObject({
        msg: "Fetching https://[redacted]@example.com/",
        "url.full": "https://[redacted]@example.com/a",
      });
    });

    it("blanks keys named like a secret, at any depth", () => {
      const lines = capture();
      logger.info({
        headers: {
          Authorization: "Bearer abc",
          Cookie: "sid=1",
          Accept: "*/*",
        },
        token: "t",
        password: "p",
      });
      expect(lines[0]).toMatchObject({
        headers: {
          Authorization: "[redacted]",
          Cookie: "[redacted]",
          Accept: "*/*",
        },
        token: "[redacted]",
        password: "[redacted]",
      });
    });

    it("leaves an email-like value alone", () => {
      const lines = capture();
      logger.info({ contact: "team@example.com" });
      expect(lines[0]?.["contact"]).toBe("team@example.com");
    });
  });

  it("adds the context to every line inside it, across awaits", async () => {
    const lines = capture();
    await Promise.all([
      withLogContext({ site: "a.test", scan: "1" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        logger.debug("from a");
      }),
      withLogContext({ site: "b.test", scan: "2" }, async () => {
        logger.debug("from b");
        await withLogContext({ phase: "audits" }, async () => {
          logger.debug("nested");
        });
      }),
    ]);
    logger.debug("outside");
    const by = Object.fromEntries(lines.map((l) => [l["msg"], l]));
    expect(by["from a"]).toMatchObject({ site: "a.test", scan: "1" });
    expect(by["from b"]).toMatchObject({ site: "b.test", scan: "2" });
    expect(by["nested"]).toMatchObject({ site: "b.test", phase: "audits" });
    expect(by["outside"]?.["site"]).toBeUndefined();
  });

  it("groups a module's lines by a component field, not a message prefix", () => {
    const lines = capture();
    const log = logger.child({ [LogField.Component]: "fetcher" });
    log.warn({ [LogField.Url]: "https://example.com/" }, "Request failed");
    log.child({ phase: "root" }).debug("nested");
    expect(lines).toMatchObject([
      { component: "fetcher", msg: "Request failed" },
      { component: "fetcher", phase: "root", msg: "nested" },
    ]);
  });

  it("lets a call's own fields win over the bindings", () => {
    const lines = capture();
    logger.child({ component: "a" }).info({ component: "b" }, "x");
    expect(lines[0]?.["component"]).toBe("b");
  });

  it("shares sinks and level between a child and the root", () => {
    const log = logger.child({ component: "fetcher" });
    const lines = capture(LogLevel.Warn);
    log.warn("seen by the added sink");
    expect(lines).toHaveLength(1);
    expect(log.level).toBe(LogLevel.Silent);
  });

  it("changes only the terminal sink when the level is set", () => {
    const lines = capture(LogLevel.Debug);
    logger.debug("still in the file");
    expect(lines).toHaveLength(1);
    expect(logger.isLevelEnabled(LogLevel.Debug)).toBe(true);
    expect(logger.isLevelEnabled(LogLevel.Trace)).toBe(false);
  });

  it("never lets a failing sink throw into the caller", () => {
    capture();
    restores.push(
      logger.addSink({
        level: LogLevel.Debug,
        format: LogFormat.Text,
        write: () => {
          throw new Error("disk full");
        },
      }),
    );
    expect(() => logger.info("x")).not.toThrow();
  });

  describe("a caller's logger", () => {
    /** A pino-shaped logger that records its calls. */
    function fakePino(enabled = true): {
      target: LoggerLike;
      calls: Array<[string, LogFields, string | undefined]>;
    } {
      const calls: Array<[string, LogFields, string | undefined]> = [];
      const method =
        (level: string) =>
        (fields: LogFields | string, msg?: string): void => {
          calls.push(
            typeof fields === "string"
              ? [level, {}, fields]
              : [level, fields, msg],
          );
        };
      const target: LoggerLike = {
        error: method("error"),
        warn: method("warn"),
        info: method("info"),
        debug: method("debug"),
        trace: method("trace"),
        child: () => target,
        isLevelEnabled: () => enabled,
      };
      return { target, calls };
    }

    it("receives every line inside the context, with its fields", () => {
      const lines = capture();
      const { target, calls } = fakePino();
      withLogContext(
        { site: "example.com", scan: "s1" },
        () => {
          logger
            .child({ component: "fetcher" })
            .debug(
              { [LogField.Url]: "https://u:p@example.com/" },
              "Request failed",
            );
        },
        target,
      );
      expect(lines).toEqual([]);
      expect(calls).toEqual([
        [
          "debug",
          {
            site: "example.com",
            scan: "s1",
            component: "fetcher",
            "url.full": "https://[redacted]@example.com/",
          },
          "Request failed",
        ],
      ]);
    });

    it("decides what is enabled", () => {
      const { target } = fakePino(false);
      withLogContext(
        {},
        () => expect(logger.isLevelEnabled(LogLevel.Error)).toBe(false),
        target,
      );
    });

    it("cannot fail the scan when it throws", () => {
      const { target } = fakePino();
      target.info = () => {
        throw new Error("broken transport");
      };
      expect(() =>
        withLogContext({}, () => logger.info("x"), target),
      ).not.toThrow();
    });
  });
});

describe("formatLogRecord", () => {
  const record: LogRecord = {
    time: "2026-10-17T07:12:03.456Z",
    level: LogLevel.Warn,
    msg: "Request failed",
    fields: {
      site: "example.com",
      scan: "a1b2c3d4-0000-4000-8000-000000000000",
      component: "fetcher",
      "url.full": "https://example.com/robots.txt",
      err: { message: "Connect Timeout Error", stack: "Error\n    at x" },
      durationMs: 10012,
    },
  };

  it("leads a text line with the time, level, site, short scan id and component", () => {
    expect(formatLogRecord(record, LogFormat.Text)).toBe(
      '07:12:03.456 WARN  [example.com a1b2c3d4] fetcher: Request failed url.full=https://example.com/robots.txt durationMs=10012 err="Connect Timeout Error"',
    );
  });

  it("prints the stack under an error line", () => {
    expect(
      formatLogRecord({ ...record, level: LogLevel.Error }, LogFormat.Text),
    ).toMatch(/err="Connect Timeout Error"\n {4}Error\n {8}at x$/);
  });

  it("writes one flat JSON object", () => {
    expect(JSON.parse(formatLogRecord(record, LogFormat.Json))).toEqual({
      time: "2026-10-17T07:12:03.456Z",
      level: "warn",
      msg: "Request failed",
      ...record.fields,
    });
  });
});

describe("environment", () => {
  it.each([
    ["debug", LogLevel.Debug],
    [" TRACE ", LogLevel.Trace],
    ["verbose", undefined],
    [undefined, undefined],
  ])("parses level %s", (raw, expected) => {
    expect(parseLogLevel(raw)).toBe(expected);
  });

  it.each([
    ["json", LogFormat.Json],
    ["TEXT", LogFormat.Text],
    ["yaml", undefined],
  ])("parses format %s", (raw, expected) => {
    expect(parseLogFormat(raw)).toBe(expected);
  });

  it.each([
    [undefined, LogLevel.Info],
    ["silent", LogLevel.Silent],
    ["trace", LogLevel.Trace],
  ])("reads LOG_LEVEL=%s on import", async (level, expected) => {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", level);
    try {
      const fresh = await import("./logger.js");
      expect(fresh.logger.level).toBe(expected);
      expect(fresh.default).toBe(fresh.logger);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("falls back to info and says so for an unknown LOG_LEVEL", async () => {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", "verbose");
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const fresh = await import("./logger.js");
      expect(fresh.logger.level).toBe(LogLevel.Info);
      expect(String(err.mock.calls[0]?.[0])).toContain(
        "Ignoring LOG_LEVEL=verbose",
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
