import { dirname, isAbsolute, resolve } from "node:path";
import type { McpServerConfig, McpStdioServerConfig } from "./types.js";

function isStdioConfig(server: McpServerConfig): server is McpStdioServerConfig {
  return server.transport === "stdio";
}

function resolveMcpServerDir(baseDir: string, args: string[]): string {
  const dirIndex = args.indexOf("--dir");
  if (dirIndex !== -1) {
    const dir = args[dirIndex + 1];
    if (dir) {
      return isAbsolute(dir) ? dir : resolve(baseDir, dir);
    }
  }

  const entry = args.find((arg) => !arg.startsWith("-"));
  if (entry) {
    const entryPath = isAbsolute(entry) ? entry : resolve(baseDir, entry);
    return dirname(entryPath);
  }

  return baseDir;
}

/**
 * Resolve stdio spawn paths and plugin dirs relative to a stable base directory
 * (typically the monorepo root), not the caller's process.cwd().
 */
export function resolveMcpServersConfig(
  servers: McpServerConfig[],
  baseDir: string,
): McpServerConfig[] {
  return servers.map((server) => {
    if (!isStdioConfig(server)) {
      return server;
    }

    const args = server.args ? [...server.args] : [];
    const mcpServerDir = resolveMcpServerDir(baseDir, args);

    const dirIndex = args.indexOf("--dir");
    if (dirIndex !== -1) {
      const dir = args[dirIndex + 1];
      if (dir) {
        args[dirIndex + 1] = mcpServerDir;
      }
    } else {
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg || arg.startsWith("-")) {
          continue;
        }
        args[i] = isAbsolute(arg) ? arg : resolve(baseDir, arg);
        break;
      }
    }

    const env = server.env ? { ...server.env } : undefined;
    if (env?.["MCP_PLUGINS_DIR"] && !isAbsolute(env["MCP_PLUGINS_DIR"])) {
      env["MCP_PLUGINS_DIR"] = resolve(mcpServerDir, env["MCP_PLUGINS_DIR"]);
    }

    return {
      ...server,
      args,
      ...(env ? { env } : {}),
    };
  });
}
