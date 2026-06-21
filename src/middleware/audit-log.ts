import type { ServerContext } from "../context.js";

export function logToolCall(
  ctx: ServerContext,
  toolName: string,
  meta: Record<string, unknown> = {},
): void {
  ctx.logger.info(
    {
      requestId: ctx.requestId,
      tool: toolName,
      readOnly: ctx.config.readOnly,
      ...meta,
    },
    "Tool call",
  );
}

export function logToolResult(
  ctx: ServerContext,
  toolName: string,
  success: boolean,
  meta: Record<string, unknown> = {},
): void {
  ctx.logger.info(
    {
      requestId: ctx.requestId,
      tool: toolName,
      success,
      ...meta,
    },
    "Tool result",
  );
}
