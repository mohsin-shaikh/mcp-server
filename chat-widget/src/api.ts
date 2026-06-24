export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_start"; name: string; args: unknown }
  | { type: "tool_end"; name: string; isError: boolean }
  | { type: "done"; message: string }
  | { type: "error"; message: string };

export type StreamEventHandler = (event: StreamEvent) => void;

const SESSION_STORAGE_KEY = "zuupee_chat_session_id";

export function getStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeSessionId(sessionId: string): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // ignore quota / private mode errors
  }
}

export async function createSession(apiUrl: string): Promise<string> {
  const response = await fetch(`${apiUrl}/chat/sessions`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Failed to create session (${response.status})`);
  }

  const body = (await response.json()) as { sessionId?: string };
  if (!body.sessionId) {
    throw new Error("Session response missing sessionId");
  }

  return body.sessionId;
}

export async function loadHistory(apiUrl: string, sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${apiUrl}/chat/sessions/${sessionId}/messages`);
  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load history (${response.status})`);
  }

  const body = (await response.json()) as { messages?: ChatMessage[] };
  return body.messages ?? [];
}

export async function sendMessage(
  apiUrl: string,
  sessionId: string,
  content: string,
  onEvent: StreamEventHandler,
): Promise<void> {
  const response = await fetch(`${apiUrl}/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error("Response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.remainder;

    for (const sse of parsed.events) {
      onEvent(mapSseEvent(sse));
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBuffer(`${buffer}\n\n`);
    for (const sse of parsed.events) {
      onEvent(mapSseEvent(sse));
    }
  }
}

export type ParsedSseEvent = {
  event: string;
  data: string;
};

export function parseSseBuffer(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() ?? "";
  const events: ParsedSseEvent[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      continue;
    }

    let event = "message";
    const dataLines: string[] = [];

    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }

  return { events, remainder };
}

function mapSseEvent(sse: ParsedSseEvent): StreamEvent {
  const payload = JSON.parse(sse.data) as Record<string, unknown>;

  switch (sse.event) {
    case "text_delta":
      return { type: "text_delta", delta: String(payload["delta"] ?? "") };
    case "tool_start":
      return {
        type: "tool_start",
        name: String(payload["name"] ?? ""),
        args: payload["args"],
      };
    case "tool_end":
      return {
        type: "tool_end",
        name: String(payload["name"] ?? ""),
        isError: Boolean(payload["isError"]),
      };
    case "done":
      return { type: "done", message: String(payload["message"] ?? "") };
    case "error":
      return { type: "error", message: String(payload["message"] ?? "Unknown error") };
    default:
      return { type: "error", message: `Unknown event: ${sse.event}` };
  }
}

export async function ensureSession(apiUrl: string): Promise<string> {
  const existing = getStoredSessionId();
  if (existing) {
    const history = await loadHistory(apiUrl, existing).catch(() => null);
    if (history !== null) {
      return existing;
    }
  }

  const sessionId = await createSession(apiUrl);
  storeSessionId(sessionId);
  return sessionId;
}
