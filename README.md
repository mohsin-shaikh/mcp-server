# Zuupee MCP

Monorepo for Zuupee's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tooling and website chatbot stack.

## Packages

| Package                                     | Status      | Description                                                                  |
| ------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| [`mcp-server`](./mcp-server/)               | Available   | General-purpose MCP server with pluggable modules, stdio and HTTP transports |
| [`mcp-client`](./mcp-client/)               | In progress | Multi-server MCP client with namespaced tools                                |
| [`chat-orchestrator`](./chat-orchestrator/) | Available   | Custom ReAct agent loop with OpenAI + MCP tools                              |
| [`chat-api`](./chat-api/)                   | Scaffold    | HTTP API + SSE for the website chatbot (Phase 4)                             |
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

### Mock orders API

```bash
pnpm dev:mock-orders
```

Then run `mcp-server` with `MCP_MODULES=meta,orders` and `ORDERS_API_BASE_URL=http://127.0.0.1:3999`.

### Chat orchestrator (terminal demo)

Set `OPENAI_API_KEY` in `.env`, then:

```bash
# Terminal 1
pnpm dev:mock-orders

# Terminal 2
MCP_SERVERS_CONFIG=./config/mcp-servers.chat.example.json \
pnpm dev:orchestrator -- "What is the status of order ord_123?"
```

### Chat API (scaffold)

```bash
pnpm dev:chat
```

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` for orchestrator demos.

## Repository layout

```
.
├── mcp-server/          # @zuupee/mcp-server
├── mcp-client/          # @zuupee/mcp-client
├── chat-orchestrator/   # @zuupee/chat-orchestrator
├── chat-api/            # @zuupee/chat-api
├── mock-api-server/     # @zuupee/mock-api-server
├── config/              # Shared MCP server config for local dev
└── docs/
```

## License

MIT
