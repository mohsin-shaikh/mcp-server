# Zuupee MCP

Monorepo for Zuupee's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tooling and website chatbot stack.

## Packages

| Package | Status | Description |
| ------- | ------ | ----------- |
| [`mcp-server`](./mcp-server/) | Available | General-purpose MCP server with pluggable modules, stdio and HTTP transports |
| [`mcp-client`](./mcp-client/) | In progress | Multi-server MCP client with namespaced tools |
| [`chat-orchestrator`](./chat-orchestrator/) | Scaffold | Custom ReAct agent loop (Phase 3) |
| [`chat-api`](./chat-api/) | Scaffold | HTTP API + SSE for the website chatbot (Phase 4) |

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

### Chat API (scaffold)

```bash
pnpm dev:chat
```

Copy `.env.example` to `.env` and fill in LLM/MCP settings when orchestrator wiring lands.

## Repository layout

```
.
├── mcp-server/          # @zuupee/mcp-server
├── mcp-client/          # @zuupee/mcp-client
├── chat-orchestrator/   # @zuupee/chat-orchestrator
├── chat-api/            # @zuupee/chat-api
├── config/              # Shared MCP server config for local dev
└── docs/
```

## License

MIT
