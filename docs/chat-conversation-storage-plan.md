# Chat Conversation Storage — Implementation Plan

> Plan for **durable storage** of chat sessions and messages in the Zuupee chatbot stack.

Related docs:

- [Website Chatbot — Implementation Plan](./chatbot-implementation-plan.md)
- [MCP Client & Agent Orchestrator — Planning Guide](./mcp-client-and-orchestrator.md)

---

## 1. Current state

Today, `chat-api` persists sessions through a `SessionStore` abstraction with two backends:

| Backend | Config | Behavior |
| ------- | ------ | -------- |
| **In-memory** | `CHAT_REDIS_URL` unset | Process-local `Map`; lost on restart |
| **Redis** | `CHAT_REDIS_URL` set | Whole session stored as JSON under `chat:session:{id}` with TTL |

Each session holds:

- `id`
- `messages[]` (user + assistant only)
- `createdAt`
- optional `userId`

Messages are written in `POST /chat/sessions/:id/messages` when the user sends a message and when the orchestrator emits `done`.

**There is no relational database** (Postgres, SQLite, etc.) for chat history. Redis TTL defaults to 24 hours (`CHAT_SESSION_TTL_SECONDS=86400`). Tool audit data is logged (pino) but not stored in a queryable store.

### What is not persisted today

- Intermediate `tool` role messages (orchestrator reconstructs context each turn)
- Full tool arguments/results (only `argsHash` in audit logs)
- User conversation lists (no `GET /chat/sessions` by `userId`)
- Long-term history beyond Redis TTL

---

## 2. Goals

### Primary goal

Add **durable, queryable storage** for conversations and messages so that:

- History survives API restarts and horizontal scaling
- Sessions are not lost when Redis TTL expires
- Logged-in users can resume past conversations (v2)
- Tool invocations can be audited beyond logs (v2+)

### Non-goals (initial DB release)

- Full LLM thread replay including every `tool` message
- Conversation search / embeddings / RAG over chat history
- Multi-region replication
- Real-time sync across devices (beyond reload via API)

### Success criteria

| Criterion | Target |
| --------- | ------ |
| Durability | History survives `chat-api` restart |
| API compatibility | Existing widget endpoints unchanged |
| Concurrency | Concurrent messages on one session do not corrupt history |
| Ownership | Sessions scoped to authenticated `userId` before production |
| Migrations | Schema versioned; deployable via Docker Compose |

---

## 3. Recommended architecture

Use a **hybrid** model: PostgreSQL as source of truth, Redis for locking (and optional cache).

```mermaid
flowchart LR
  Widget[chat-widget]
  API[chat-api]
  Lock[Redis locks / optional cache]
  DB[(PostgreSQL)]

  Widget --> API
  API --> Lock
  API --> DB
```

| Layer | Role |
| ----- | ---- |
| **PostgreSQL** | Source of truth for conversations + messages |
| **Redis** (optional) | `withSessionLock`, hot session cache, existing rate-limit patterns |
| **Memory** (dev only) | Keep for local unit tests |

### Why not Redis-only?

- TTL drops history after `CHAT_SESSION_TTL_SECONDS`
- No querying by `userId`, analytics, or compliance deletes
- Whole session blob does not scale for long conversations

### Why not PostgreSQL-only?

- Existing `withSessionLock` semantics map cleanly to Redis locks
- Optional Redis cache reduces DB reads on every turn

### Extension point

The `SessionStore` interface in `chat-api/src/session-store/types.ts` is the seam. Add `PostgresSessionStore` (or a composite store) without changing the widget or orchestrator.

---

## 4. Schema (PostgreSQL)

### Phase 1 — minimal (matches current API)

```sql
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX conversations_user_id_updated_at_idx
  ON conversations (user_id, updated_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sequence         INT NOT NULL
);

CREATE UNIQUE INDEX messages_conversation_sequence_idx
  ON messages (conversation_id, sequence);

CREATE INDEX messages_conversation_created_at_idx
  ON messages (conversation_id, created_at);
```

`sequence` is a monotonic per-conversation index for stable ordering (prefer over `created_at` alone under concurrency).

### Phase 2 — extensions (optional)

