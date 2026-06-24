import type { McpServerConfig } from "@zuupee/mcp-client";

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; toolCallId: string; content: string };

export type OrchestratorEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; name: string; args: unknown }
  | { type: "tool_end"; name: string; result: string; isError: boolean }
  | { type: "done"; message: string }
  | { type: "error"; message: string };

export type OrchestratorConfig = {
  llm: { provider: "openai" | "anthropic"; model: string; apiKey: string };
  mcp: McpServerConfig[];
  systemPrompt?: string;
  maxToolSteps?: number;
  toolAllowlist?: string[];
  readOnly?: boolean;
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type LlmChunk =
  | { type: "text_delta"; delta: string }
  | {
      type: "response_complete";
      text: string;
      toolCalls: LlmToolCall[];
    };

export interface LlmAdapter {
  complete(params: {
    messages: LlmMessage[];
    tools: unknown[];
    stream: boolean;
  }): AsyncIterable<LlmChunk>;
}
