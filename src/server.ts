import { McpServer } from "@modelcontextprotocol/server";
import type { ServerConfig } from "./config.js";
import { configSummary } from "./config.js";
import type { ServerContext } from "./context.js";
import { resolveModules } from "./modules/index.js";
import { registerModules } from "./registry/index.js";
import type { McpModule } from "./registry/types.js";

function modulesToRegister(
  moduleIds: string[],
  readOnly: boolean,
): { active: McpModule[]; skipped: McpModule[] } {
  const modules = resolveModules(moduleIds);
  const active: McpModule[] = [];
  const skipped: McpModule[] = [];

  for (const mod of modules) {
    if (readOnly && mod.readOnly === false) {
      skipped.push(mod);
    } else {
      active.push(mod);
    }
  }

  return { active, skipped };
}

function buildInstructions(
  config: ServerConfig,
  activeModuleIds: string[],
  skippedModuleIds: string[],
): string {
  const lines = [
    "General-purpose MCP server with pluggable modules.",
    "",
    `Enabled modules: ${activeModuleIds.join(", ") || "none"}`,
    `Read-only mode: ${config.readOnly ? "enabled" : "disabled"}`,
  ];

  if (skippedModuleIds.length > 0) {
    lines.push(`Skipped in read-only mode: ${skippedModuleIds.join(", ")}`);
  }

  lines.push(
    "",
    "HTTP tool policy:",
    config.httpAllowedHosts.length > 0
      ? `- Allowed hosts: ${config.httpAllowedHosts.join(", ")}`
      : "- No external hosts allowed (HTTP_TOOL_ALLOWED_HOSTS is empty)",
    "- Never pass secrets in tool arguments; use environment variables instead",
    "",
    "Datetime defaults: ISO 8601 UTC unless a timezone is specified.",
    "Prefer json_parse/json_stringify/json_pick for JSON manipulation.",
    "Resources: mcp://docs/build-plan, mcp://docs/modules/{id}, mcp://config/schema.",
    "Prompts: explore_api, debug_tool_error, design_new_module (when docs module is enabled).",
  );

  return lines.join("\n");
}

export async function createMcpServer(ctx: ServerContext) {
  const { active, skipped } = modulesToRegister(
    ctx.config.modules,
    ctx.config.readOnly,
  );

  const instructions = buildInstructions(
    ctx.config,
    active.map((mod) => mod.id),
    skipped.map((mod) => mod.id),
  );

  const server = new McpServer(
    {
      name: ctx.config.serverName,
      version: ctx.config.serverVersion,
    },
    { instructions },
  );

  const { moduleIds, skippedModuleIds } = await registerModules(
    server,
    ctx,
    ctx.config.modules,
  );

  return {
    server,
    moduleIds,
    skippedModuleIds,
    instructions,
    configSummary: configSummary(ctx.config),
  };
}

export { buildInstructions };
