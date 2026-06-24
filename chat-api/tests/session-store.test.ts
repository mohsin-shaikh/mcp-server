import { describe, expect, it } from "vitest";
import { MemorySessionStore } from "../src/session-store/memory.js";
import { RedisSessionStore, type RedisClientLike } from "../src/session-store/redis.js";

function createMockRedis(): RedisClientLike & { data: Map<string, string> } {
  const data = new Map<string, string>();

  return {
    data,
    async connect() {
      return undefined;
    },
    async quit() {
      return undefined;
    },
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value, options) {
      if (options?.NX && data.has(key)) {
        return null;
      }
      data.set(key, value);
      return "OK";
    },
    async del(key) {
      return data.delete(key) ? 1 : 0;
    },
    async eval(script, { keys, arguments: args }) {
      if (script.includes('redis.call("get"') && data.get(keys[0]!) === args[0]) {
        data.delete(keys[0]!);
        return 1;
      }
      return 0;
    },
  };
}

describe("RedisSessionStore", () => {
  it("persists and reloads sessions", async () => {
    const redis = createMockRedis();
    const store = new RedisSessionStore(redis, 3600);

    const session = await store.create();
    await store.addMessage(session.id, { role: "user", content: "hello" });

    const loaded = await store.get(session.id);
    expect(loaded?.messages).toEqual([{ role: "user", content: "hello" }]);
  });
});

describe("MemorySessionStore", () => {
  it("creates and retrieves sessions", async () => {
    const store = new MemorySessionStore();
    const session = await store.create("user-1");
    expect(session.userId).toBe("user-1");

    await store.addMessage(session.id, { role: "assistant", content: "hi" });
    const loaded = await store.get(session.id);
    expect(loaded?.messages).toHaveLength(1);
  });
});