```sql
-- Tool audit (complement pino logs)
CREATE TABLE tool_invocations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       UUID NULL REFERENCES messages(id),
  tool_name        TEXT NOT NULL,
  args_hash        TEXT NOT NULL,
  args_json        JSONB NULL,
  result_summary   TEXT NULL,
  latency_ms       INT NOT NULL,
  is_error         BOOLEAN NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: full orchestrator SSE events for debugging
CREATE TABLE message_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL,
  event_type       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Store `args_json` only when `CHAT_STORE_TOOL_ARGS=true` and after redacting secrets.

---

## 5. Code changes

### 5.1 `PostgresSessionStore`

Implement the existing `SessionStore` interface:

| Method | Behavior |
| ------ | -------- |
| `create(userId?)` | `INSERT INTO conversations` |
| `get(sessionId)` | Load conversation + `SELECT messages ORDER BY sequence` |
| `addMessage(sessionId, message)` | Transaction: verify conversation, insert message, bump `updated_at` |
| `withSessionLock(sessionId, fn)` | Redis lock (reuse existing logic) or `pg_advisory_xact_lock` |
| `close()` | Drain connection pool |

### 5.2 Store selection (`createSessionStore`)

Priority when multiple URLs are configured:

```
postgres (+ redis locks) > redis > memory
```

Optional composite:

```ts
new CachedSessionStore({
  primary: PostgresSessionStore,
  cache: RedisSessionStore,   // TTL cache
  locks: RedisLockProvider,
});
```

Start with **Postgres + Redis locks**; add cache only if read latency becomes an issue.

### 5.3 Dependencies

No ORM exists in the monorepo today.

| Option | Recommendation |
| ------ | -------------- |
| **Drizzle + `pg`** | Preferred — type-safe, light migrations |
| **`pg` + SQL files** | Minimal deps, manual migrations |
| **Prisma** | Heavier for this small surface |

Add migrations under `chat-api/migrations/`.

### 5.4 API surface

**Phase 1 — no breaking changes**

| Method | Path | Notes |
| ------ | ---- | ----- |
| `POST` | `/chat/sessions` | Unchanged |
| `GET` | `/chat/sessions/:id/messages` | Unchanged |
| `POST` | `/chat/sessions/:id/messages` | Unchanged (SSE) |

**Phase 2 — new endpoints**

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/chat/sessions` | List conversations for authenticated `userId` |
| `DELETE` | `/chat/sessions/:id` | GDPR / user-initiated delete |
| `PATCH` | `/chat/sessions/:id` | Optional title/summary |

### 5.5 Auth and ownership

Before storing real user data in production:

1. Derive `userId` from JWT on `POST /chat/sessions` (do not trust client body alone).
2. On `GET` / `POST` for `:id`, verify `session.userId === auth.userId` (or allow anonymous-only sessions).
3. Domain MCP plugins must continue validating ownership server-side on every tool call.

### 5.6 Tool audit → DB (Phase 2)

Wire `onToolAudit` in `chat-api` to a `ToolAuditRepository` in addition to structured logs:

```ts
onToolAudit: (entry) => {
  logger.info({ audit: "tool_call", ...entry });
  toolAuditRepo.insert(entry); // async, non-blocking
},
```

---

## 6. Phased rollout

### Phase 1 — Durable storage (1–2 weeks)

- [ ] Add Postgres service to `docker-compose.chat.yml`
- [ ] Add `CHAT_DATABASE_URL` to `chat-api` config
- [ ] SQL migrations for `conversations` + `messages`
- [ ] `PostgresSessionStore` implementing `SessionStore`
- [ ] Redis retained for `withSessionLock` (or Postgres advisory locks)
- [ ] Unit tests with test DB / testcontainers
- [ ] Integration test: create session → send message → reload history after restart
- [ ] Health endpoint reports `sessionStore: "postgres"` (or `postgres+redis`)

**Exit:** Chat history survives API restart and outlives Redis TTL.

### Phase 2 — User-scoped conversations (1 week)

- [ ] JWT middleware → `userId` on session create
- [ ] `GET /chat/sessions` for logged-in users
- [ ] Widget: optional “resume last conversation” (not only `sessionStorage` session id)
- [ ] Retention job: delete conversations older than N days

### Phase 3 — Observability and compliance (ongoing)

- [ ] `tool_invocations` table
- [ ] Admin/debug read API for conversation + tool trail
- [ ] PII redaction before persist (tokens, emails in tool args)
- [ ] Export / delete user data endpoints

### Phase 4 — Advanced memory (later)

- [ ] Store full `ChatMessage[]` including `tool` role for exact LLM replay
- [ ] Conversation summarization when history exceeds token budget
- [ ] `conversation_checkpoints` for long-running agent workflows

---

## 7. Configuration

### New environment variables

