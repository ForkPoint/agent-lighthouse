export const LogLevel = {
  Silent: "silent",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: "debug",
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

class Logger {
  public level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.Info;

  private shouldLog(targetLevel: LogLevel): boolean {
    if (this.level === LogLevel.Silent) return false;
    const levels: LogLevel[] = [
      LogLevel.Debug,
      LogLevel.Info,
      LogLevel.Warn,
      LogLevel.Error,
    ];
    const currentIdx = levels.indexOf(this.level);
    const targetIdx = levels.indexOf(targetLevel);
    return targetIdx >= currentIdx;
  }

  debug(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.Debug)) {
      console.debug(typeof msg === "string" ? `[DEBUG] ${msg}` : msg, ...args);
    }
  }

  info(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.Info)) {
      console.info(typeof msg === "string" ? `[INFO] ${msg}` : msg, ...args);
    }
  }

  warn(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.Warn)) {
      console.warn(typeof msg === "string" ? `[WARN] ${msg}` : msg, ...args);
    }
  }

  error(msg: string | Record<string, unknown>, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.Error)) {
      console.error(typeof msg === "string" ? `[ERROR] ${msg}` : msg, ...args);
    }
  }
}

export const logger = new Logger();
export default logger;
