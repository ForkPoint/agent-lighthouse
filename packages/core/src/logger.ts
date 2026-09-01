export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

class Logger {
  public level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  private shouldLog(targetLevel: LogLevel): boolean {
    if (this.level === "silent") return false;
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentIdx = levels.indexOf(this.level);
    const targetIdx = levels.indexOf(targetLevel);
    return targetIdx >= currentIdx;
  }

  debug(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog("debug")) {
      console.debug(typeof msg === "string" ? `[DEBUG] ${msg}` : msg, ...args);
    }
  }

  info(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog("info")) {
      console.info(typeof msg === "string" ? `[INFO] ${msg}` : msg, ...args);
    }
  }

  warn(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog("warn")) {
      console.warn(typeof msg === "string" ? `[WARN] ${msg}` : msg, ...args);
    }
  }

  error(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog("error")) {
      console.error(typeof msg === "string" ? `[ERROR] ${msg}` : msg, ...args);
    }
  }
}

export const logger = new Logger();
export default logger;
