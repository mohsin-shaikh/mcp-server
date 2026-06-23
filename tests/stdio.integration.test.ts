import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

function sendMessage(
  child: ReturnType<typeof spawn>,
  message: Record<string, unknown>,
): void {
  child.stdin?.write(`${JSON.stringify(message)}\n`);
}

function readJsonLine(buffer: string): {
  line: string | undefined;
  rest: string;
} {
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
  child: ReturnType<typeof spawn>,
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

function spawnServer(modules: string) {
  return spawn("node", ["./dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_MODULES: modules,
      LOG_LEVEL: "fatal",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
}

async function initialize(child: ReturnType<typeof spawn>): Promise<void> {
  const init = await rpc(child, 1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "vitest", version: "1.0.0" },
  });
  expect(init["result"]).toBeDefined();
  sendMessage(child, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
}

describe("stdio integration", () => {
  it("lists built-in tools after initialize", async () => {
    const child = spawnServer("meta,json,datetime,docs");

    try {
      await initialize(child);

      const tools = await rpc(child, 2, "tools/list");
      const toolNames = (
        (tools["result"] as { tools: Array<{ name: string }> }).tools ?? []
      ).map((tool) => tool.name);

      expect(toolNames).toContain("server_info");
      expect(toolNames).toContain("json_parse");
      expect(toolNames).toContain("datetime_now");
    } finally {
      child.kill("SIGTERM");
    }
  });

  it("calls server_info tool", async () => {
    const child = spawnServer("meta,docs");

    try {
      await initialize(child);

      const response = await rpc(child, 2, "tools/call", {
        name: "server_info",
        arguments: {},
      });

      const result = response["result"] as {
        structuredContent?: { name?: string; modules?: string[] };
      };
      expect(result.structuredContent?.name).toBe("mcp-server");
      expect(result.structuredContent?.modules).toContain("meta");
    } finally {
      child.kill("SIGTERM");
    }
  });

  it("lists resources and prompts from docs module", async () => {
    const child = spawnServer("docs");

    try {
      await initialize(child);

      const resources = await rpc(child, 2, "resources/list");
      const uris = (
        (resources["result"] as { resources: Array<{ uri: string }> })
          .resources ?? []
      ).map((resource) => resource.uri);

      expect(uris.some((uri) => uri.includes("build-plan"))).toBe(true);
      expect(uris.some((uri) => uri.includes("config/schema"))).toBe(true);

      const prompts = await rpc(child, 3, "prompts/list");
      const promptNames = (
        (prompts["result"] as { prompts: Array<{ name: string }> }).prompts ??
        []
      ).map((prompt) => prompt.name);

      expect(promptNames).toContain("explore_api");
      expect(promptNames).toContain("debug_tool_error");
      expect(promptNames).toContain("design_new_module");
    } finally {
      child.kill("SIGTERM");
    }
  });
});
