import type { LlmAdapter, LlmChunk, LlmMessage, LlmToolCall } from "../types.js";

type OpenAIMessage = {
  role: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

function toOpenAIMessages(messages: LlmMessage[]): OpenAIMessage[] {
  return messages.map((message) => {
    if (message.role === "system" || message.role === "user") {
      return { role: message.role, content: message.content };
    }

    if (message.role === "assistant") {
      if (message.toolCalls && message.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: message.content,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: {
              name: call.name,
              arguments: call.arguments,
            },
          })),
        };
      }
      return { role: "assistant", content: message.content };
    }

    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  });
}

function parseSseEvents(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts, rest };
}

function parseSseData(eventBlock: string): unknown | undefined {
  const dataLines = eventBlock
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return undefined;
  }

  const payload = dataLines.join("\n");
  if (payload === "[DONE]") {
    return { done: true };
  }

  return JSON.parse(payload) as unknown;
}

export class OpenAIAdapter implements LlmAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async *complete(params: {
    messages: LlmMessage[];
    tools: unknown[];
    stream: boolean;
  }): AsyncIterable<LlmChunk> {
    if (!params.stream) {
      throw new Error("OpenAIAdapter only supports streaming in v1");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: toOpenAIMessages(params.messages),
        tools: params.tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${body}`);
    }

    if (!response.body) {
      throw new Error("OpenAI API returned an empty response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const toolCalls = new Map<number, LlmToolCall>();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(buffer);
      buffer = parsed.rest;

      for (const eventBlock of parsed.events) {
        const payload = parseSseData(eventBlock);
        if (!payload || typeof payload !== "object") {
          continue;
        }

        if ("done" in payload) {
          continue;
        }

        const chunk = payload as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
        };

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) {
          continue;
        }

        if (delta.content) {
          text += delta.content;
          yield { type: "text_delta", delta: delta.content };
        }

        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index ?? 0;
            const current = toolCalls.get(index) ?? {
              id: toolCall.id ?? "",
              name: "",
              arguments: "",
            };

            if (toolCall.id) {
              current.id = toolCall.id;
            }
            if (toolCall.function?.name) {
              current.name = toolCall.function.name;
            }
            if (toolCall.function?.arguments) {
              current.arguments += toolCall.function.arguments;
            }

            toolCalls.set(index, current);
          }
        }
      }
    }

    yield {
      type: "response_complete",
      text,
      toolCalls: [...toolCalls.values()].filter((call) => call.id && call.name),
    };
  }
}

export function createLlmAdapter(config: {
  provider: "openai" | "anthropic";
  model: string;
  apiKey: string;
}): LlmAdapter {
  if (config.provider === "openai") {
    return new OpenAIAdapter(config.apiKey, config.model);
  }

  throw new Error(`LLM provider "${config.provider}" is not implemented yet`);
}
