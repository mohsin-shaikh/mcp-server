import type { McpModule } from "../registry/types.js";

export function isModuleBlockedInReadOnly(mod: McpModule, readOnly: boolean): boolean {
  return readOnly && mod.readOnly === false;
}

export function readOnlyBlockedMessage(toolName: string): string {
  return `Tool disabled in READ_ONLY mode: ${toolName}`;
}
