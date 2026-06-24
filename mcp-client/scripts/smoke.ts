import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMcpServersConfig, McpConnectionManager, McpToolRegistry } from "../src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultConfigPath = resolve(repoRoot, "config/mcp-servers.dev.json");

async function main(): Promise<void> {
  const configPath = process.env["MCP_SERVERS_CONFIG"] ?? defaultConfigPath;
  const servers = await loadMcpServersConfig(configPath);

  const manager = new McpConnectionManager(servers);
  await manager.connect();

  try {
    const registry = new McpToolRegistry(manager);
    await registry.refresh();

    const tools = registry.listTools();
    console.log(`Connected to ${servers.length} MCP server(s)`);
    console.log(`Discovered ${tools.length} tool(s):`);
    for (const tool of tools) {
      console.log(`  - ${tool.namespacedName}: ${tool.description ?? "(no description)"}`);
    }

    const instructions = registry.getServerInstructions();
    if (instructions) {
      console.log("\nServer instructions:\n");
      console.log(instructions);
    }

    const health = await manager.healthCheck();
    console.log("\nHealth:", health);
  } finally {
    await manager.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
