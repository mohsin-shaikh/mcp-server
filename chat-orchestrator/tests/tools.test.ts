import { describe, expect, it } from "vitest";
import type { McpToolDefinition } from "@zuupee/mcp-client";
import { filterTools } from "../src/tools.js";

const readTool: McpToolDefinition = {
  serverId: "orders",
  name: "get_order",
  namespacedName: "orders__get_order",
  description: "read",
  inputSchema: {},
  annotations: { readOnlyHint: true },
};

const writeTool: McpToolDefinition = {
  serverId: "orders",
  name: "cancel_order",
  namespacedName: "orders__cancel_order",
  description: "write",
  inputSchema: {},
  annotations: { destructiveHint: true },
};

describe("filterTools", () => {
  it("filters by allowlist", () => {
    const filtered = filterTools([readTool, writeTool], {
      toolAllowlist: ["orders__get_order"],
    });
    expect(filtered.map((tool) => tool.namespacedName)).toEqual(["orders__get_order"]);
  });

  it("keeps only read-only tools when readOnly is enabled", () => {
    const filtered = filterTools([readTool, writeTool], { readOnly: true });
    expect(filtered.map((tool) => tool.namespacedName)).toEqual(["orders__get_order"]);
  });
});
