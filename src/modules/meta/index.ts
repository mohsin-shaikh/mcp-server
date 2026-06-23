import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { toolJson } from "../../lib/result.js";
import { wrapToolHandler } from "../../lib/tool.js";
import { resolveModules } from "../index.js";

export const metaModule: McpModule = {
  id: "meta",
  name: "Meta",
  readOnly: true,
  register(server, ctx) {
    server.registerTool(
      "server_info",
      {
        title: "Server info",
        description:
          "Returns server name, version, enabled modules, and config summary.",
        inputSchema: z.object({}),
        annotations: {
          readOnlyHint: true,
        },
      },
      wrapToolHandler(ctx, "server_info", async () => {
        const modules = resolveModules(ctx.config.modules);
        const active: string[] = [];
        const skipped: string[] = [];

        for (const mod of modules) {
          if (ctx.config.readOnly && mod.readOnly === false) {
            skipped.push(mod.id);
          } else {
            active.push(mod.id);
          }
        }

        return toolJson({
          name: ctx.config.serverName,
          version: ctx.config.serverVersion,
          modules: active,
          skippedModules: skipped,
          readOnly: ctx.config.readOnly,
          transport: ctx.config.transport,
          config: {
            httpAllowedHosts: ctx.config.httpAllowedHosts,
            httpMaxBytes: ctx.config.httpMaxBytes,
            httpTimeoutMs: ctx.config.httpTimeoutMs,
            authMode: ctx.config.authMode,
            fsRootConfigured: Boolean(ctx.config.fsRoot),
            fsMaxReadBytes: ctx.config.fsMaxReadBytes,
          },
        });
      }),
    );
  },
};
