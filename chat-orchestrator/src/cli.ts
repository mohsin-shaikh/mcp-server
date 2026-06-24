import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMcpServersConfig } from "@zuupee/mcp-client";
import { ChatOrchestrator, loadOrchestratorConfigFromEnv } from "./orchestrator.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultMcpConfig = resolve(repoRoot, "config/mcp-servers.dev.json");

async function main(): Promise<void> {
  const userMessage = process.argv.slice(2).join(" ").trim();
  if (!userMessage) {
    console.error('Usage: pnpm -C chat-orchestrator dev -- "Your question here"');
    process.exit(1);
  }

  const mcpConfigPath = process.env["MCP_SERVERS_CONFIG"] ?? defaultMcpConfig;
  const mcpServers = await loadMcpServersConfig(mcpConfigPath);
  const config = loadOrchestratorConfigFromEnv(mcpServers);

  const orchestrator = new ChatOrchestrator(config);

  try {
    console.log(`> ${userMessage}\n`);

    for await (const event of orchestrator.run([{ role: "user", content: userMessage }])) {
      switch (event.type) {
        case "text_delta":
          process.stdout.write(event.delta);
          break;
        case "tool_start":
          console.log(`\n[tool] ${event.name}(${JSON.stringify(event.args)})`);
          break;
        case "tool_end":
          console.log(
            `[tool done] ${event.name} ${event.isError ? "(error)" : "(ok)"}`,
          );
          break;
        case "done":
          if (!event.message.endsWith("\n")) {
            process.stdout.write("\n");
          }
          break;
        case "error":
          console.error(`\nError: ${event.message}`);
          process.exitCode = 1;
          break;
      }
    }
  } finally {
    await orchestrator.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
