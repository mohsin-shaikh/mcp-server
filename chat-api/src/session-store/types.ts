import type { ChatMessage } from "@zuupee/chat-orchestrator";

export type StoredMessage = Extract<ChatMessage, { role: "user" } | { role: "assistant" }>;

export type Session = {
  id: string;
  messages: StoredMessage[];
  createdAt: string;
  userId?: string;
};

export interface SessionStore {
  create(userId?: string): Promise<Session>;
  get(sessionId: string): Promise<Session | undefined>;
  addMessage(sessionId: string, message: StoredMessage): Promise<void>;
  withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
