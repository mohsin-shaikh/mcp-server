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

export class ChatOrchestrator {
  constructor(private readonly config: OrchestratorConfig) {
    void this.config;
  }

  async *run(_messages: ChatMessage[]): AsyncIterable<OrchestratorEvent> {
    yield {
      type: "error",
      message:
        "ChatOrchestrator is not implemented yet — see Phase 3 of docs/chatbot-implementation-plan.md",
    };
  }

  async close(): Promise<void> {
    // no-op until Phase 3
  }
}
