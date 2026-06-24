import { describe, expect, it, vi } from "vitest";
import type { ChatMessage, OrchestratorEvent } from "@zuupee/chat-orchestrator";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/logger.js";
import type { OrchestratorRunner } from "../src/orchestrator-service.js";
import { SessionStore } from "../src/sessions.js";

function createMockOrchestrator(events: OrchestratorEvent[]): OrchestratorRunner {
  return {
    run: async function* (_messages: ChatMessage[]) {
      for (const event of events) {
        yield event;
      }
    },
    close: vi.fn(async () => undefined),
    getMcpHealth: vi.fn(async () => ({ core: "ok", orders: "ok" })),
  };
}

const baseConfig = {
  port: 3200,
  corsOrigins: ["http://localhost:5173"],
  rateLimitRpm: 100,
  logLevel: "silent" as const,
};

describe("chat-api", () => {
  it("GET /health returns MCP status", async () => {
    const orchestrator = createMockOrchestrator([]);
    const app = createApp({
      orchestrator,
      logger: createLogger("silent"),
      config: baseConfig,
    });

    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: "ok",
      mcp: { core: "ok", orders: "ok" },
    });
  });

  it("POST /chat/sessions creates a session", async () => {
    const app = createApp({
      orchestrator: createMockOrchestrator([]),
      logger: createLogger("silent"),
      config: baseConfig,
    });

    const res = await app.request("/chat/sessions", { method: "POST" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("POST /chat/sessions/:id/messages streams SSE events", async () => {
    const orchestrator = createMockOrchestrator([
      { type: "text_delta", delta: "Hello" },
      { type: "done", message: "Hello" },
    ]);
    const sessions = new SessionStore();
    const app = createApp({
      orchestrator,
      logger: createLogger("silent"),
      config: baseConfig,
      sessionStore: sessions,
    });

    const createRes = await app.request("/chat/sessions", { method: "POST" });
    const { sessionId } = await createRes.json();

    const res = await app.request(`/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hi there" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: text_delta");
    expect(text).toContain('"delta":"Hello"');
    expect(text).toContain("event: done");
    expect(text).toContain('"message":"Hello"');

    const historyRes = await app.request(`/chat/sessions/${sessionId}/messages`);
    const history = await historyRes.json();
    expect(history.messages).toEqual([
      { role: "user", content: "Hi there" },
      { role: "assistant", content: "Hello" },
    ]);
  });

  it("returns 401 when CHAT_API_KEY is set and auth is missing", async () => {
    const app = createApp({
      orchestrator: createMockOrchestrator([]),
      logger: createLogger("silent"),
      config: { ...baseConfig, apiKey: "secret-key" },
    });

    const res = await app.request("/chat/sessions", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const app = createApp({
      orchestrator: createMockOrchestrator([]),
      logger: createLogger("silent"),
      config: { ...baseConfig, rateLimitRpm: 1 },
    });

    const first = await app.request("/chat/sessions", { method: "POST" });
    expect(first.status).toBe(200);

    const second = await app.request("/chat/sessions", { method: "POST" });
    expect(second.status).toBe(429);
  });
});
