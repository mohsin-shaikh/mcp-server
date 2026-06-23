import { randomUUID } from "node:crypto";
import { serve, type ServerType } from "@hono/node-server";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import {
  isInitializeRequest,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { cors } from "hono/cors";
import type { Logger } from "../lib/logger.js";
import { createHttpAuthMiddleware } from "../middleware/http-auth.js";
import { createMcpServer } from "../server.js";
import type { ServerContext } from "../context.js";

interface HttpSession {
  transport: WebStandardStreamableHTTPServerTransport;
  server: McpServer;
}

export interface HttpServerHandle {
  close: () => Promise<void>;
}

function getParsedBody(c: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (key: string) => any;
}): unknown {
  return c.get("parsedBody");
}

async function closeSession(
  sessions: Map<string, HttpSession>,
  sessionId: string,
  logger: Logger,
): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  try {
    await session.transport.close();
    await session.server.close();
  } catch (err) {
    logger.warn({ err, sessionId }, "Error closing HTTP session");
  }
}

async function createHttpSession(
  ctx: ServerContext,
  sessions: Map<string, HttpSession>,
  logger: Logger,
): Promise<HttpSession> {
  const { server } = await createMcpServer(ctx);
  const sessionRef: { current?: HttpSession } = {};

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      if (sessionRef.current) {
        sessions.set(sessionId, sessionRef.current);
        logger.info({ sessionId, requestId: ctx.requestId }, "HTTP session initialized");
      }
    },
    onsessionclosed: (sessionId) => {
      void closeSession(sessions, sessionId, logger);
    },
  });

  const session: HttpSession = { transport, server };
  sessionRef.current = session;
  await server.connect(transport);

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      void closeSession(sessions, sessionId, logger);
    }
  };

  return session;
}

export async function startHttpTransport(
  ctx: ServerContext,
  logger: Logger,
): Promise<HttpServerHandle> {
  const config = ctx.config;
  const sessions = new Map<string, HttpSession>();

  const app = createMcpHonoApp({
    host: config.httpBindHost,
    ...(config.httpHostAllowlist.length > 0 ? { allowedHosts: config.httpHostAllowlist } : {}),
  });

  if (config.corsOrigins.length > 0) {
    app.use(
      "*",
      cors({
        origin: config.corsOrigins,
        exposeHeaders: ["Mcp-Session-Id", "Last-Event-Id", "Mcp-Protocol-Version"],
      }),
    );
  }

  app.use("*", createHttpAuthMiddleware(config));

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      server: config.serverName,
      version: config.serverVersion,
      transport: "http",
      sessions: sessions.size,
    }),
  );

  app.all(config.httpPath, async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    const parsedBody = getParsedBody(c);

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return c.json(
          {
            jsonrpc: "2.0",
            error: { code: -32_001, message: "Session not found" },
            id: null,
          },
          404,
        );
      }
      return session.transport.handleRequest(c.req.raw, { parsedBody });
    }

    if (isInitializeRequest(parsedBody)) {
      const session = await createHttpSession(ctx, sessions, logger);
      return session.transport.handleRequest(c.req.raw, { parsedBody });
    }

    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32_000, message: "Bad Request: Session ID required" },
        id: null,
      },
      400,
    );
  });

  let httpServer: ServerType | undefined;

  await new Promise<void>((resolve, reject) => {
    try {
      httpServer = serve(
        {
          fetch: app.fetch,
          port: config.httpPort,
          hostname: config.httpBindHost,
        },
        (info) => {
          logger.info(
            {
              requestId: ctx.requestId,
              port: info.port,
              host: config.httpBindHost,
              path: config.httpPath,
              authMode: config.authMode,
            },
            "HTTP transport listening",
          );
          resolve();
        },
      );
    } catch (err) {
      reject(err);
    }
  });

  const close = async (): Promise<void> => {
    logger.info({ requestId: ctx.requestId }, "Shutting down HTTP transport");

    const sessionIds = [...sessions.keys()];
    await Promise.all(sessionIds.map((sessionId) => closeSession(sessions, sessionId, logger)));

    await new Promise<void>((resolve, reject) => {
      if (!httpServer) {
        resolve();
        return;
      }
      httpServer.close((err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        logger.info({ requestId: ctx.requestId }, "HTTP server closed");
        resolve();
      });
    });
  };

  return { close };
}
