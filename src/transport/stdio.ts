import { StdioServerTransport } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Logger } from "../lib/logger.js";

export async function startStdioTransport(
  server: McpServer,
  logger: Logger,
): Promise<void> {
  const transport = new StdioServerTransport();
  logger.info("Starting stdio transport");
  await server.connect(transport);
}
