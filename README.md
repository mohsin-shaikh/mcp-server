# Zuupee MCP

Monorepo for Zuupee's [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tooling.

## Packages

| Package | Status | Description |
| ------- | ------ | ----------- |
| [`mcp-server`](./mcp-server/) | Available | General-purpose MCP server with pluggable modules, stdio and HTTP transports |
| `mcp-client` | Planned | Client SDK for connecting to MCP servers |

## Getting started

The MCP server lives in [`mcp-server/`](./mcp-server/). See its [README](./mcp-server/README.md) for setup, configuration, and usage.

```bash
cd mcp-server
pnpm install
cp .env.example .env.local
pnpm dev
```

## Repository layout

```
.
├── mcp-server/   # @zuupee/mcp-server — MCP server framework
└── mcp-client/   # @zuupee/mcp-client — client SDK (planned)
```

Monorepo tooling (shared workspace config, root scripts) will be added when `mcp-client` is introduced.

## License

MIT
