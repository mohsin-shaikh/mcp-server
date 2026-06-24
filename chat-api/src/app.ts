import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { OrchestratorEvent } from "@zuupee/chat-orchestrator";
import type { ChatApiConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import type { OrchestratorRunner } from "./orchestrator-service.js";
import { SessionStore } from "./sessions.js";

export type CreateAppDeps = {
  orchestrator: OrchestratorRunner;
  logger: Logger;
  config: ChatApiConfig;
  sessionStore?: SessionStore;
};

function orchestratorEventData(event: OrchestratorEvent): Record<string, unknown> {
  switch (event.type) {
    case "text_delta":
      return { delta: event.delta };
    case "tool_start":
      return { name: event.name, args: event.args };
    case "tool_end":
      return { name: event.name, isError: event.isError };
    case "done":
      return { message: event.message };
    case "error":
      return { message: event.message };
  }
}

export function createApp(deps: CreateAppDeps): Hono {
  const { orchestrator, logger, config } = deps;
  const sessions = deps.sessionStore ?? new SessionStore();
  const rateLimiter = createRateLimiter(config.rateLimitRpm);
  const auth = createAuthMiddleware(config.apiKey);

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) {
          return "*";
        }
        return config.corsOrigins.includes(origin) ? origin : null;
      },
    }),
  );

  app.get("/health", async (c) => {
    try {
      const mcp = await orchestrator.getMcpHealth();
      return c.json({
        status: "ok",
        mcp,
      });
    } catch (err) {
      logger.error({ err }, "health check failed");
      return c.json(
        {
          status: "degraded",
          mcp: {},
          error: err instanceof Error ? err.message : "Health check failed",
        },
        503,
      );
    }
  });

  app.use("/chat/*", auth);
  app.use("/chat/*", rateLimiter);

  app.post("/chat/sessions", async (c) => {
    const body: { userId?: string } = await c.req.json().catch(() => ({}));
    const session = sessions.create(body.userId);
    logger.info({ sessionId: session.id }, "session created");
    return c.json({ sessionId: session.id });
  });

  app.get("/chat/sessions/:id/messages", (c) => {
    const session = sessions.get(c.req.param("id"));
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    return c.json({ messages: session.messages });
  });

  app.post("/chat/sessions/:id/messages", async (c) => {
    const sessionId = c.req.param("id");
    const session = sessions.get(sessionId);
    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const body = await c.req.json<{ content?: string }>();
    const content = body.content?.trim();
    if (!content) {
      return c.json({ error: "content is required" }, 400);
    }

    return streamSSE(c, async (stream) => {
      await sessions.withSessionLock(sessionId, async () => {
        sessions.addMessage(sessionId, { role: "user", content });
        const history = [...session.messages];

        logger.info({ sessionId }, "message started");

        try {
          for await (const event of orchestrator.run(history)) {
            await stream.writeSSE({
              event: event.type,
              data: JSON.stringify(orchestratorEventData(event)),
            });

            if (event.type === "done") {
              sessions.addMessage(sessionId, { role: "assistant", content: event.message });
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stream failed";
          logger.error({ err, sessionId }, "message stream failed");
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message }),
          });
        }

        logger.info({ sessionId }, "message finished");
      });
    });
  });

  return app;
}
