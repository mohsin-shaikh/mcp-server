import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { McpConnectionManager, McpToolRegistry, namespaceTool } from "../src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const serverEntry = resolve(repoRoot, "mcp-server/dist/index.js");

function randomPort(): number {
  return 35_000 + Math.floor(Math.random() * 5000);
}

async function waitForHealth(port: number, attempts = 30): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Server did not become healthy on port ${port}`);
}

function spawnHttpServer(port: number) {
  return spawn("node", [serverEntry], {
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_AUTH_MODE: "none",
      MCP_MODULES: "meta",
      LOG_LEVEL: "fatal",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

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

describe("HTTP integration", () => {
  const children: ChildProcess[] = [];
  let manager: McpConnectionManager | undefined;

  afterEach(async () => {
    await manager?.close();
    manager = undefined;
    await Promise.all(children.splice(0).map((child) => stopServer(child)));
  });

  it("connects over streamable HTTP and calls server_info", async () => {
    const port = randomPort();
    const child = spawnHttpServer(port);
    children.push(child);

    await waitForHealth(port);

    manager = new McpConnectionManager([
      {
        id: "core",
        transport: "http",
        url: `http://127.0.0.1:${port}/mcp`,
      },
    ]);

    await manager.connect();

    const registry = new McpToolRegistry(manager);
    await registry.refresh();

    const result = await registry.callTool(namespaceTool("core", "server_info"), {});
    expect(result.isError).toBe(false);
    expect(result.content).toContain("mcp-server");

    const health = await manager.healthCheck();
    expect(health["core"]).toBe("ok");
  });
});
