import { isAbsolute, resolve } from "node:path";

const CONFIG_BY_ENV: Record<string, string> = {
  production: "config/mcp-servers.prod.json",
  staging: "config/mcp-servers.staging.json",
  development: "config/mcp-servers.chat.example.json",
};

export function resolveMcpConfigPath(repoRoot: string): string {
  const explicit = process.env["MCP_SERVERS_CONFIG"];
  if (explicit) {
    return isAbsolute(explicit) ? explicit : resolve(repoRoot, explicit);
  }

  const env = process.env["CHAT_ENV"] ?? process.env["NODE_ENV"] ?? "development";
  const relativePath = CONFIG_BY_ENV[env] ?? CONFIG_BY_ENV["development"];
  return resolve(repoRoot, relativePath!);
}
