import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { loadMcpServersConfig, resolveMcpServersConfig } from "@zuupee/mcp-client";
import { ChatOrchestrator, loadOrchestratorConfigFromEnv } from "@zuupee/chat-orchestrator";
import { createApp } from "./app.js";
import { loadChatApiConfig } from "./config.js";
import { loadEnvFiles } from "./load-env.js";
import { createLogger } from "./logger.js";
import { OrchestratorService } from "./orchestrator-service.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultMcpConfig = resolve(repoRoot, "config/mcp-servers.chat.example.json");

loadEnvFiles(repoRoot);

const apiConfig = loadChatApiConfig();
const logger = createLogger(apiConfig.logLevel);

const rawMcpConfig = process.env["MCP_SERVERS_CONFIG"] ?? defaultMcpConfig;
const mcpConfigPath = isAbsolute(rawMcpConfig) ? rawMcpConfig : resolve(repoRoot, rawMcpConfig);

const mcpServers = resolveMcpServersConfig(await loadMcpServersConfig(mcpConfigPath), repoRoot);
const orchestrator = new OrchestratorService(
  new ChatOrchestrator(loadOrchestratorConfigFromEnv(mcpServers)),
);

const app = createApp({
  orchestrator,
  logger,
  config: apiConfig,
});

const server = serve({ fetch: app.fetch, port: apiConfig.port }, (info) => {
  logger.info({ port: info.port, mcpConfigPath }, "chat-api listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  await orchestrator.close();
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
