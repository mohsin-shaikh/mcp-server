import type { McpServer } from "@modelcontextprotocol/server";
import type { ServerContext } from "../context.js";
import { resolveModules } from "../modules/index.js";
import type { McpModule, RegisteredCapabilities } from "./types.js";

export type { McpModule, RegisteredCapabilities } from "./types.js";

function shouldRegisterModule(mod: McpModule, ctx: ServerContext): boolean {
  if (ctx.config.readOnly && mod.readOnly === false) {
    return false;
  }
  return true;
}

export async function registerModules(
  server: McpServer,
  ctx: ServerContext,
  moduleIds: string[],
): Promise<RegisteredCapabilities> {
  const modules = resolveModules(moduleIds);
  const registered: string[] = [];
  const skipped: string[] = [];

  for (const mod of modules) {
    if (!shouldRegisterModule(mod, ctx)) {
      skipped.push(mod.id);
      ctx.logger.info(
        { moduleId: mod.id, requestId: ctx.requestId },
        "Skipping module in read-only mode",
      );
      continue;
    }

    ctx.logger.info(
      { moduleId: mod.id, requestId: ctx.requestId },
      "Registering module",
    );
    await mod.register(server, ctx);
    registered.push(mod.id);
  }

  return { moduleIds: registered, skippedModuleIds: skipped };
}

export function listModuleIds(modules: McpModule[]): string[] {
  return modules.map((mod) => mod.id);
}
