import pino from "pino";
import type { LogLevel } from "../config.js";

export function createLogger(level: LogLevel) {
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
