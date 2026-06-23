import { loadConfig } from "./config.js";
import { createContext } from "./context.js";
import { createLogger } from "./lib/logger.js";
import { validateTransportAuth } from "./middleware/auth.js";
import { createMcpServer } from "./server.js";
import { startHttpTransport } from "./transport/http.js";
import { startStdioTransport } from "./transport/stdio.js";

export { loadConfig, type ServerConfig } from "./config.js";
export { createContext, type ServerContext } from "./context.js";
export type { McpModule } from "./registry/types.js";
export { registerModules } from "./registry/index.js";

async function shutdown(
  logger: ReturnType<typeof createLogger>,
  close?: () => Promise<void>,
): Promise<void> {
  if (close) {
    await close();
  }
  logger.info("Shutdown complete");
}

export async function main(): Promise<void> {
  const config = loadConfig();
  validateTransportAuth(config);

  const logger = createLogger(config.logLevel);
  const ctx = createContext(config, logger);

  logger.info(
    {
      requestId: ctx.requestId,
      transport: config.transport,
      modules: config.modules,
      readOnly: config.readOnly,
    },
    "Starting MCP server",
  );

  const { server, moduleIds } = await createMcpServer(ctx);

  logger.info({ requestId: ctx.requestId, moduleIds }, "Modules registered");

  let closeTransport: (() => Promise<void>) | undefined;

  if (config.transport === "http") {
    const handle = await startHttpTransport(ctx, logger);
    closeTransport = handle.close;
  } else {
    await startStdioTransport(server, logger);
    closeTransport = async () => {
      await server.close();
    };
  }

  const onSignal = (signal: string) => {
    logger.info({ signal, requestId: ctx.requestId }, "Received shutdown signal");
    void shutdown(logger, closeTransport)
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        logger.error({ err }, "Error during shutdown");
        process.exit(1);
      });
  };

  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));
}

const isDirectRun = process.argv[1]?.includes("index.ts") || process.argv[1]?.includes("index.js");

if (isDirectRun) {
  main().catch((err: unknown) => {
    const logger = createLogger("error");
    logger.error({ err }, "Fatal error starting MCP server");
    process.exit(1);
  });
}
