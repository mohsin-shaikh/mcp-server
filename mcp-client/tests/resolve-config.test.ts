import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMcpServersConfig } from "../src/resolve-config.js";

describe("resolveMcpServersConfig", () => {
  it("resolves pnpm --dir relative to baseDir", () => {
    const baseDir = "/repo";
    const [server] = resolveMcpServersConfig(
      [
        {
          id: "orders",
          transport: "stdio",
          command: "pnpm",
          args: ["--dir", "mcp-server", "exec", "tsx", "src/index.ts"],
          env: { MCP_PLUGINS_DIR: "./plugins" },
        },
      ],
      baseDir,
    );

    expect(server).toMatchObject({
      args: ["--dir", "/repo/mcp-server", "exec", "tsx", "src/index.ts"],
      env: { MCP_PLUGINS_DIR: "/repo/mcp-server/plugins" },
    });
  });

  it("resolves node entry script relative to baseDir", () => {
    const baseDir = resolve("/repo");
    const [server] = resolveMcpServersConfig(
      [
        {
          id: "core",
          transport: "stdio",
          command: "node",
          args: ["mcp-server/dist/index.js"],
        },
      ],
      baseDir,
    );

    expect(server?.args?.[0]).toBe(resolve("/repo/mcp-server/dist/index.js"));
  });
});
