import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../context.js";

export interface McpModule {
  /** Unique module id, e.g. "http", "json" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Register tools, resources, prompts on the server */
  register(server: McpServer, ctx: ServerContext): void | Promise<void>;
  /** If false, module is skipped when READ_ONLY=true */
  readOnly?: boolean;
}

export interface RegisteredCapabilities {
  moduleIds: string[];
  skippedModuleIds: string[];
}
