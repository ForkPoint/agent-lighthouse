import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLogRecord,
  LogFormat,
  logger,
  LogLevel,
  parseLogFormat,
  parseLogLevel,
  withLogContext,
  type LogRecord,
} from "./logger";

const originalLevel = logger.level;
const removers: Array<() => void> = [];
afterEach(() => {
  logger.level = originalLevel;
  for (const remove of removers.splice(0)) remove();
  vi.restoreAllMocks();
});

/** Collect what the logger writes, as parsed JSON, at `level`. */
function capture(level: LogLevel = LogLevel.Debug): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  removers.push(
    logger.addSink({
      level,
      format: LogFormat.Json,
      write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
    }),
  );
  return lines;
}

function quietTerminal(): void {
  logger.level = LogLevel.Silent;
}

describe("logger", () => {
  it.each([
    [LogLevel.Silent, []],
    [LogLevel.Error, ["error"]],
    [LogLevel.Warn, ["warn", "error"]],
    [LogLevel.Info, ["info", "warn", "error"]],
    [LogLevel.Debug, ["debug", "info", "warn", "error"]],
  ] as const)("filters messages at level %s", (level, expected) => {
    quietTerminal();
    const lines = capture(level);
    for (const method of ["debug", "info", "warn", "error"] as const)
      logger[method]("scan started");
    expect(lines.map((l) => l["level"])).toEqual(expected);
  });

  it("writes to stderr, never stdout", () => {
    const err = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const out = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    logger.level = LogLevel.Debug;
    logger.debug("hello");
    expect(err).toHaveBeenCalledOnce();
    expect(String(err.mock.calls[0]?.[0])).toContain("DEBUG hello");
    expect(out).not.toHaveBeenCalled();
  });

  it("reads message and fields in either order", () => {
    quietTerminal();
    const lines = capture();
    logger.warn("new style", { url: "https://example.com/" });
    logger.warn({ url: "https://example.com/" }, "old style");
    expect(lines).toMatchObject([
      { msg: "new style", url: "https://example.com/" },
      { msg: "old style", url: "https://example.com/" },
    ]);
  });

  it("keeps extra arguments and serializes errors", () => {
    quietTerminal();
    const lines = capture();
    logger.error("failed", new Error("connection refused"));
    logger.error("more", { a: 1 }, 2, 3);
    expect(lines[0]).toMatchObject({
      msg: "failed",
      err: { name: "Error", message: "connection refused" },
    });
    expect(lines[1]).toMatchObject({ msg: "more", a: 1, args: [2, 3] });
  });

  it("survives a circular field", () => {
    quietTerminal();
    const lines = capture();
    const loop: Record<string, unknown> = {};
    loop["self"] = loop;
    logger.info("loop", { loop });
    expect(lines[0]).toMatchObject({ loop: { self: "[circular]" } });
  });

  it("adds the context to every line inside it, across awaits", async () => {
    quietTerminal();
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
    quietTerminal();
    const lines = capture();
    const log = logger.child({ component: "fetcher" });
    log.warn("Request failed", { url: "https://example.com/" });
    log.child({ phase: "root" }).debug("nested");
    expect(lines).toMatchObject([
      { component: "fetcher", msg: "Request failed" },
      { component: "fetcher", phase: "root", msg: "nested" },
    ]);
  });

  it("lets a call's own fields win over the bindings", () => {
    quietTerminal();
    const lines = capture();
    logger.child({ component: "a" }).info("x", { component: "b" });
    expect(lines[0]?.["component"]).toBe("b");
  });

  it("shares sinks and level between a child and the root", () => {
    const log = logger.child({ component: "fetcher" });
    const lines = capture(LogLevel.Warn);
    logger.level = LogLevel.Silent;
    log.warn("seen by the added sink");
    expect(lines).toHaveLength(1);
    expect(log.level).toBe(LogLevel.Silent);
  });

  it("changes only the terminal sink when the level is set", () => {
    const lines = capture(LogLevel.Debug);
    logger.level = LogLevel.Silent;
    logger.debug("still in the file");
    expect(lines).toHaveLength(1);
    expect(logger.enabled(LogLevel.Debug)).toBe(true);
  });

  it("never lets a failing sink throw into the caller", () => {
    quietTerminal();
    removers.push(
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
});

describe("formatLogRecord", () => {
  const record: LogRecord = {
    time: "2026-10-17T07:12:03.456Z",
    level: LogLevel.Warn,
    msg: "Request failed",
    fields: {
      site: "example.com",
      scan: "a1b2c3d4",
      component: "fetcher",
      url: "https://example.com/robots.txt",
      error: "Connect Timeout Error (UND_ERR_CONNECT_TIMEOUT)",
      ms: 10012,
    },
  };

  it("leads a text line with the time, level, site and scan", () => {
    expect(formatLogRecord(record, LogFormat.Text)).toBe(
      '07:12:03.456 WARN  [example.com a1b2c3d4] fetcher: Request failed url=https://example.com/robots.txt error="Connect Timeout Error (UND_ERR_CONNECT_TIMEOUT)" ms=10012',
    );
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
    [" WARN ", LogLevel.Warn],
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
    ["debug", LogLevel.Debug],
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
