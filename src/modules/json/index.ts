import { z } from "zod";
import type { McpModule } from "../../registry/types.js";
import { logToolCall, logToolResult } from "../../middleware/audit-log.js";
import { jsonValueSchema } from "../../lib/schema.js";
import { toolError, toolJson, toolText } from "../../lib/result.js";

function getByPath(value: unknown, path: string): unknown {
  const segments = path
    .replace(/^\$\.?/, "")
    .split(".")
    .flatMap((segment) => segment.split(/\[(\d+)\]/).filter(Boolean));

  let current: unknown = value;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      current = current[index];
      continue;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export const jsonModule: McpModule = {
  id: "json",
  name: "JSON",
  readOnly: true,
  register(server, ctx) {
    server.registerTool(
      "json_parse",
      {
        title: "Parse JSON",
        description: "Parse a JSON string into structured data.",
        inputSchema: z.object({
          text: z.string().describe("JSON string to parse"),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ text }) => {
        logToolCall(ctx, "json_parse");
        try {
          const parsed = JSON.parse(text) as unknown;
          logToolResult(ctx, "json_parse", true);
          return toolJson({ parsed });
        } catch (err) {
          logToolResult(ctx, "json_parse", false);
          return toolError(err instanceof Error ? err.message : "Invalid JSON");
        }
      },
    );

    server.registerTool(
      "json_stringify",
      {
        title: "Stringify JSON",
        description: "Serialize a JSON value to a formatted string.",
        inputSchema: z.object({
          value: jsonValueSchema.describe("Value to serialize"),
          indent: z.number().int().min(0).max(8).default(2),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ value, indent }) => {
        logToolCall(ctx, "json_stringify");
        try {
          const text = JSON.stringify(value, null, indent);
          logToolResult(ctx, "json_stringify", true);
          return toolText(text);
        } catch (err) {
          logToolResult(ctx, "json_stringify", false);
          return toolError(err);
        }
      },
    );

    server.registerTool(
      "json_pick",
      {
        title: "Pick JSON paths",
        description:
          "Extract values from JSON using dot/bracket paths (e.g. user.name, items[0].id).",
        inputSchema: z.object({
          value: jsonValueSchema.describe("JSON value to query"),
          paths: z
            .array(z.string())
            .min(1)
            .describe("Paths to extract"),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ value, paths }) => {
        logToolCall(ctx, "json_pick", { pathCount: paths.length });
        const picked: Record<string, unknown> = {};
        for (const path of paths) {
          picked[path] = getByPath(value, path);
        }
        logToolResult(ctx, "json_pick", true);
        return toolJson({ picked });
      },
    );
  },
};
