import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@zuupee/chat-orchestrator";

export type StoredMessage = Extract<ChatMessage, { role: "user" } | { role: "assistant" }>;

export type Session = {
  id: string;
  messages: StoredMessage[];
  createdAt: string;
  userId?: string;
};

export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly locks = new Map<string, Promise<void>>();

  create(userId?: string): Session {
    const session: Session = {
      id: randomUUID(),
      messages: [],
      createdAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  addMessage(sessionId: string, message: StoredMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    session.messages.push(message);
  }

  async withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(sessionId, gate);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(sessionId) === gate) {
        this.locks.delete(sessionId);
      }
    }
  }
}
