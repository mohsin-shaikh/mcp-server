import { describe, expect, it } from "vitest";
import {
  healthUrlFromMcpUrl,
  namespaceTool,
  parseNamespacedTool,
} from "../src/namespace.js";

describe("namespaceTool", () => {
  it("joins server id and tool name", () => {
    expect(namespaceTool("core", "server_info")).toBe("core__server_info");
  });
});

describe("parseNamespacedTool", () => {
  it("splits a namespaced tool name", () => {
    expect(parseNamespacedTool("orders__get_order")).toEqual({
      serverId: "orders",
      toolName: "get_order",
    });
  });

  it("rejects invalid names", () => {
    expect(() => parseNamespacedTool("invalid")).toThrow(/serverId__toolName/);
    expect(() => parseNamespacedTool("__tool")).toThrow(/serverId__toolName/);
  });
});

describe("healthUrlFromMcpUrl", () => {
  it("replaces the MCP path with /health", () => {
    expect(healthUrlFromMcpUrl("http://127.0.0.1:3100/mcp")).toBe(
      "http://127.0.0.1:3100/health",
    );
  });
});
