import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { McpModule } from "../registry/types.js";

function isMcpModule(value: unknown): value is McpModule {
  if (!value || typeof value !== "object") {
    return false;
  }
  const mod = value as McpModule;
  return (
    typeof mod.id === "string" && typeof mod.name === "string" && typeof mod.register === "function"
  );
}

function extractModuleExport(
  moduleId: string,
  loaded: Record<string, unknown>,
): McpModule | undefined {
  const named = loaded[`${moduleId}Module`];
  if (isMcpModule(named)) {
    return named;
  }

  if (isMcpModule(loaded["default"])) {
    return loaded["default"];
  }

  for (const value of Object.values(loaded)) {
    if (isMcpModule(value)) {
      return value;
    }
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePluginEntry(
  pluginsDir: string,
  moduleId: string,
): Promise<string | undefined> {
  const candidates = [
    path.join(pluginsDir, moduleId, "index.ts"),
    path.join(pluginsDir, moduleId, "index.js"),
    path.join(pluginsDir, moduleId, "index.mjs"),
    path.join(pluginsDir, `${moduleId}.ts`),
    path.join(pluginsDir, `${moduleId}.js`),
    path.join(pluginsDir, `${moduleId}.mjs`),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function loadPluginModule(
  pluginsDir: string,
  moduleId: string,
): Promise<McpModule | undefined> {
  const entry = await resolvePluginEntry(pluginsDir, moduleId);
  if (!entry) {
    return undefined;
  }

  const loaded = (await import(pathToFileURL(entry).href)) as Record<string, unknown>;
  const mod = extractModuleExport(moduleId, loaded);
  if (!mod) {
    throw new Error(`Plugin ${moduleId} does not export an McpModule`);
  }
  if (mod.id !== moduleId) {
    throw new Error(`Plugin ${moduleId} exports module id "${mod.id}" (expected "${moduleId}")`);
  }

  return mod;
}

export async function loadPluginModules(
  pluginsDir: string,
  moduleIds: string[],
  builtinIds: Set<string>,
): Promise<Map<string, McpModule>> {
  const plugins = new Map<string, McpModule>();

  for (const moduleId of moduleIds) {
    if (moduleId === "*" || builtinIds.has(moduleId)) {
      continue;
    }

    const mod = await loadPluginModule(pluginsDir, moduleId);
    if (mod) {
      plugins.set(moduleId, mod);
    }
  }

  return plugins;
}
