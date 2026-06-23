import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  McpConnectionManager,
  McpToolRegistry,
  namespaceTool,
} from "../src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const serverEntry = resolve(repoRoot, "mcp-server/dist/index.js");

describe("stdio integration", () => {
  let manager: McpConnectionManager | undefined;

  afterEach(async () => {
    await manager?.close();
    manager = undefined;
  });

  it("connects, lists tools, and calls server_info", async () => {
    manager = new McpConnectionManager([
      {
        id: "core",
        transport: "stdio",
        command: "node",
        args: [serverEntry],
        env: {
          MCP_MODULES: "meta",
          LOG_LEVEL: "fatal",
        },
      },
    ]);

    await manager.connect();

    const registry = new McpToolRegistry(manager);
    await registry.refresh();

    const tools = registry.listTools();
    expect(tools.some((tool) => tool.namespacedName === namespaceTool("core", "server_info"))).toBe(
      true,
    );

    const result = await registry.callTool(namespaceTool("core", "server_info"), {});
    expect(result.isError).toBe(false);
    expect(result.content).toContain("mcp-server");

    const health = await manager.healthCheck();
    expect(health["core"]).toBe("ok");
  });
});
