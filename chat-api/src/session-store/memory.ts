import { randomUUID } from "node:crypto";
import type { Session, SessionStore, StoredMessage } from "./types.js";

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly locks = new Map<string, Promise<void>>();

  async create(userId?: string): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      messages: [],
      createdAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async addMessage(sessionId: string, message: StoredMessage): Promise<void> {
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

  async close(): Promise<void> {
    this.sessions.clear();
    this.locks.clear();
  }
}
