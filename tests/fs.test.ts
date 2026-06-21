import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSafePath, resolveSafePathSync } from "../src/lib/fs.js";

describe("resolveSafePath", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await mkdir(tempDir, { recursive: true }).catch(() => undefined);
    }
  });

  it("resolves paths under the sandbox root", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-fs-"));
    const resolved = await resolveSafePath(tempDir, "subdir/file.txt");
    expect(resolved.endsWith(`${path.sep}subdir${path.sep}file.txt`)).toBe(true);
  });

  it("blocks path traversal", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-fs-"));
    await expect(resolveSafePath(tempDir, "../outside.txt")).rejects.toThrow(
      "Path traversal denied",
    );
  });

  it("blocks absolute paths outside root", () => {
    tempDir = path.join(os.tmpdir(), "mcp-fs-static");
    expect(() => resolveSafePathSync(tempDir, "/etc/passwd")).toThrow(
      "Path traversal denied",
    );
  });
});

describe("filesystem module paths", () => {
  it("reads files within FS_ROOT", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mcp-fs-read-"));
    await writeFile(path.join(root, "hello.txt"), "hello world", "utf8");
    const resolved = await resolveSafePath(root, "hello.txt");
    expect(resolved.endsWith("hello.txt")).toBe(true);
  });
});
