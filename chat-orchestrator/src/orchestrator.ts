import {
  McpConnectionManager,
  McpToolRegistry,
  toOpenAITools,
  type McpServerConfig,
} from "@zuupee/mcp-client";
import { parseToolArguments, toLlmMessages } from "./messages.js";
import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./prompts.js";
import { createLlmAdapter } from "./llm/openai.js";
import type { ConnectionManagerLike, ToolRegistryLike } from "./registry.js";
import { filterTools } from "./tools.js";
import type {
  ChatMessage,
  LlmAdapter,
  LlmMessage,
  LlmToolCall,
  OrchestratorConfig,
  OrchestratorEvent,
} from "./types.js";

const DEFAULT_MAX_TOOL_STEPS = 10;

type ChatOrchestratorDeps = {
  llm?: LlmAdapter;
  manager?: ConnectionManagerLike;
  registry?: ToolRegistryLike;
};

export class ChatOrchestrator {
  private readonly config: OrchestratorConfig;
  private readonly llm: LlmAdapter;
  private readonly manager: ConnectionManagerLike;
  private readonly registry: ToolRegistryLike;
  private readonly ownsConnections: boolean;

  constructor(config: OrchestratorConfig, deps: ChatOrchestratorDeps = {}) {
    this.config = config;
    this.llm = deps.llm ?? createLlmAdapter(config.llm);
    this.ownsConnections = !deps.manager || !deps.registry;

    if (deps.manager && deps.registry) {
      this.manager = deps.manager;
      this.registry = deps.registry;
      return;
    }

    const manager = new McpConnectionManager(config.mcp);
    this.manager = manager;
    this.registry = new McpToolRegistry(manager);
  }

  async *run(messages: ChatMessage[]): AsyncIterable<OrchestratorEvent> {
    try {
      await this.manager.connect();
      await this.registry.refresh();

      const basePrompt = this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      const systemPrompt = buildSystemPrompt(
        basePrompt,
        this.registry.getServerInstructions(),
      );

      const tools = filterTools(this.registry.listTools(), {
        toolAllowlist: this.config.toolAllowlist,
        readOnly: this.config.readOnly,
      });
      const openAiTools = toOpenAITools(tools);

      let llmMessages = toLlmMessages(systemPrompt, messages);
      const maxToolSteps = this.config.maxToolSteps ?? DEFAULT_MAX_TOOL_STEPS;
      let finalText = "";

      for (let step = 0; step < maxToolSteps; step++) {
        const completion = await this.collectCompletion(llmMessages, openAiTools);

        for (const delta of completion.textDeltas) {
          yield { type: "text_delta", delta };
        }

        if (completion.toolCalls.length === 0) {
          finalText = completion.text;
          yield { type: "done", message: finalText };
          return;
        }

        llmMessages = [
          ...llmMessages,
          {
            role: "assistant",
            content: completion.text || null,
            toolCalls: completion.toolCalls,
          },
        ];

        for (const toolCall of completion.toolCalls) {
          const args = parseToolArguments(toolCall.arguments);
          yield { type: "tool_start", name: toolCall.name, args };

          let resultContent = "";
          let isError = false;

          try {
            const result = await this.registry.callTool(toolCall.name, args);
            resultContent = result.content;
            isError = result.isError;
          } catch (err) {
            resultContent = err instanceof Error ? err.message : "Tool call failed";
            isError = true;
          }

          yield {
            type: "tool_end",
            name: toolCall.name,
            result: resultContent,
            isError,
          };

          llmMessages.push({
            role: "tool",
            toolCallId: toolCall.id,
            content: resultContent,
          });
        }
      }

      yield {
        type: "error",
        message: `Exceeded maximum tool steps (${maxToolSteps})`,
      };
    } catch (err) {
      yield {
        type: "error",
        message: err instanceof Error ? err.message : "Orchestrator failed",
      };
    }
  }

  async close(): Promise<void> {
    if (this.ownsConnections) {
      await this.manager.close();
    }
  }

  private async collectCompletion(
    messages: LlmMessage[],
    tools: unknown[],
  ): Promise<{ text: string; textDeltas: string[]; toolCalls: LlmToolCall[] }> {
    const textDeltas: string[] = [];
    let text = "";
    let toolCalls: LlmToolCall[] = [];

    for await (const chunk of this.llm.complete({ messages, tools, stream: true })) {
      if (chunk.type === "text_delta") {
        textDeltas.push(chunk.delta);
        text += chunk.delta;
      }

      if (chunk.type === "response_complete") {
        text = chunk.text;
        toolCalls = chunk.toolCalls;
      }
    }

    return { text, textDeltas, toolCalls };
  }
}

export function loadOrchestratorConfigFromEnv(
  mcpServers: McpServerConfig[],
): OrchestratorConfig {
  const provider = process.env["LLM_PROVIDER"] === "anthropic" ? "anthropic" : "openai";
  const apiKey =
    provider === "openai"
      ? process.env["OPENAI_API_KEY"]
      : process.env["ANTHROPIC_API_KEY"];

  if (!apiKey) {
    throw new Error(
      provider === "openai"
        ? "OPENAI_API_KEY is required"
        : "ANTHROPIC_API_KEY is required",
    );
  }

  const toolAllowlist = process.env["CHAT_TOOL_ALLOWLIST"]
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return {
    llm: {
      provider,
      model: process.env["LLM_MODEL"] ?? "gpt-4o",
      apiKey,
    },
    mcp: mcpServers,
    systemPrompt: process.env["CHAT_SYSTEM_PROMPT"] || undefined,
    maxToolSteps: Number.parseInt(process.env["CHAT_MAX_TOOL_STEPS"] ?? "", 10) || undefined,
    toolAllowlist,
    readOnly: process.env["CHAT_READ_ONLY"] === "true",
  };
}
