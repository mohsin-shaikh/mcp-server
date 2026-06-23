import { describe, expect, it } from "vitest";
import { loadConfigFromEnv, mergeConfig } from "../src/config.js";
import { resolveModules } from "../src/modules/index.js";
import { registerModules } from "../src/registry/index.js";
import { createContext } from "../src/context.js";
import { createLogger } from "../src/lib/logger.js";
import type { McpServer } from "@modelcontextprotocol/server";

describe("config", () => {
  it("loads defaults from env", () => {
    const config = loadConfigFromEnv();
    expect(config.serverName).toBe("mcp-server");
    expect(config.modules).toEqual(["meta", "http", "json", "datetime", "docs"]);
    expect(config.httpAllowedHosts).toEqual([]);
  });

  it("merges CLI overrides", () => {
    const base = loadConfigFromEnv();
    const merged = mergeConfig(base, { readOnly: true, modules: ["meta"] });
    expect(merged.readOnly).toBe(true);
    expect(merged.modules).toEqual(["meta"]);
  });
});

describe("registry", () => {
  it("skips mutating modules in read-only mode", async () => {
    const config = mergeConfig(loadConfigFromEnv(), {
      readOnly: true,
      modules: ["meta", "http", "json"],
    });
    const logger = createLogger("fatal");
    const ctx = createContext(config, logger);

    const registeredTools: string[] = [];
    const mockServer = {
      registerTool: (name: string) => {
        registeredTools.push(name);
      },
    } as unknown as McpServer;

    const result = await registerModules(mockServer, ctx, config.modules);

    expect(result.skippedModuleIds).toContain("http");
    expect(registeredTools).toContain("server_info");
    expect(registeredTools).not.toContain("http_fetch");
  });

  it("resolves wildcard modules without filesystem", () => {
    const modules = resolveModules(["*"]);
    expect(modules.map((m) => m.id)).toEqual(["meta", "http", "json", "datetime", "docs"]);
  });
});
