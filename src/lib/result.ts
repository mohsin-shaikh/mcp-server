import type { CallToolResult } from "@modelcontextprotocol/server";
import { safeErrorMessage } from "./errors.js";
import { redact } from "./format.js";

export function toolText(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: "text", text: redact(text) }],
    ...(isError ? { isError: true } : {}),
  };
}

export function toolJson(data: unknown): CallToolResult {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: "text", text: redact(text) }],
    structuredContent:
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)
        : { value: data },
  };
}

export function toolError(err: unknown): CallToolResult {
  return toolText(safeErrorMessage(err), true);
}
