import { describe, expect, it } from "vitest";
import { resolveMcpConfigPath } from "../src/resolve-mcp-config.js";

describe("resolveMcpConfigPath", () => {
  const repoRoot = "/repo";

  it("uses MCP_SERVERS_CONFIG when set", () => {
    const previous = process.env["MCP_SERVERS_CONFIG"];
    process.env["MCP_SERVERS_CONFIG"] = "./custom.json";

    expect(resolveMcpConfigPath(repoRoot)).toBe("/repo/custom.json");

    if (previous === undefined) {
      delete process.env["MCP_SERVERS_CONFIG"];
    } else {
      process.env["MCP_SERVERS_CONFIG"] = previous;
    }
  });

  it("maps CHAT_ENV to config files", () => {
    const previousConfig = process.env["MCP_SERVERS_CONFIG"];
    const previousEnv = process.env["CHAT_ENV"];
    delete process.env["MCP_SERVERS_CONFIG"];
    process.env["CHAT_ENV"] = "staging";

    expect(resolveMcpConfigPath(repoRoot)).toBe("/repo/config/mcp-servers.staging.json");

    if (previousConfig === undefined) {
      delete process.env["MCP_SERVERS_CONFIG"];
    } else {
      process.env["MCP_SERVERS_CONFIG"] = previousConfig;
    }

    if (previousEnv === undefined) {
      delete process.env["CHAT_ENV"];
    } else {
      process.env["CHAT_ENV"] = previousEnv;
    }
  });
});
