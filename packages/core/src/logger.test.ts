import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, type LogLevel } from "./logger";

const originalLevel = logger.level;
afterEach(() => {
  logger.level = originalLevel;
  vi.restoreAllMocks();
});

describe("logger", () => {
  it.each([
    ["silent", []],
    ["error", ["error"]],
    ["warn", ["warn", "error"]],
    ["info", ["info", "warn", "error"]],
    ["debug", ["debug", "info", "warn", "error"]],
  ] as const)("filters messages at level %s", (level, expected) => {
    logger.level = level;
    for (const method of ["debug", "info", "warn", "error"] as const) {
      const spy = vi.spyOn(console, method).mockImplementation(() => {});
      logger[method]("scan started", { url: "https://example.com" });
      if ((expected as readonly string[]).includes(method)) {
        expect(spy).toHaveBeenCalledExactlyOnceWith(
          `[${method.toUpperCase()}] scan started`,
          { url: "https://example.com" },
        );
      } else {
        expect(spy).not.toHaveBeenCalled();
      }
    }
  });

  it.each(["debug", "info", "warn", "error"] as const)(
    "preserves structured %s messages and extra arguments",
    (method) => {
      logger.level = "debug";
      const spy = vi.spyOn(console, method).mockImplementation(() => {});
      const message = { scanId: "s1", status: "failed" };
      const error = new Error("connection refused");
      logger[method](message, error, 3);
      expect(spy).toHaveBeenCalledExactlyOnceWith(message, error, 3);
    },
  );

  it.each([undefined, "silent", "debug"])(
    "reads LOG_LEVEL=%s on import",
    async (level) => {
      vi.resetModules();
      vi.stubEnv("LOG_LEVEL", level);
      try {
        const fresh = await import("./logger.js");
        expect(fresh.logger.level).toBe((level ?? "info") as LogLevel);
        expect(fresh.default).toBe(fresh.logger);
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
  );
});
