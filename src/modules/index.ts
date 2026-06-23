import type { McpModule } from "../registry/types.js";
import { loadPluginModules } from "../plugins/loader.js";
import { datetimeModule } from "./datetime/index.js";
import { docsModule } from "./docs/index.js";
import { filesystemModule } from "./filesystem/index.js";
import { httpModule } from "./http/index.js";
import { jsonModule } from "./json/index.js";
import { metaModule } from "./meta/index.js";
import { openapiModule } from "./openapi/index.js";

const BUILTIN_MODULES: McpModule[] = [
  metaModule,
  httpModule,
  jsonModule,
  datetimeModule,
  docsModule,
  filesystemModule,
  openapiModule,
];

const BUILTIN_MODULE_IDS = new Set(BUILTIN_MODULES.map((mod) => mod.id));

const moduleById = new Map(BUILTIN_MODULES.map((mod) => [mod.id, mod]));

let pluginModules = new Map<string, McpModule>();

/** Built-in modules enabled by MCP_MODULES=* (opt-in modules excluded). */
const DEFAULT_WILDCARD_MODULES = BUILTIN_MODULES.filter(
  (mod) => mod.id !== "filesystem" && mod.id !== "openapi",
);

export function getAllBuiltinModules(): McpModule[] {
  return [...DEFAULT_WILDCARD_MODULES];
}

export function getBuiltinModuleIds(): Set<string> {
  return new Set(BUILTIN_MODULE_IDS);
}

export async function loadPluginsForConfig(pluginsDir: string, moduleIds: string[]): Promise<void> {
  pluginModules = await loadPluginModules(pluginsDir, moduleIds, BUILTIN_MODULE_IDS);
}

export function getLoadedPluginIds(): string[] {
  return [...pluginModules.keys()];
}

export function clearPluginModules(): void {
  pluginModules = new Map();
}

export function resolveModules(moduleIds: string[]): McpModule[] {
  if (moduleIds.includes("*")) {
    return getAllBuiltinModules();
  }

  const resolved: McpModule[] = [];
  for (const id of moduleIds) {
    const builtin = moduleById.get(id);
    if (builtin) {
      resolved.push(builtin);
      continue;
    }

    const plugin = pluginModules.get(id);
    if (plugin) {
      resolved.push(plugin);
    }
  }
  return resolved;
}

export {
  metaModule,
  httpModule,
  jsonModule,
  datetimeModule,
  docsModule,
  filesystemModule,
  openapiModule,
};
