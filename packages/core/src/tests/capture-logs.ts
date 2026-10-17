import { logger, LogFormat, LogLevel, type LogFields } from "#core/logger";

/**
 * Capture every log line, as parsed JSON, and silence the terminal until
 * `restore()`. Modules log through child loggers, so spying on the root
 * logger's methods sees nothing; a sink sees every line.
 */
export function captureLogs(level: LogLevel = LogLevel.Trace): {
  lines: LogFields[];
  restore: () => void;
} {
  const lines: LogFields[] = [];
  const previous = logger.level;
  logger.level = LogLevel.Silent;
  const remove = logger.addSink({
    level,
    format: LogFormat.Json,
    write: (line) => lines.push(JSON.parse(line) as LogFields),
  });
  return {
    lines,
    restore: () => {
      remove();
      logger.level = previous;
    },
  };
}
