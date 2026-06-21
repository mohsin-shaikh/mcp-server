import { loadConfig } from "./config.js";
import { createContext } from "./context.js";
import { createLogger } from "./lib/logger.js";
import { validateTransportAuth } from "./middleware/auth.js";
import { createMcpServer } from "./server.js";
import { startStdioTransport } from "./transport/stdio.js";

export { loadConfig, type ServerConfig } from "./config.js";
export { createContext, type ServerContext } from "./context.js";
export type { McpModule } from "./registry/types.js";
export { registerModules } from "./registry/index.js";

export async function main(): Promise<void> {
  const config = loadConfig();
  validateTransportAuth(config);

  if (config.transport === "http") {
    throw new Error(
      "HTTP transport is not implemented yet. Use MCP_TRANSPORT=stdio.",
    );
  }

  const logger = createLogger(config.logLevel);
  const ctx = createContext(config, logger);

  logger.info(
    {
      requestId: ctx.requestId,
      modules: config.modules,
      readOnly: config.readOnly,
    },
    "Starting MCP server",
  );

  const { server, moduleIds } = await createMcpServer(ctx);

  logger.info(
    { requestId: ctx.requestId, moduleIds },
    "Modules registered",
  );

  await startStdioTransport(server, logger);
}

const isDirectRun =
  process.argv[1]?.includes("index.ts") ||
  process.argv[1]?.includes("index.js");

if (isDirectRun) {
  main().catch((err: unknown) => {
    const logger = createLogger("error");
    logger.error({ err }, "Fatal error starting MCP server");
    process.exit(1);
  });
}
