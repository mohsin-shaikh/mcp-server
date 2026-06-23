import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "../src/load-env.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadEnvFiles", () => {
  it("loads .env.local into process.env", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-env-"));
    writeFileSync(join(dir, ".env.local"), "MCP_MODULES=meta,filesystem\nFS_ROOT=/tmp\n");

    loadEnvFiles(dir);

    expect(process.env["MCP_MODULES"]).toBe("meta,filesystem");
    expect(process.env["FS_ROOT"]).toBe("/tmp");
  });

  it("does not override existing process.env values", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-env-"));
    writeFileSync(join(dir, ".env.local"), "MCP_MODULES=filesystem\n");
    process.env["MCP_MODULES"] = "meta";

    loadEnvFiles(dir);

    expect(process.env["MCP_MODULES"]).toBe("meta");
  });

  it("ignores missing files", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-env-"));
    expect(existsSync(join(dir, ".env.local"))).toBe(false);

    expect(() => loadEnvFiles(dir)).not.toThrow();
  });
});