| Variable | Used by | Description |
| -------- | ------- | ----------- |
| `CHAT_DATABASE_URL` | chat-api | `postgresql://user:pass@host:5432/zuupee_chat` |
| `CHAT_DB_POOL_MAX` | chat-api | Connection pool size (default `10`) |
| `CHAT_CONVERSATION_RETENTION_DAYS` | chat-api | Optional cleanup job (Phase 2) |
| `CHAT_STORE_TOOL_ARGS` | chat-api | `false` by default; persist redacted tool args when `true` |

Existing variables remain relevant:

| Variable | Role with DB |
| -------- | ------------ |
| `CHAT_REDIS_URL` | Locks and optional cache (recommended to keep) |
| `CHAT_SESSION_TTL_SECONDS` | Applies to Redis cache only when using composite store |

### Docker Compose sketch

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: zuupee_chat
    POSTGRES_USER: zuupee
    POSTGRES_PASSWORD: zuupee
  volumes:
    - chat_pg_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U zuupee -d zuupee_chat"]
    interval: 5s
    timeout: 3s
    retries: 5

chat-api:
  environment:
    CHAT_DATABASE_URL: postgresql://zuupee:zuupee@postgres:5432/zuupee_chat
    CHAT_REDIS_URL: redis://redis:6379
  depends_on:
    postgres:
      condition: service_healthy
```

### Migration strategy

- Run migrations on `chat-api` startup (simple) or as a separate init job (production).
- **No backfill from Redis required** for MVP — existing Redis sessions expire naturally; new sessions use Postgres.

---

## 8. Security and retention

| Risk | Mitigation |
| ---- | ---------- |
| Session hijack via guessed UUID | Auth ownership checks; rate limit session create |
| PII in message content | Retention policy; encrypt at rest if required by policy |
| Secrets in tool args | Redact before `args_json`; default `CHAT_STORE_TOOL_ARGS=false` |
| Unauthorized listing | `GET /chat/sessions` requires JWT; filter by `user_id` |
| GDPR | `DELETE` conversation cascades messages and tool rows |

### Retention defaults (recommend)

| Session type | Suggested retention |
| ------------ | ------------------- |
| Anonymous | 7 days |
| Authenticated | 90 days (configurable) |
| Tool audit | Same as parent conversation |

---

## 9. Testing checklist

| Test | Verify |
| ---- | ------ |
| Create + add messages | `sequence` ordering; transactional inserts |
| Concurrent POSTs same session | Lock prevents interleaved corrupt history |
| Restart `chat-api` | `GET /messages` returns prior history |
| Unknown session | `404` unchanged |
| Widget `ensureSession` | Works with stored `sessionId` |
| Load test | Connection pool does not exhaust under SSE concurrency |
| Migration rollback | Documented manual rollback for failed deploy |

---

## 10. Open decisions

Decide before implementation:

| # | Decision | Options | Recommendation |
| - | -------- | ------- | -------------- |
| 1 | Cache layer | Postgres only vs Postgres + Redis cache | Postgres + Redis locks first; cache if needed |
| 2 | Tool message storage | User/assistant only vs full thread | User/assistant for v1; full thread for debug/replay later |
| 3 | Anonymous retention | 24h / 7d / none | 7 days with cleanup job |
| 4 | Database placement | Shared app DB vs dedicated `zuupee_chat` | Dedicated DB for migrations and retention |
| 5 | ORM | Drizzle vs raw `pg` | Drizzle |

---

## 11. Suggested implementation order

1. **Postgres + `PostgresSessionStore`** — same message shape as today (user/assistant only).
2. **Redis locks** — preserve existing concurrency semantics.
3. **JWT `userId` + ownership checks** — before production user data.
4. **`GET /chat/sessions`** — once auth exists.
5. **`tool_invocations` table** — when analytics beyond logs is needed.

---

## 12. References (code)

| File | Relevance |
| ---- | --------- |
| `chat-api/src/session-store/types.ts` | `SessionStore` interface |
| `chat-api/src/session-store/memory.ts` | In-memory reference implementation |
| `chat-api/src/session-store/redis.ts` | Redis + lock reference implementation |
| `chat-api/src/session-store/index.ts` | Store factory |
| `chat-api/src/app.ts` | Session CRUD and message persistence |
| `chat-api/src/config.ts` | Env config |
| `chat-orchestrator/src/types.ts` | `ChatMessage` roles (user, assistant, tool) |
| `chat-widget/src/api.ts` | Client history load / sessionStorage |
