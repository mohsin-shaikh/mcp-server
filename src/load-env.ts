import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILES = [".env.local", ".env"] as const;

/**
 * Load env files from cwd. Existing process.env values are not overwritten.
 * `.env.local` is loaded before `.env` so local values take precedence.
 */
export function loadEnvFiles(cwd = process.cwd()): void {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  for (const name of ENV_FILES) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
}
