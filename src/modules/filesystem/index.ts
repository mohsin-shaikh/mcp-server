import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { resolveSafePath } from "../../lib/fs.js";
import { truncate } from "../../lib/format.js";
import { toolError, toolJson, toolText } from "../../lib/result.js";
import { wrapToolHandler } from "../../lib/tool.js";

async function listEntries(
  dirPath: string,
  recursive: boolean,
): Promise<Array<{ name: string; type: "file" | "directory"; path: string }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const result: Array<{ name: string; type: "file" | "directory"; path: string }> = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    const relativePath = entryPath;
    result.push({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
      path: relativePath,
    });

    if (recursive && entry.isDirectory()) {
      result.push(...(await listEntries(entryPath, true)));
    }
  }

  return result;
}

async function searchFiles(
  dirPath: string,
  pattern: string,
  fsRoot: string,
): Promise<string[]> {
  const regex = new RegExp(
    pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"),
    "i",
  );
  const matches: string[] = [];
  const entries = await listEntries(dirPath, true);

  for (const entry of entries) {
    if (entry.type !== "file") {
      continue;
    }
    if (regex.test(entry.name)) {
      matches.push(path.relative(fsRoot, entry.path));
    }
  }

  return matches;
}

export const filesystemModule: McpModule = {
  id: "filesystem",
  name: "Filesystem",
  readOnly: true,
  register(server, ctx) {
    const fsRoot = ctx.config.fsRoot;
    if (!fsRoot) {
      ctx.logger.warn(
        { moduleId: "filesystem", requestId: ctx.requestId },
        "FS_ROOT not set; filesystem tools will return errors",
      );
    }

    server.registerTool(
      "read_file",
      {
        title: "Read file",
        description: "Read a file under FS_ROOT. Path traversal is blocked.",
        inputSchema: z.object({
          path: z.string().describe("Relative path under FS_ROOT"),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "read_file", async ({ path: filePath }) => {
        if (!fsRoot) {
          return toolError("FS_ROOT is not configured");
        }
        const resolved = await resolveSafePath(fsRoot, filePath);
        const info = await stat(resolved);
        if (!info.isFile()) {
          return toolError("Path is not a file");
        }
        const content = await readFile(resolved, "utf8");
        return toolText(truncate(content, ctx.config.fsMaxReadBytes));
      }),
    );

    server.registerTool(
      "list_dir",
      {
        title: "List directory",
        description: "List entries in a directory under FS_ROOT.",
        inputSchema: z.object({
          path: z.string().default(".").describe("Relative directory under FS_ROOT"),
          recursive: z.boolean().default(false),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "list_dir", async ({ path: dirPath, recursive }) => {
        if (!fsRoot) {
          return toolError("FS_ROOT is not configured");
        }
        const resolved = await resolveSafePath(fsRoot, dirPath);
        const info = await stat(resolved);
        if (!info.isDirectory()) {
          return toolError("Path is not a directory");
        }
        const root = path.resolve(fsRoot);
        const entries = await listEntries(resolved, recursive);
        const relative = entries.map((entry) => ({
          ...entry,
          path: path.relative(root, entry.path),
        }));
        return toolJson({ entries: relative });
      }),
    );

    server.registerTool(
      "search_files",
      {
        title: "Search files",
        description:
          "Find files by glob-like name pattern under FS_ROOT (e.g. *.ts, test_*).",
        inputSchema: z.object({
          pattern: z.string().describe("Filename pattern (* and ? supported as wildcards)"),
          path: z.string().default(".").describe("Directory to search under FS_ROOT"),
        }),
        annotations: { readOnlyHint: true },
      },
      wrapToolHandler(ctx, "search_files", async ({ pattern, path: searchPath }) => {
        if (!fsRoot) {
          return toolError("FS_ROOT is not configured");
        }
        const resolved = await resolveSafePath(fsRoot, searchPath);
        const info = await stat(resolved);
        if (!info.isDirectory()) {
          return toolError("Path is not a directory");
        }
        const root = path.resolve(fsRoot);
        const matches = await searchFiles(resolved, pattern, root);
        return toolJson({ matches });
      }),
    );
  },
};
