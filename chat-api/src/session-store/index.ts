import { MemorySessionStore } from "./memory.js";
import { createRedisClient, RedisSessionStore } from "./redis.js";
import type { SessionStore } from "./types.js";

export type SessionStoreOptions = {
  redisUrl?: string;
  sessionTtlSeconds: number;
};

export async function createSessionStore(options: SessionStoreOptions): Promise<SessionStore> {
  if (options.redisUrl) {
    const client = await createRedisClient(options.redisUrl);
    return new RedisSessionStore(client, options.sessionTtlSeconds);
  }

  return new MemorySessionStore();
}

export type { Session, SessionStore, StoredMessage } from "./types.js";
export { MemorySessionStore } from "./memory.js";
export { RedisSessionStore } from "./redis.js";
