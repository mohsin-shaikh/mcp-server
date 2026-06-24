export const DEFAULT_SYSTEM_PROMPT = `You are a helpful website assistant.

Use the available tools to look up factual data such as orders, server info, and configuration.
Do not invent IDs, order numbers, or statuses — always verify with tools when the user asks about specific data.
If a tool returns an error, explain what went wrong and suggest what the user can try next.
Keep replies concise and friendly.`;

export function buildSystemPrompt(basePrompt: string, serverInstructions: string): string {
  const sections = [basePrompt.trim()];

  if (serverInstructions.trim()) {
    sections.push("## MCP server instructions", serverInstructions.trim());
  }

  return sections.join("\n\n");
}
