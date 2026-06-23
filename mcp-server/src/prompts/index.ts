import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../context.js";

export function registerPrompts(server: McpServer, ctx: ServerContext): void {
  void ctx;
  server.registerPrompt(
    "explore_api",
    {
      title: "Explore API",
      description: "Template for discovering and calling an unknown REST API safely",
      argsSchema: z.object({
        baseUrl: z.string().url().describe("API base URL"),
        goal: z.string().describe("What you want to accomplish with this API"),
      }),
    },
    ({ baseUrl, goal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Explore the REST API at ${baseUrl} to: ${goal}`,
              "",
              "Follow this checklist:",
              "1. Confirm the host is in HTTP_TOOL_ALLOWED_HOSTS before calling http_fetch",
              "2. Start with GET requests to discover endpoints (OpenAPI doc, /health, /version)",
              "3. Never pass secrets in tool arguments — use environment variables",
              "4. Use json_parse/json_pick to inspect responses",
              "5. Respect rate limits; back off on 429 responses",
              "6. Prefer read-only methods until you understand side effects",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "debug_tool_error",
    {
      title: "Debug tool error",
      description: "Structured checklist when a tool call fails",
      argsSchema: z.object({
        toolName: z.string().describe("Name of the tool that failed"),
        errorMessage: z.string().describe("Error message returned by the tool"),
      }),
    },
    ({ toolName, errorMessage }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Tool "${toolName}" failed with: ${errorMessage}`,
              "",
              "Debug checklist:",
              "1. Verify tool input matches the schema (types, required fields)",
              "2. Check READ_ONLY mode — mutating tools are disabled when enabled",
              "3. For http_fetch: confirm host is in HTTP_TOOL_ALLOWED_HOSTS",
              "4. For filesystem tools: confirm path is under FS_ROOT",
              "5. Call server_info to inspect active modules and config",
              "6. Read mcp://config/schema for available environment variables",
              "7. Retry with smaller input or shorter timeout if request timed out",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "design_new_module",
    {
      title: "Design new module",
      description: "Guide for adding a new McpModule to the server",
      argsSchema: z.object({
        moduleId: z.string().describe("Proposed module id"),
        purpose: z.string().describe("What the module should do"),
      }),
    },
    ({ moduleId, purpose }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Design a new McpModule "${moduleId}" for: ${purpose}`,
              "",
              "Implementation guide:",
              "1. Create plugins/${moduleId}/index.ts implementing McpModule",
              "2. Define id, name, readOnly (false if any tool mutates state)",
              "3. Register tools with Zod inputSchema via server.registerTool",
              "4. Use ctx.secrets.require() for credentials — never tool input",
              "5. Use ctx.http.fetch for upstream calls; wrap responses with truncate()",
              "6. Use wrapToolHandler() for audit logging and read-only gating",
              "7. Add module docs to src/resources/module-docs.ts",
              "8. Enable with MCP_MODULES=meta,http,${moduleId}",
              "",
              "Read mcp://docs/build-plan Appendix A for a full example.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
