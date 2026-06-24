import { describe, expect, it, vi } from "vitest";
import type { McpToolDefinition } from "@zuupee/mcp-client";
import { ChatOrchestrator } from "../src/orchestrator.js";
import type { ToolRegistryLike, ConnectionManagerLike } from "../src/registry.js";
import type { LlmAdapter, LlmChunk, LlmMessage } from "../src/types.js";

const sampleTool: McpToolDefinition = {
  serverId: "orders",
  name: "get_order",
  namespacedName: "orders__get_order",
  description: "Get order by ID",
  inputSchema: { type: "object", properties: { id: { type: "string" } } },
  annotations: { readOnlyHint: true },
};

function createMockRegistry(): ToolRegistryLike {
  return {
    refresh: vi.fn(async () => undefined),
    listTools: vi.fn(() => [sampleTool]),
    getServerInstructions: vi.fn(() => "Use orders tools for order lookups."),
    callTool: vi.fn(async () => ({
      content: JSON.stringify({ id: "ord_123", status: "shipped" }),
      isError: false,
    })),
  };
}

function createMockManager(): ConnectionManagerLike {
  return {
    connect: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

function createMockLlm(responses: LlmChunk[][]): LlmAdapter {
  let call = 0;

  return {
    complete: async function* (_params: {
      messages: LlmMessage[];
      tools: unknown[];
      stream: boolean;
    }) {
      const chunks = responses[call] ?? [
        { type: "response_complete", text: "Fallback response", toolCalls: [] },
      ];
      call += 1;

      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

async function collectEvents(
  orchestrator: ChatOrchestrator,
  message: string,
): Promise<Array<{ type: string }>> {
  const events = [];
  for await (const event of orchestrator.run([{ role: "user", content: message }])) {
    events.push(event);
  }
  return events;
}

describe("ChatOrchestrator", () => {
  it("calls a tool then returns assistant text", async () => {
    const registry = createMockRegistry();
    const manager = createMockManager();
    const llm = createMockLlm([
      [
        { type: "text_delta", delta: "Looking up " },
        {
          type: "response_complete",
          text: "Looking up ",
          toolCalls: [
            {
              id: "call_1",
              name: "orders__get_order",
              arguments: '{"id":"ord_123"}',
            },
          ],
        },
      ],
      [
        { type: "text_delta", delta: "Your order shipped." },
        {
          type: "response_complete",
          text: "Your order shipped.",
          toolCalls: [],
        },
      ],
    ]);

    const orchestrator = new ChatOrchestrator(
      {
        llm: { provider: "openai", model: "gpt-4o", apiKey: "test" },
        mcp: [],
      },
      { llm, manager, registry },
    );

    const events = await collectEvents(orchestrator, "What is the status of order 123?");

    expect(registry.callTool).toHaveBeenCalledWith("orders__get_order", { id: "ord_123" });
    expect(events.some((event) => event.type === "tool_start")).toBe(true);
    expect(events.some((event) => event.type === "tool_end")).toBe(true);
    expect(events.at(-1)).toEqual({
      type: "done",
      message: "Your order shipped.",
    });
  });

  it("returns an error when max tool steps are exceeded", async () => {
    const registry = createMockRegistry();
    const manager = createMockManager();
    const toolLoop = [
      { type: "text_delta" as const, delta: "" },
      {
        type: "response_complete" as const,
        text: "",
        toolCalls: [
          {
            id: "call_1",
            name: "orders__get_order",
            arguments: '{"id":"ord_123"}',
          },
        ],
      },
    ];

    const llm = createMockLlm([toolLoop, toolLoop]);

    const orchestrator = new ChatOrchestrator(
      {
        llm: { provider: "openai", model: "gpt-4o", apiKey: "test" },
        mcp: [],
        maxToolSteps: 1,
      },
      { llm, manager, registry },
    );

    const events = await collectEvents(orchestrator, "loop forever");

    expect(events.at(-1)?.type).toBe("error");
  });

  it("surfaces tool errors back to the model flow", async () => {
    const registry = createMockRegistry();
    registry.callTool = vi.fn(async () => ({
      content: "Order not found",
      isError: true,
    }));

    const manager = createMockManager();
    const llm = createMockLlm([
      [
        {
          type: "response_complete",
          text: "",
          toolCalls: [
            {
              id: "call_1",
              name: "orders__get_order",
              arguments: '{"id":"missing"}',
            },
          ],
        },
      ],
      [
        {
          type: "response_complete",
          text: "I could not find that order.",
          toolCalls: [],
        },
      ],
    ]);

    const orchestrator = new ChatOrchestrator(
      {
        llm: { provider: "openai", model: "gpt-4o", apiKey: "test" },
        mcp: [],
      },
      { llm, manager, registry },
    );

    const events = await collectEvents(orchestrator, "Find order missing");

    const toolEnd = events.find((event) => event.type === "tool_end") as
      | { type: "tool_end"; isError: boolean }
      | undefined;
    expect(toolEnd?.isError).toBe(true);
    expect(events.at(-1)).toEqual({
      type: "done",
      message: "I could not find that order.",
    });
  });
});
