import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { loadMcpServersConfig, resolveMcpServersConfig } from "@zuupee/mcp-client";
import { ChatOrchestrator, loadOrchestratorConfigFromEnv } from "@zuupee/chat-orchestrator";
import { createApp } from "./app.js";
import { loadChatApiConfig } from "./config.js";
import { loadEnvFiles } from "./load-env.js";
import { createLogger } from "./logger.js";
import { OrchestratorService } from "./orchestrator-service.js";
import { resolveMcpConfigPath } from "./resolve-mcp-config.js";
import { createSessionStore } from "./session-store/index.js";
import { initTelemetry } from "./telemetry.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

loadEnvFiles(repoRoot);

const shutdownTelemetry = await initTelemetry("chat-api");
const apiConfig = loadChatApiConfig();
const logger = createLogger(apiConfig.logLevel);

const mcpConfigPath = resolveMcpConfigPath(repoRoot);
const mcpServers = resolveMcpServersConfig(await loadMcpServersConfig(mcpConfigPath), repoRoot);
const orchestrator = new OrchestratorService(
  new ChatOrchestrator({
    ...loadOrchestratorConfigFromEnv(mcpServers),
    onToolAudit: (entry) => {
      logger.info({ audit: "tool_call", ...entry });
    },
  }),
);

const sessionStore = await createSessionStore({
  redisUrl: apiConfig.redisUrl,
  sessionTtlSeconds: apiConfig.sessionTtlSeconds,
});

const app = createApp({
  orchestrator,
  logger,
  config: apiConfig,
  sessionStore,
});

const server = serve({ fetch: app.fetch, port: apiConfig.port }, (info) => {
  logger.info(
    {
      port: info.port,
      mcpConfigPath,
      sessionStore: apiConfig.redisUrl ? "redis" : "memory",
      otel: process.env["OTEL_ENABLED"] === "true",
    },
    "chat-api listening",
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  await orchestrator.close();
  await sessionStore.close();
  await shutdownTelemetry();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
