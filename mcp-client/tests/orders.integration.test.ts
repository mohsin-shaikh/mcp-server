import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  McpConnectionManager,
  McpToolRegistry,
  namespaceTool,
} from "../src/index.js";
import { startMockOrdersApi } from "../../mcp-server/tests/helpers/mock-orders-api.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const mcpServerDir = resolve(repoRoot, "mcp-server");
const serverEntry = resolve(mcpServerDir, "src/index.ts");
const tsxBin = resolve(mcpServerDir, "node_modules/.bin/tsx");
const pluginsDir = resolve(mcpServerDir, "plugins");

async function stopServer(child: ChildProcess): Promise<void> {
  child.kill("SIGTERM");
  await new Promise<void>((resolvePromise) => {
    child.on("exit", () => resolvePromise());
    setTimeout(() => {
      child.kill("SIGKILL");
      resolvePromise();
    }, 3000);
  });
}

describe("orders integration", () => {
  let manager: McpConnectionManager | undefined;
  let mockApi: Awaited<ReturnType<typeof startMockOrdersApi>> | undefined;
  const children: ChildProcess[] = [];

  afterEach(async () => {
    await manager?.close();
    manager = undefined;
    await Promise.all(children.splice(0).map((child) => stopServer(child)));
    await mockApi?.close();
    mockApi = undefined;
  });

  it("calls orders__get_order against a live orders API", async () => {
    mockApi = await startMockOrdersApi();

    manager = new McpConnectionManager([
      {
        id: "orders",
        transport: "stdio",
        command: tsxBin,
        args: [serverEntry],
        env: {
          MCP_MODULES: "meta,orders",
          MCP_PLUGINS_DIR: pluginsDir,
          ORDERS_API_BASE_URL: mockApi.baseUrl,
          ORDERS_API_ALLOWED_HOSTS: "127.0.0.1",
          LOG_LEVEL: "fatal",
        },
      },
    ]);

    await manager.connect();

    const registry = new McpToolRegistry(manager);
    await registry.refresh();

    const tools = registry.listTools();
    expect(tools.some((tool) => tool.namespacedName === namespaceTool("orders", "get_order"))).toBe(
      true,
    );

    const result = await registry.callTool(namespaceTool("orders", "get_order"), {
      id: "ord_123",
    });

    expect(result.isError).toBe(false);
    expect(result.content).toContain("ord_123");
    expect(result.content).toContain("shipped");
  });
});
