import { z } from "zod";
import type { McpModule } from "../../src/registry/types.js";
import { toolText } from "../../src/lib/result.js";
import { wrapToolHandler } from "../../src/lib/tool.js";

export const exampleModule: McpModule = {
  id: "example",
  name: "Example",
  readOnly: true,
  register(server, ctx) {
    server.registerTool(
      "example_hello",
      {
        title: "Example hello",
        description: "Demonstrates a local plugin module.",
        inputSchema: z.object({
          name: z.string().default("world"),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "example_hello", async ({ name }) => {
        return toolText(`Hello from example plugin, ${name}!`);
      }),
    );
  },
};
