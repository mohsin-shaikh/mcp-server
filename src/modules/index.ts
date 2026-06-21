import type { McpModule } from "../registry/types.js";
import { datetimeModule } from "./datetime/index.js";
import { httpModule } from "./http/index.js";
import { jsonModule } from "./json/index.js";
import { metaModule } from "./meta/index.js";

const BUILTIN_MODULES: McpModule[] = [
  metaModule,
  httpModule,
  jsonModule,
  datetimeModule,
];

const moduleById = new Map(BUILTIN_MODULES.map((mod) => [mod.id, mod]));

export function getAllBuiltinModules(): McpModule[] {
  return [...BUILTIN_MODULES];
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

export { metaModule, httpModule, jsonModule, datetimeModule };
