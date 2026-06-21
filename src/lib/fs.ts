import { realpath } from "node:fs/promises";
import path from "node:path";
import { McpToolError } from "./errors.js";

export async function resolveSafePath(
  fsRoot: string,
  userPath: string,
): Promise<string> {
  const root = path.resolve(await realpath(fsRoot));
  const resolved = path.resolve(root, userPath);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new McpToolError("Path traversal denied");
  }

  return resolved;
}

export function resolveSafePathSync(fsRoot: string, userPath: string): string {
  const root = path.resolve(fsRoot);
  const resolved = path.resolve(root, userPath);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new McpToolError("Path traversal denied");
  }

  return resolved;
}
