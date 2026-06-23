import type { CallToolResult } from "@modelcontextprotocol/client";

export function formatCallToolResult(result: CallToolResult): {
  text: string;
  isError: boolean;
} {
  const parts: string[] = [];

  if (result.content) {
    for (const block of result.content) {
      if (block.type === "text") {
        parts.push(block.text);
      } else {
        parts.push(JSON.stringify(block));
      }
    }
  }

  if (result.structuredContent !== undefined) {
    parts.push(JSON.stringify(result.structuredContent));
  }

  return {
    text: parts.join("\n") || "(empty result)",
    isError: Boolean(result.isError),
  };
}
