import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become healthy on port ${port}`);
}

function spawnHttpServer(port: number, extraEnv: Record<string, string> = {}) {
  return spawn("node", ["./dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TRANSPORT: "http",
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_ALLOWED_HOSTS: "127.0.0.1,localhost",
      MCP_MODULES: "meta",
      LOG_LEVEL: "fatal",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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

function mcpHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

describe("HTTP transport integration", () => {
  const children: ChildProcess[] = [];

  afterEach(async () => {
    await Promise.all(children.splice(0).map((child) => stopServer(child)));
  });

  it("serves health check", async () => {
    const port = randomPort();
    const child = spawnHttpServer(port);
    children.push(child);

    await waitForHealth(port);
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = (await res.json()) as { status: string; transport: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.transport).toBe("http");
  });

  it("handles MCP initialize without auth when MCP_AUTH_MODE=none", async () => {
    const port = randomPort();
    const child = spawnHttpServer(port, { MCP_AUTH_MODE: "none" });
    children.push(child);

    await waitForHealth(port);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-session-id")).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("mcp-server");
  });

  it("rejects requests without API key when auth is enabled", async () => {
    const port = randomPort();
    const child = spawnHttpServer(port, {
      MCP_AUTH_MODE: "api_key",
      MCP_API_KEY: "test-secret",
    });
    children.push(child);

    await waitForHealth(port);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
    });

    expect(res.status).toBe(401);
  });
});
