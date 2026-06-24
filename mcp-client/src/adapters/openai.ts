import type { McpToolDefinition, OpenAIChatCompletionTool } from "../types.js";

function defaultParametersSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
  };
}

export function toOpenAITools(tools: McpToolDefinition[]): OpenAIChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.namespacedName,
      description: tool.description,
      parameters: tool.inputSchema ?? defaultParametersSchema(),
    },
  }));
}
