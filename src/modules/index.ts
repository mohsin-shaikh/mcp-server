import type { McpModule } from "../registry/types.js";
import { datetimeModule } from "./datetime/index.js";
import { docsModule } from "./docs/index.js";
import { filesystemModule } from "./filesystem/index.js";
import { httpModule } from "./http/index.js";
import { jsonModule } from "./json/index.js";
import { metaModule } from "./meta/index.js";

const BUILTIN_MODULES: McpModule[] = [
  metaModule,
  httpModule,
  jsonModule,
  datetimeModule,
  docsModule,
  filesystemModule,
];

const moduleById = new Map(BUILTIN_MODULES.map((mod) => [mod.id, mod]));

/** Built-in modules enabled by MCP_MODULES=* (filesystem is opt-in only). */
const DEFAULT_WILDCARD_MODULES = BUILTIN_MODULES.filter((mod) => mod.id !== "filesystem");

export function getAllBuiltinModules(): McpModule[] {
  return [...DEFAULT_WILDCARD_MODULES];
}

export function resolveModules(moduleIds: string[]): McpModule[] {
  if (moduleIds.includes("*")) {
    return getAllBuiltinModules();
  }

  const resolved: McpModule[] = [];
  for (const id of moduleIds) {
    const mod = moduleById.get(id);
    if (mod) {
      resolved.push(mod);
    }
  }
  return resolved;
}

export { metaModule, httpModule, jsonModule, datetimeModule, docsModule, filesystemModule };
