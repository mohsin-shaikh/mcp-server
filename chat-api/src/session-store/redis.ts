import { randomUUID } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import type { Session, SessionStore, StoredMessage } from "./types.js";

const SESSION_PREFIX = "chat:session:";
const LOCK_PREFIX = "chat:lock:";

export type RedisClientLike = Pick<
  RedisClientType,
  "connect" | "quit" | "get" | "set" | "del" | "eval"
>;

export class RedisSessionStore implements SessionStore {
  constructor(
    private readonly client: RedisClientLike,
    private readonly ttlSeconds: number,
  ) {}

  async create(userId?: string): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      messages: [],
      createdAt: new Date().toISOString(),
      ...(userId ? { userId } : {}),
    };

    await this.saveSession(session);
    return session;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const raw = await this.client.get(this.sessionKey(sessionId));
    if (!raw) {
      return undefined;
    }

    return JSON.parse(raw) as Session;
  }

  async addMessage(sessionId: string, message: StoredMessage): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    session.messages.push(message);
    await this.saveSession(session);
  }

  async withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const lockKey = `${LOCK_PREFIX}${sessionId}`;
    const token = randomUUID();
    const lockTtlSeconds = 30;

    while (true) {
      const acquired = await this.client.set(lockKey, token, {
        NX: true,
        EX: lockTtlSeconds,
      });

      if (acquired) {
        break;
      }

      await sleep(50);
    }

    try {
      return await fn();
    } finally {
      const releaseScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await this.client.eval(releaseScript, {
        keys: [lockKey],
        arguments: [token],
      });
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  private sessionKey(sessionId: string): string {
    return `${SESSION_PREFIX}${sessionId}`;
  }

  private async saveSession(session: Session): Promise<void> {
    await this.client.set(this.sessionKey(session.id), JSON.stringify(session), {
      EX: this.ttlSeconds,
    });
  }
}

export async function createRedisClient(url: string): Promise<RedisClientType> {
  const client = createClient({ url });
  await client.connect();
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
