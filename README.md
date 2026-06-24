# Zuupee MCP

Monorepo for Zuupee's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tooling and website chatbot stack.

## Packages

| Package                                     | Status      | Description                                                                  |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| [`mcp-server`](./mcp-server/)               | Available   | General-purpose MCP server with pluggable modules, stdio and HTTP transports |
| [`mcp-client`](./mcp-client/)               | In progress | Multi-server MCP client with namespaced tools                                |
| [`chat-orchestrator`](./chat-orchestrator/) | Available   | Custom ReAct agent loop with OpenAI + MCP tools                              |
| [`chat-api`](./chat-api/)                   | Available   | HTTP API + SSE for the website chatbot                                       |
| [`chat-widget`](./chat-widget/)             | Available   | Embeddable chat UI (Vite → single JS bundle)                                 |
| [`mock-api-server`](./mock-api-server/)     | Available   | Local JSON orders API for dev and tests                                      |

Domain plugins live under [`mcp-server/plugins/`](./mcp-server/plugins/) — see the `orders` plugin for a reference integration.

See [docs/chatbot-implementation-plan.md](./docs/chatbot-implementation-plan.md) for the full build plan.

## Getting started

```bash
pnpm install
pnpm build
pnpm test
```

### MCP server

```bash
pnpm -C mcp-server dev
```

### MCP client smoke test

```bash
pnpm -C mcp-client dev
```

### Mock API server

```bash
pnpm dev:mock-api-server
```

Then run `mcp-server` with `MCP_MODULES=meta,orders` and `ORDERS_API_BASE_URL=http://127.0.0.1:3999`.

### Chat orchestrator (terminal demo)

Set `OPENAI_API_KEY` in `.env`, then:

```bash
# Terminal 1
pnpm dev:mock-api-server

# Terminal 2
MCP_SERVERS_CONFIG=./config/mcp-servers.chat.example.json \
pnpm dev:orchestrator -- "What is the status of order ord_123?"
```

### Chat API

Set `OPENAI_API_KEY` in `.env.local`, then:

```bash
# Terminal 1
pnpm dev:mock-api-server

# Terminal 2
pnpm dev:chat
```

Create a session and stream a reply:

```bash
SESSION=$(curl -s -X POST http://127.0.0.1:3200/chat/sessions | jq -r .sessionId)
curl -N -X POST "http://127.0.0.1:3200/chat/sessions/$SESSION/messages" \
  -H "Content-Type: application/json" \
  -d '{"content":"What is the status of order ord_123?"}'
```

Copy `.env.example` to `.env.local` at the repo root and set `OPENAI_API_KEY` for orchestrator demos.

### Chat widget

```bash
# Terminal 1
pnpm dev:mock-api-server

# Terminal 2
pnpm dev:chat

# Terminal 3
pnpm dev:widget
```

Open http://localhost:5173 and use the chat button. The widget proxies API calls to `chat-api` via `/api` in dev.

Embed on any site:

```html
<script
  src="https://cdn.example.com/chat-widget.js"
  data-api-url="https://chat.example.com"
  data-theme="light"
></script>
```

### Docker Compose demo

Build the widget, then start the stack (reads `OPENAI_API_KEY` from `.env.local`):

```bash
pnpm -C chat-widget build
pnpm docker:chat
```

Open http://localhost:8080 for the widget and http://localhost:3200/health for API status.

### Production hardening

- **Redis sessions:** set `CHAT_REDIS_URL=redis://127.0.0.1:6379` (Docker Compose includes Redis)
- **OTEL traces:** set `OTEL_ENABLED=true` and point `OTEL_EXPORTER_OTLP_ENDPOINT` at your collector
- **Per-environment MCP config:** set `CHAT_ENV=staging` or `production` (uses `config/mcp-servers.<env>.json`)
- **Load test:** `pnpm load-test:chat` (targets p95 &lt; 10s for session create)

See [docs/e2e-manual-checklist.md](./docs/e2e-manual-checklist.md) for the full E2E checklist.

## Repository layout

```
.
├── mcp-server/          # @zuupee/mcp-server
├── mcp-client/          # @zuupee/mcp-client
├── chat-orchestrator/   # @zuupee/chat-orchestrator
├── chat-api/            # @zuupee/chat-api
├── chat-widget/         # @zuupee/chat-widget
├── mock-api-server/     # @zuupee/mock-api-server
├── config/              # Shared MCP server config for local dev
└── docs/
```

## License

MIT
