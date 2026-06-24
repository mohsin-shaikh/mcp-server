import type { McpToolDefinition } from "@zuupee/mcp-client";

function isReadOnlyTool(tool: McpToolDefinition): boolean {
  const annotations = tool.annotations;
  if (!annotations) {
    return false;
  }
  if (annotations["destructiveHint"] === true) {
    return false;
  }
  return annotations["readOnlyHint"] === true;
}

export function filterTools(
  tools: McpToolDefinition[],
  options: {
    toolAllowlist?: string[];
    readOnly?: boolean;
  },
): McpToolDefinition[] {
  let filtered = tools;

  if (options.toolAllowlist && options.toolAllowlist.length > 0) {
    const allowed = new Set(options.toolAllowlist);
    filtered = filtered.filter((tool) => allowed.has(tool.namespacedName));
  }

  if (options.readOnly) {
    filtered = filtered.filter((tool) => isReadOnlyTool(tool));
  }

  return filtered;
}
