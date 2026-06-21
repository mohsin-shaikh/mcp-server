import type { McpModule } from "../../registry/types.js";
import { registerPrompts } from "../../prompts/index.js";
import { registerResources } from "../../resources/index.js";

export const docsModule: McpModule = {
  id: "docs",
  name: "Docs",
  readOnly: true,
  register(server, ctx) {
    registerResources(server, ctx);
    registerPrompts(server, ctx);
  },
};
