import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLogRecord,
  LogField,
  LogFormat,
  logger,
  LogLevel,
  parseLogFormat,
  parseLogLevel,
  setLogContextFields,
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

    it.each([
      "authorization",
      "Proxy-Authorization",
      "cookie",
      "Set-Cookie",
      "password",
      "passwd",
      "secret",
      "token",
      "access_token",
      "apikey",
      "api_key",
      "api-key",
      "X-API-Key",
    ])("blanks the value of a key named %s", (key) => {
      const lines = capture();
      logger.info({ [key]: "s3cr3t-value", nested: { [key]: ["s3cr3t"] } });
      expect(JSON.stringify(lines)).not.toContain("s3cr3t");
      expect(lines[0]).toMatchObject({
        [key]: "[redacted]",
        nested: { [key]: "[redacted]" },
      });
    });

    it("keeps a key that only contains a secret's name", () => {
      const lines = capture();
      logger.info({ tokenCount: 3, cookieConsent: "shown" });
      expect(lines[0]).toMatchObject({ tokenCount: 3, cookieConsent: "shown" });
    });

    it("removes credentials from bindings, context fields and extra arguments", () => {
      const lines = capture();
      withLogContext({ site: "https://ctx:pw1@example.com/" }, () => {
        logger
          .child({ base: "https://child:pw2@example.com/" })
          .info("msg", "https://arg:pw3@example.com/", 4);
      });
      const text = JSON.stringify(lines);
      for (const secret of ["pw1", "pw2", "pw3"])
        expect(text).not.toContain(secret);
      expect(lines[0]).toMatchObject({
        site: "https://[redacted]@example.com/",
        base: "https://[redacted]@example.com/",
        args: ["https://[redacted]@example.com/", 4],
      });
    });

    it("removes every URL's credentials in one value, whatever the scheme", () => {
      const lines = capture();
      logger.info({
        note: "from https://u:a1@a.test/x?next=wss://v:b2@b.test/ and redis://:c3@cache.test:6379",
      });
      expect(lines[0]?.["note"]).toBe(
        "from https://[redacted]@a.test/x?next=wss://[redacted]@b.test/ and redis://[redacted]@cache.test:6379",
      );
    });

    it("removes credentials from an error's cause chain", () => {
      const lines = capture();
      const root = Object.assign(
        new Error("connect to https://u:deep@example.com/ failed"),
        { code: "ECONNREFUSED" },
      );
      const error = new Error("fetch failed", {
        cause: new Error("GET https://u:mid@example.com/", { cause: root }),
      });
      logger.error({ [LogField.Error]: error }, "x");
      const text = JSON.stringify(lines);
      expect(text).not.toContain("deep");
      expect(text).not.toContain("mid");
      expect(lines[0]).toMatchObject({
        err: {
          message: "fetch failed",
          cause: {
            message: "GET https://[redacted]@example.com/",
            cause: {
              type: "Error",
              code: "ECONNREFUSED",
              message: "connect to https://[redacted]@example.com/ failed",
            },
          },
        },
      });
    });

    it("removes credentials from the message a caller's logger receives", () => {
      const received: Array<[LogFields, string | undefined]> = [];
      const record = (fields: LogFields | string, msg?: string): void => {
        if (typeof fields !== "string") received.push([fields, msg]);
      };
      const target: LoggerLike = {
        error: record,
        warn: record,
        info: record,
        debug: record,
        trace: record,
        child: () => target,
      };
      withLogContext(
        {},
        () => logger.warn("Fetching https://u:pw@example.com/"),
        target,
      );
      expect(received[0]?.[1]).toBe("Fetching https://[redacted]@example.com/");
    });

    // BUG: a password may hold a raw "@". WHATWG URL parsing reads the last
    // "@" before the host as the end of the userinfo, so the scanner
    // authenticates with the full password; splitCredentials decodes it that
    // way. The redaction pattern stops at the first "@" instead, so the rest
    // of the password reaches the sink: "https://[redacted]@ss@example.com/".
    // runScan logs the target URL as given on "Scan started", so a CLI user's
    // password leaks into a debug or --log-file line.
    it("removes a password that holds a raw @ in full", () => {
      const lines = capture();
      logger.info({ [LogField.Url]: "https://user:p@ss@example.com/" });
      expect(JSON.stringify(lines)).not.toContain("ss@example.com");
      expect(lines[0]?.[LogField.Url]).toBe("https://[redacted]@example.com/");
    });

    // The userinfo ends at the path, query or fragment. An "@" after that is
    // data, and a mail address beside a URL is not the URL's userinfo.
    it.each([
      ["https://example.com/?to=a@b.test", "https://example.com/?to=a@b.test"],
      ["https://example.com/a@b", "https://example.com/a@b"],
      ["https://example.com#me@b", "https://example.com#me@b"],
      [
        "https://example.com and me@b.test",
        "https://example.com and me@b.test",
      ],
      ["https://u:p@example.com?x=@", "https://[redacted]@example.com?x=@"],
    ])("leaves %j as %j", (input, output) => {
      const lines = capture();
      logger.info({ [LogField.Url]: input });
      expect(lines[0]?.[LogField.Url]).toBe(output);
    });
  });

  describe("error serialization", () => {
    it("keeps a cause that is not an Error as it is, redacted", () => {
      const lines = capture();
      logger.error({
        [LogField.Error]: new Error("outer", {
          cause: { reason: "quota", token: "t0k" },
        }),
      });
      logger.error({ [LogField.Error]: new Error("plain", { cause: "why" }) });
      expect(lines[0]).toMatchObject({
        err: { cause: { reason: "quota", token: "[redacted]" } },
      });
      expect(lines[1]).toMatchObject({ err: { cause: "why" } });
    });

    it("names the error's class and leaves out a code it does not have", () => {
      const lines = capture();
      logger.error({ [LogField.Error]: new TypeError("bad") });
      expect(lines[0]?.["err"]).toEqual({
        type: "TypeError",
        message: "bad",
        stack: expect.stringContaining("TypeError: bad"),
      });
    });

    it("serializes an error found under any key, not only err", () => {
      const lines = capture();
      logger.warn({ previous: new RangeError("too far") });
      expect(lines[0]).toMatchObject({
        previous: { type: "RangeError", message: "too far" },
      });
    });
  });

  it("writes a bigint as its digits", () => {
    const lines = capture();
    logger.info({ bytes: 2n ** 70n });
    expect(lines[0]?.["bytes"]).toBe("1180591620717411303424");
  });

  it("leaves out the caller when the stack does not reach it", () => {
    const lines = capture();
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 2;
    try {
      logger.warn("short stack");
    } finally {
      Error.stackTraceLimit = limit;
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: "short stack" });
    expect(lines[0]?.["caller"]).toBeUndefined();
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

  it("moves a context to its next phase, but not nested work begun before", async () => {
    const lines = capture();
    await withLogContext({ scan: "s" }, async () => {
      setLogContextFields({ phase: "fetch-root" });
      const nested = withLogContext({ gatherer: "sitemap" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        logger.debug("late gatherer line");
      });
      setLogContextFields({ phase: "audits" });
      logger.debug("audit line");
      await nested;
    });
    setLogContextFields({ phase: "ignored" });
    logger.debug("outside");
    const by = Object.fromEntries(lines.map((l) => [l["msg"], l]));
    expect(by["audit line"]?.["phase"]).toBe("audits");
    expect(by["late gatherer line"]).toMatchObject({
      phase: "fetch-root",
      gatherer: "sitemap",
    });
    expect(by["outside"]?.["phase"]).toBeUndefined();
  });

  it("names the caller's file and line on warn and error lines only", () => {
    const lines = capture();
    logger.warn("w");
    logger.child({ component: "x" }).error({ a: 1 }, "e");
    logger.info("i");
    expect(lines[0]?.["caller"]).toMatch(/^logger\.test\.ts:\d+$/);
    expect(lines[1]?.["caller"]).toMatch(/^logger\.test\.ts:\d+$/);
    expect(lines[2]?.["caller"]).toBeUndefined();
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

  it("writes each sink at its own level and in its own format", () => {
    capture(LogLevel.Silent);
    const text: string[] = [];
    const json: string[] = [];
    restores.push(
      logger.addSink({
        level: LogLevel.Warn,
        format: LogFormat.Text,
        write: (line) => text.push(line),
      }),
      logger.addSink({
        level: LogLevel.Trace,
        format: LogFormat.Json,
        write: (line) => json.push(line),
      }),
    );
    const log = logger.child({ component: "fetcher" });
    log.trace("each request");
    log.warn("budget ran out");
    expect(text).toHaveLength(1);
    expect(text[0]).toMatch(
      /^\d\d:\d\d:\d\d\.\d{3} WARN {2}fetcher: budget ran out caller=logger\.test\.ts:\d+$/,
    );
    expect(json.map((l) => (JSON.parse(l) as LogFields)["msg"])).toEqual([
      "each request",
      "budget ran out",
    ]);
  });

  it("stops writing to a sink once it is removed", () => {
    capture(LogLevel.Silent);
    const seen: string[] = [];
    const remove = logger.addSink({
      level: LogLevel.Info,
      format: LogFormat.Json,
      write: (line) => seen.push(line),
    });
    logger.info("one");
    remove();
    logger.info("two");
    expect(seen).toHaveLength(1);
  });

  it("falls back to info when the level is set to a name it does not know", () => {
    capture();
    logger.level = "verbose" as LogLevel;
    expect(logger.level).toBe(LogLevel.Info);
  });

  it("never enables the silent level, and enabled() agrees with isLevelEnabled()", () => {
    capture(LogLevel.Trace);
    expect(logger.isLevelEnabled(LogLevel.Silent)).toBe(false);
    expect(logger.enabled(LogLevel.Trace)).toBe(true);
    expect(logger.enabled(LogLevel.Silent)).toBe(false);
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

    it("is asked nothing it cannot answer: without isLevelEnabled every level is on", () => {
      const lines = capture(LogLevel.Silent);
      const { target, calls } = fakePino();
      delete target.isLevelEnabled;
      withLogContext(
        {},
        () => {
          expect(logger.isLevelEnabled(LogLevel.Trace)).toBe(true);
          logger.trace("deep detail");
        },
        target,
      );
      expect(calls.map(([level, , msg]) => [level, msg])).toEqual([
        ["trace", "deep detail"],
      ]);
      expect(lines).toEqual([]);
    });

    it("keeps the outer caller's logger for nested contexts", () => {
      const { target, calls } = fakePino();
      withLogContext(
        { scan: "s1" },
        () =>
          withLogContext({ audit: "a/b" }, () =>
            logger.warn({ n: 1 }, "inside"),
          ),
        target,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[1]).toMatchObject({
        scan: "s1",
        audit: "a/b",
        n: 1,
        caller: expect.stringMatching(/^logger\.test\.ts:\d+$/),
      });
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

  it("quotes a text value with spaces and writes an object as JSON", () => {
    expect(
      formatLogRecord(
        {
          time: record.time,
          level: LogLevel.Info,
          msg: "Scan finished",
          fields: { reason: "no answer", statuses: { "2xx": 3 }, pages: 2 },
        },
        LogFormat.Text,
      ),
    ).toBe(
      '07:12:03.456 INFO  Scan finished reason="no answer" statuses={"2xx":3} pages=2',
    );
  });

  it("prints no stack under a warn line", () => {
    expect(formatLogRecord(record, LogFormat.Text)).not.toContain("\n");
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
    ["SILENT", LogLevel.Silent],
    ["verbose", undefined],
    ["", undefined],
    ["warning", undefined],
    [undefined, undefined],
  ])("parses level %s", (raw, expected) => {
    expect(parseLogLevel(raw)).toBe(expected);
  });

  it.each([
    ["json", LogFormat.Json],
    ["TEXT", LogFormat.Text],
    [" json ", LogFormat.Json],
    ["yaml", undefined],
    ["", undefined],
    [undefined, undefined],
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

  it("writes JSON lines to stderr when LOG_FORMAT=json", async () => {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", "debug");
    vi.stubEnv("LOG_FORMAT", "json");
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const fresh = await import("./logger.js");
      fresh.logger.child({ component: "fetcher" }).debug({ n: 1 }, "hello");
      const line = String(err.mock.calls.at(-1)?.[0]);
      expect(line.endsWith("\n")).toBe(true);
      expect(JSON.parse(line)).toMatchObject({
        level: "debug",
        msg: "hello",
        component: "fetcher",
        n: 1,
      });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("falls back to text and says so for an unknown LOG_FORMAT", async () => {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", "verbose");
    vi.stubEnv("LOG_FORMAT", "yaml");
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const fresh = await import("./logger.js");
      expect(fresh.logger.level).toBe(LogLevel.Info);
      const warning = String(err.mock.calls[0]?.[0]);
      expect(warning).toContain(
        "Ignoring LOG_LEVEL=verbose and LOG_FORMAT=yaml",
      );
      expect(warning).toContain("formats: text, json");
      // The warning itself is a text line, not JSON.
      expect(warning).toMatch(/^\d\d:\d\d:\d\d\.\d{3} WARN /);
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
