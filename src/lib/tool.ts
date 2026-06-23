import type { CallToolResult } from "@modelcontextprotocol/server";
import type { ServerContext } from "../context.js";
import { logToolCall, logToolResult } from "../middleware/audit-log.js";
import { readOnlyBlockedMessage } from "../middleware/read-only.js";
import { toolError } from "./result.js";

export interface ToolHandlerOptions {
  /** Block this tool when READ_ONLY=true */
  mutating?: boolean;
}

export function wrapToolHandler<Args>(
  ctx: ServerContext,
  toolName: string,
  handler: (args: Args) => Promise<CallToolResult>,
  options: ToolHandlerOptions = {},
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    if (ctx.config.readOnly && options.mutating) {
      logToolCall(ctx, toolName, { blocked: true, reason: "read_only" });
      logToolResult(ctx, toolName, false, { reason: "read_only" });
      return toolError(readOnlyBlockedMessage(toolName));
    }

    logToolCall(ctx, toolName);

    try {
      const result = await handler(args);
      const failed = result.isError === true;
      logToolResult(ctx, toolName, !failed);
      return result;
    } catch (err) {
      logToolResult(ctx, toolName, false);
      return toolError(err);
    }
  };
}
