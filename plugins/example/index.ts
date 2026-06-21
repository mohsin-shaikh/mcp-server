import type { McpModule } from "../../src/registry/types.js";

/**
 * Example custom module — copy to plugins/my-service/index.ts and add to MCP_MODULES.
 */
export const exampleModule: McpModule = {
  id: "example",
  name: "Example",
  readOnly: true,
  register(server, ctx) {
    void ctx;
    void server;
    // Register tools here, e.g.:
    // server.registerTool("example_hello", { ... }, async () => toolText("Hello"));
  },
};
