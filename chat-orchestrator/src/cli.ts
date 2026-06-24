import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMcpServersConfig, resolveMcpServersConfig } from "@zuupee/mcp-client";
import { parseCliArgs } from "./cli-args.js";
import { loadEnvFiles } from "./load-env.js";
import { ChatOrchestrator, loadOrchestratorConfigFromEnv } from "./orchestrator.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultMcpConfig = resolve(repoRoot, "config/mcp-servers.chat.example.json");

function warnIfOrdersMissing(
  mcpConfigPath: string,
  serverIds: string[],
  userMessage: string,
): void {
  if (serverIds.includes("orders")) {
    return;
  }

  if (!/\bord(?:er)?[_\s-]?\d+/i.test(userMessage) && !/\border\b/i.test(userMessage)) {
    return;
  }

  console.error(
    `Warning: MCP config "${mcpConfigPath}" has no "orders" server — order tools are unavailable.`,
  );
  console.error(`Set MCP_SERVERS_CONFIG=./config/mcp-servers.chat.example.json in .env.local`);
  console.error("And run `pnpm dev:mock-orders` in another terminal.\n");
}

async function main(): Promise<void> {
  loadEnvFiles(repoRoot);

  const { message: userMessage, verbose } = parseCliArgs(process.argv);
  if (!userMessage) {
    console.error('Usage: pnpm dev:orchestrator -- "Your question here" [--verbose]');
    process.exit(1);
  }

  const rawMcpConfig = process.env["MCP_SERVERS_CONFIG"] ?? defaultMcpConfig;
  const mcpConfigPath = isAbsolute(rawMcpConfig) ? rawMcpConfig : resolve(repoRoot, rawMcpConfig);
  const mcpServers = resolveMcpServersConfig(await loadMcpServersConfig(mcpConfigPath), repoRoot);
  const config = loadOrchestratorConfigFromEnv(mcpServers);

  if (verbose) {
    console.error(`MCP config: ${mcpConfigPath}`);
    console.error(`MCP servers: ${mcpServers.map((server) => server.id).join(", ")}`);
    console.error("Ensure `pnpm dev:mock-orders` is running for orders tools.\n");
  }

  warnIfOrdersMissing(
    mcpConfigPath,
    mcpServers.map((server) => server.id),
    userMessage,
  );

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
          console.log(`[tool done] ${event.name} ${event.isError ? "(error)" : "(ok)"}`);
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
