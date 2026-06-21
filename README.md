# @zuupee/mcp-server

General-purpose [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server — a reusable foundation that exposes tools, resources, and prompts to AI clients (Cursor, Claude Desktop, MCP Inspector, etc.), with clear extension points for plugging in any backend or domain logic later.

## Features

- **stdio transport** for local development (Cursor, Claude Desktop)
- **Pluggable modules** — add tools without touching core transport code
- **Schema-first validation** with Zod
- **Built-in generic tools** — HTTP fetch, JSON utilities, datetime helpers, server info
- **Resources & prompts** — build plan, config schema, module docs, workflow templates
- **Optional filesystem module** — sandboxed read-only file access under `FS_ROOT`
- **Security defaults** — deny-all HTTP host allowlist, read-only mode, secret redaction
- **Structured logging** to stderr (stdio-safe)

## Quick start

### Prerequisites

- Node.js 22+
- pnpm 9+

### Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

### Cursor configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-server": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/mcp-server", "dev"],
      "env": {
        "MCP_MODULES": "meta,http,json,datetime,docs",
        "READ_ONLY": "true",
        "HTTP_TOOL_ALLOWED_HOSTS": "api.github.com,httpbin.org"
      }
    }
  }
}
```

## Built-in tools

| Tool | Module | Description |
|------|--------|-------------|
| `server_info` | meta | Server name, version, enabled modules, config summary |
| `http_fetch` | http | GET/POST/PUT/PATCH/DELETE (host allowlist required) |
| `json_parse` | json | Parse JSON string |
| `json_stringify` | json | Serialize value to JSON |
| `json_pick` | json | Extract paths from JSON |
| `datetime_now` | datetime | Current time (ISO 8601) |
| `datetime_format` | datetime | Format/parse ISO date strings |
| `read_file` | filesystem | Read file under `FS_ROOT` (opt-in) |
| `list_dir` | filesystem | List directory under `FS_ROOT` (opt-in) |
| `search_files` | filesystem | Search files by pattern under `FS_ROOT` (opt-in) |

## Resources

| URI | Content |
|-----|---------|
| `mcp://docs/build-plan` | Project build plan |
| `mcp://docs/modules/{id}` | Per-module usage docs |
| `mcp://config/schema` | JSON Schema of server config |

## Prompts

| Prompt | Purpose |
|--------|---------|
| `explore_api` | Safely discover and call an unknown REST API |
| `debug_tool_error` | Checklist when a tool call fails |
| `design_new_module` | Guide for adding a new `McpModule` |

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_MODULES` | `meta,http,json,datetime,docs` | Comma-separated module ids, or `*` for all (except filesystem) |
| `READ_ONLY` | `false` | Skip mutating modules (e.g. http) |
| `HTTP_TOOL_ALLOWED_HOSTS` | _(empty)_ | Comma-separated allowed hostnames (deny-all if empty) |
| `HTTP_TOOL_MAX_RESPONSE_BYTES` | `1048576` | Max response size |
| `HTTP_TOOL_TIMEOUT_MS` | `10000` | Request timeout |
| `FS_ROOT` | _(empty)_ | Sandbox root for filesystem module |
| `FS_MAX_READ_BYTES` | `1048576` | Max bytes read per file |
| `LOG_LEVEL` | `info` | Log level (stderr only) |

CLI flags override env:

```bash
mcp-server --transport stdio --modules meta,http --read-only
```

Enable the filesystem module:

```bash
FS_ROOT=/path/to/project MCP_MODULES=meta,docs,filesystem pnpm dev
```

## Adding a custom module

1. Create `plugins/my-service/index.ts` implementing `McpModule`
2. Register tools that call your backend via `ctx.http` or `ctx.secrets`
3. Wire the module into `MCP_MODULES` (Phase 4 adds dynamic plugin loading)

See `plugins/example/index.ts` and `docs/build-plan.md` for the full extension guide.

## Scripts

```bash
pnpm dev        # stdio server (tsx)
pnpm build      # compile to dist/
pnpm start      # run built bin
pnpm test       # unit + integration tests
pnpm inspect    # MCP Inspector against stdio
pnpm lint       # ESLint (no console.log in src/)
```

## Architecture

```
src/
├── index.ts          # CLI entry
├── server.ts         # McpServer factory + instructions
├── config.ts         # env + CLI parsing
├── context.ts        # per-request context
├── registry/         # module registration
├── transport/        # stdio (http in Phase 3)
├── middleware/       # auth, read-only, audit logging
├── resources/        # docs + config schema resources
├── prompts/          # reusable prompt templates
├── modules/          # built-in modules
└── lib/              # errors, format, schema, result, fs, tool helpers
```

## License

MIT
