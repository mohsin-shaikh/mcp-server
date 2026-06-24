import pino from "pino";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export function createLogger(level: LogLevel = "info") {
  return pino(
    {
      level,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.destination({ dest: 2, sync: false }),
  );
}

export type Logger = ReturnType<typeof createLogger>;
