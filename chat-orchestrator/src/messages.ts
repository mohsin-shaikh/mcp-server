import type { ChatMessage, LlmMessage } from "./types.js";

export function toLlmMessages(systemPrompt: string, history: ChatMessage[]): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: "system", content: systemPrompt }];

  for (const message of history) {
    if (message.role === "user") {
      messages.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    messages.push({
      role: "tool",
      toolCallId: message.toolCallId,
      content: message.content,
    });
  }

  return messages;
}

export function parseToolArguments(raw: string): unknown {
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}
