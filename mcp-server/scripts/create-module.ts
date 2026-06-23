#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const moduleId = process.argv[2];

if (!moduleId || moduleId === "--help" || moduleId === "-h") {
  console.error("Usage: pnpm create-module <module-id>");
  process.exit(moduleId ? 0 : 1);
}

if (!/^[a-z][a-z0-9_-]*$/.test(moduleId)) {
  console.error("Module id must be lowercase alphanumeric (hyphens/underscores allowed).");
  process.exit(1);
}

const pluginsDir = process.env["MCP_PLUGINS_DIR"] ?? path.join(process.cwd(), "plugins");
const moduleDir = path.join(pluginsDir, moduleId);
const moduleFile = path.join(moduleDir, "index.ts");

const pascalId = moduleId
  .split(/[-_]/g)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join("");

const contents = `import { z } from "zod";
import type { McpModule } from "../../src/registry/types.js";
import { toolText } from "../../src/lib/result.js";
import { wrapToolHandler } from "../../src/lib/tool.js";

export const ${moduleId.replace(/[-]/g, "_")}Module: McpModule = {
  id: "${moduleId}",
  name: "${pascalId}",
  readOnly: true,
  register(server, ctx) {
    server.registerTool(
      "${moduleId}_hello",
      {
        title: "${pascalId} hello",
        description: "Example tool for the ${moduleId} plugin module.",
        inputSchema: z.object({
          name: z.string().default("world"),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "${moduleId}_hello", async ({ name }) => {
        return toolText(\`Hello from ${moduleId}, \${name}!\`);
      }),
    );
  },
};
`;

await mkdir(moduleDir, { recursive: true });
await writeFile(moduleFile, contents, "utf8");

console.log(`Created plugin module at ${moduleFile}`);
console.log(`Enable with: MCP_MODULES=meta,${moduleId}`);
