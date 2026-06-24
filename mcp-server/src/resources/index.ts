import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../context.js";
import { readBuildPlan } from "./build-plan.js";
import { getConfigJsonSchema } from "./config-schema.js";
import { getModuleDoc, listModuleDocIds } from "./module-docs.js";

export function registerResources(server: McpServer, ctx: ServerContext): void {
  server.registerResource(
    "build-plan",
    "mcp://docs/build-plan",
    {
      title: "Build plan",
      description: "MCP server build plan and architecture",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const text = await readBuildPlan();
      ctx.logger.debug({ uri: uri.href, requestId: ctx.requestId }, "Read resource");
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
      };
    },
  );

  server.registerResource(
    "config-schema",
    "mcp://config/schema",
    {
      title: "Config schema",
      description: "JSON Schema of server environment configuration",
      mimeType: "application/json",
    },
    async (uri) => {
      const schema = getConfigJsonSchema();
      ctx.logger.debug({ uri: uri.href, requestId: ctx.requestId }, "Read resource");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    },
  );

  const moduleTemplate = new ResourceTemplate("mcp://docs/modules/{id}", {
    list: async () => ({
      resources: listModuleDocIds().map((id) => ({
        uri: `mcp://docs/modules/${id}`,
        name: `${id} module docs`,
        mimeType: "text/markdown",
      })),
    }),
    complete: {
      id: async () => listModuleDocIds(),
    },
  });

  server.registerResource(
    "module-docs",
    moduleTemplate,
    {
      title: "Module docs",
      description: "Per-module usage documentation",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const id = variables["id"];
      if (typeof id !== "string") {
        throw new Error("Module id is required");
      }
      const doc = getModuleDoc(id);
      if (!doc) {
        throw new Error(`Unknown module id: ${id}`);
      }
      ctx.logger.debug({ uri: uri.href, moduleId: id, requestId: ctx.requestId }, "Read resource");
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: doc }],
      };
    },
  );
}

export { getConfigJsonSchema } from "./config-schema.js";
export { getModuleDoc, listModuleDocIds } from "./module-docs.js";
