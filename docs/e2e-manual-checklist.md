# Manual E2E checklist — chat stack

Use this checklist to verify the full browser → chat-api → orchestrator → MCP → orders API path.

## Local dev (recommended for iteration)

### Prerequisites

- [ ] `.env.local` at repo root with `OPENAI_API_KEY` set
- [ ] `MCP_SERVERS_CONFIG=./config/mcp-servers.chat.example.json` in `.env.local`
- [ ] `pnpm install && pnpm build` completed successfully

### Steps

1. **Start mock orders API**

   ```bash
   pnpm dev:mock-orders
   ```
   - [ ] `curl http://127.0.0.1:3999/health` returns OK

2. **Start chat-api**

   ```bash
   pnpm dev:chat
   ```
   - [ ] `curl http://127.0.0.1:3200/health` shows `status: ok` and MCP servers healthy

3. **Start widget dev server**

   ```bash
   pnpm dev:widget
   ```
   - [ ] Open http://localhost:5173
   - [ ] Chat button appears bottom-right

4. **Send a message**
   - [ ] Open the chat panel
   - [ ] Ask: `What is the status of order ord_123?`
   - [ ] Status line shows a tool indicator (e.g. `Using tool: orders · get_order…`)
   - [ ] Assistant reply streams in and mentions order status (`shipped`)

5. **Reload persistence**
   - [ ] Refresh the page
   - [ ] Previous user + assistant messages appear after reopening chat

## Docker Compose demo

### Prerequisites

- [ ] `OPENAI_API_KEY` exported in shell or `.env` file at repo root
- [ ] Widget built: `pnpm -C chat-widget build`

### Steps

1. **Start stack**

   ```bash
   pnpm docker:chat
   ```
   - [ ] All services become healthy (`docker compose -f docker-compose.chat.yml ps`)

2. **Open widget**
   - [ ] Visit http://localhost:8080
   - [ ] Chat button loads without console errors

3. **Verify API from host**

   ```bash
   curl -s http://127.0.0.1:3200/health | jq
   ```
   - [ ] `mcp.core` and `mcp.orders` are `ok`

4. **End-to-end chat**
   - [ ] Ask about `ord_123` in the widget
   - [ ] Streamed reply references order data from mock API

## Docker Compose notes

- `chat-api` uses `config/mcp-servers.docker.json` (HTTP to `mcp-core` / `mcp-orders`), **not** `MCP_SERVERS_CONFIG` from `.env.local`
- If you see `Connection closed` or `circuit open`, restart the stack: `docker compose -f docker-compose.chat.yml down && pnpm docker:chat`
- Verify MCP health: `curl -s http://127.0.0.1:3200/health | jq`

## Failure triage

| Symptom                          | Likely cause                                                |
| -------------------------------- | ----------------------------------------------------------- |
| CORS error in browser            | Add widget origin to `CHAT_CORS_ORIGINS`                    |
| `Session not found` after reload | chat-api restarted (in-memory sessions); create new session |
| `Connection closed` / `circuit open` | Docker used stdio MCP config from `.env.local`; restart stack after fix |
| Tool errors / empty reply        | mock-api or MCP servers not running                         |
| `OPENAI_API_KEY is required`     | Missing key in `.env.local` or compose env                  |
