import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadPluginModule } from "../src/plugins/loader.js";
import { startMockOrdersApi } from "./helpers/mock-api-server.js";

const tsxEntry = path.join(process.cwd(), "src/index.ts");
const tsxBin = path.join(process.cwd(), "node_modules/.bin/tsx");
const pluginsDir = path.join(process.cwd(), "plugins");

function sendMessage(child: ChildProcess, message: Record<string, unknown>): void {
  child.stdin?.write(`${JSON.stringify(message)}\n`);
}

function readJsonLine(buffer: string): { line: string | undefined; rest: string } {
  const index = buffer.indexOf("\n");
  if (index === -1) {
    return { line: undefined, rest: buffer };
  }
  return {
    line: buffer.slice(0, index),
    rest: buffer.slice(index + 1),
  };
}

async function rpc(
  child: ChildProcess,
  id: number,
  method: string,
  params?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      let parsed = readJsonLine(buffer);
      while (parsed.line) {
        buffer = parsed.rest;
        try {
          const msg = JSON.parse(parsed.line) as Record<string, unknown>;
          if (msg["id"] === id) {
            child.stdout?.off("data", onData);
            resolve(msg);
            return;
          }
        } catch {
          // ignore partial/non-json lines
        }
        parsed = readJsonLine(buffer);
      }
    };

    child.stdout?.on("data", onData);
    child.on("error", reject);

    sendMessage(child, {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    });
  });
}

async function initialize(child: ChildProcess): Promise<void> {
  const init = await rpc(child, 1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vitest", version: "1.0.0" },
  });
  expect(init["result"]).toBeDefined();
  sendMessage(child, { jsonrpc: "2.0", method: "notifications/initialized" });
}

async function stopServer(child: ChildProcess): Promise<void> {
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
    setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 3000);
  });
}

describe("orders plugin", () => {
  const children: ChildProcess[] = [];
  let mockApi: Awaited<ReturnType<typeof startMockOrdersApi>> | undefined;

  afterEach(async () => {
    await Promise.all(children.splice(0).map((child) => stopServer(child)));
    await mockApi?.close();
    mockApi = undefined;
  });

  it("loads the orders plugin module", async () => {
    const pluginsDir = path.join(process.cwd(), "plugins");
    const mod = await loadPluginModule(pluginsDir, "orders");
    expect(mod?.id).toBe("orders");
    expect(mod?.name).toBe("Orders");
  });

  it("get_order returns data from the orders API", async () => {
    mockApi = await startMockOrdersApi();

    const child = spawn(tsxBin, [tsxEntry], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MCP_MODULES: "meta,orders",
        MCP_PLUGINS_DIR: pluginsDir,
        ORDERS_API_BASE_URL: mockApi.baseUrl,
        ORDERS_API_ALLOWED_HOSTS: "127.0.0.1",
        LOG_LEVEL: "fatal",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.push(child);

    await initialize(child);

    const listed = await rpc(child, 2, "tools/list");
    const tools = (listed["result"] as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["get_order", "list_orders", "cancel_order"]),
    );

    const result = await rpc(child, 3, "tools/call", {
      name: "get_order",
      arguments: { id: "ord_123" },
    });

    const content = (
      result["result"] as {
        content: Array<{ type: string; text: string }>;
      }
    ).content;
    expect(content[0]?.text).toContain("ord_123");
    expect(content[0]?.text).toContain("shipped");
  });

  it("cancel_order is blocked when READ_ONLY=true", async () => {
    mockApi = await startMockOrdersApi();

    const child = spawn(tsxBin, [tsxEntry], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MCP_MODULES: "meta,orders",
        MCP_PLUGINS_DIR: pluginsDir,
        ORDERS_API_BASE_URL: mockApi.baseUrl,
        ORDERS_API_ALLOWED_HOSTS: "127.0.0.1",
        READ_ONLY: "true",
        LOG_LEVEL: "fatal",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.push(child);

    await initialize(child);

    const result = await rpc(child, 4, "tools/call", {
      name: "cancel_order",
      arguments: { id: "ord_123" },
    });

    const payload = result["result"] as { isError?: boolean; content: Array<{ text: string }> };
    expect(payload.isError).toBe(true);
    expect(payload.content[0]?.text).toContain("READ_ONLY");
  });

  it("cancel_order succeeds when READ_ONLY=false", async () => {
    mockApi = await startMockOrdersApi();

    const child = spawn(tsxBin, [tsxEntry], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MCP_MODULES: "meta,orders",
        MCP_PLUGINS_DIR: pluginsDir,
        ORDERS_API_BASE_URL: mockApi.baseUrl,
        ORDERS_API_ALLOWED_HOSTS: "127.0.0.1",
        READ_ONLY: "false",
        LOG_LEVEL: "fatal",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    children.push(child);

    await initialize(child);

    const result = await rpc(child, 5, "tools/call", {
      name: "cancel_order",
      arguments: { id: "ord_123" },
    });

    const payload = result["result"] as { isError?: boolean; content: Array<{ text: string }> };
    expect(payload.isError).not.toBe(true);
    expect(payload.content[0]?.text).toContain("cancelled");
  });
});
