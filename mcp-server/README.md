# @zuupee/mcp-server

General-purpose [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server — a reusable foundation that exposes tools, resources, and prompts to AI clients (Cursor, Claude Desktop, MCP Inspector, etc.), with clear extension points for plugging in any backend or domain logic later.

## Features

- **stdio transport** for local development (Cursor, Claude Desktop)
- **Streamable HTTP transport** for remote deployment (Hono + session management)
- **Pluggable modules** — add tools without touching core transport code
- **Schema-first validation** with Zod
- **Built-in generic tools** — HTTP fetch, JSON utilities, datetime helpers, server info
- **Resources & prompts** — build plan, config schema, module docs, workflow templates
- **Optional filesystem module** — sandboxed read-only file access under `FS_ROOT`
- **Plugin loader** — dynamic local modules from `plugins/` via `MCP_PLUGINS_DIR`
- **OpenAPI module** — call REST APIs from OpenAPI 3 specs at runtime
- **OpenTelemetry metrics** — optional OTLP export for tool call telemetry
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
pnpm dev              # stdio server
pnpm dev:http         # HTTP server on :3100
```

### Remote HTTP mode

```bash
export MCP_TRANSPORT=http
export MCP_HTTP_HOST=0.0.0.0
export MCP_AUTH_MODE=api_key
export MCP_API_KEY=your-secret
pnpm start
```

Health check: `GET /health`  
MCP endpoint: `POST /mcp` (requires `X-API-Key` when auth enabled)

See [docs/DEPLOY.md](docs/DEPLOY.md) for Docker, graceful shutdown, and production checklist.

### Metrics (Prometheus + Grafana)

```bash
pnpm metrics:up          # OTLP collector + Prometheus + Grafana
# Set OTEL_ENABLED=true in .env.local, then run the server
pnpm inspect             # call tools, wait ~15s for export
# Grafana: http://localhost:3000 (admin/admin) → MCP Server Metrics dashboard
```

See [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) for full setup and troubleshooting.

### Docker

```bash
pnpm docker:build
docker run --rm -p 3100:3100 \
  -e MCP_AUTH_MODE=api_key \
  -e MCP_API_KEY=your-secret \
  zuupee/mcp-server:local
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

| Tool                      | Module     | Description                                           |
| ------------------------- | ---------- | ----------------------------------------------------- |
| `server_info`             | meta       | Server name, version, enabled modules, config summary |
| `http_fetch`              | http       | GET/POST/PUT/PATCH/DELETE (host allowlist required)   |
| `json_parse`              | json       | Parse JSON string                                     |
| `json_stringify`          | json       | Serialize value to JSON                               |
| `json_pick`               | json       | Extract paths from JSON                               |
| `datetime_now`            | datetime   | Current time (ISO 8601)                               |
| `datetime_format`         | datetime   | Format/parse ISO date strings                         |
| `read_file`               | filesystem | Read file under `FS_ROOT` (opt-in)                    |
| `list_dir`                | filesystem | List directory under `FS_ROOT` (opt-in)               |
| `search_files`            | filesystem | Search files by pattern under `FS_ROOT` (opt-in)      |
| `openapi_list_operations` | openapi    | List operations from an OpenAPI 3 spec (opt-in)       |
| `openapi_call`            | openapi    | Call an OpenAPI operation by `operationId` (opt-in)   |

## Resources

| URI                       | Content                      |
| ------------------------- | ---------------------------- |
| `mcp://docs/build-plan`   | Project build plan           |
| `mcp://docs/modules/{id}` | Per-module usage docs        |
| `mcp://config/schema`     | JSON Schema of server config |

## Prompts

| Prompt              | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `explore_api`       | Safely discover and call an unknown REST API |
| `debug_tool_error`  | Checklist when a tool call fails             |
| `design_new_module` | Guide for adding a new `McpModule`           |

## Configuration

Copy `.env.example` to `.env.local` for local development — the server loads `.env.local` (and `.env`) from the project root on startup. Shell environment variables always take precedence.

Environment variables (see `.env.example`):

| Variable                       | Default                            | Description                                                    |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------- |
| `MCP_TRANSPORT`                | `stdio`                            | `stdio` or `http`                                              |
| `MCP_HTTP_PORT`                | `3100`                             | HTTP listen port                                               |
| `MCP_HTTP_HOST`                | `127.0.0.1`                        | Bind address (`0.0.0.0` for Docker)                            |
| `MCP_HTTP_PATH`                | `/mcp`                             | Streamable HTTP endpoint                                       |
| `MCP_HTTP_ALLOWED_HOSTS`       | `localhost,127.0.0.1,[::1]`        | Host header allowlist (DNS rebinding protection)               |
| `MCP_CORS_ORIGINS`             | _(empty)_                          | Comma-separated CORS origins                                   |
| `MCP_AUTH_MODE`                | `none`                             | `none`, `api_key`, or `bearer` (HTTP transport)                |
| `MCP_API_KEY`                  | _(empty)_                          | Required when auth mode is `api_key` or `bearer`               |
| `MCP_MODULES`                  | `meta,http,json,datetime,docs`     | Comma-separated module ids, or `*` for all (except filesystem) |
| `READ_ONLY`                    | `false`                            | Skip mutating modules (e.g. http)                              |
| `HTTP_TOOL_ALLOWED_HOSTS`      | _(empty)_                          | Comma-separated allowed hostnames (deny-all if empty)          |
| `HTTP_TOOL_MAX_RESPONSE_BYTES` | `1048576`                          | Max response size                                              |
| `HTTP_TOOL_TIMEOUT_MS`         | `10000`                            | Request timeout                                                |
| `FS_ROOT`                      | _(empty)_                          | Sandbox root for filesystem module                             |
| `FS_MAX_READ_BYTES`            | `1048576`                          | Max bytes read per file                                        |
| `MCP_PLUGINS_DIR`              | `./plugins`                        | Local plugin modules directory                                 |
| `OTEL_ENABLED`                 | `false`                            | Export OpenTelemetry metrics                                   |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | `http://localhost:4318/v1/metrics` | OTLP HTTP metrics endpoint (requires collector)                |
| `OPENAPI_SPEC_URL`             | _(empty)_                          | Default OpenAPI spec for `openapi` module                      |
| `LOG_LEVEL`                    | `info`                             | Log level (stderr only)                                        |

CLI flags override env:

```bash
mcp-server --transport http --port 3100 --auth api_key
```

Enable the filesystem module:

```bash
FS_ROOT=/path/to/project MCP_MODULES=meta,docs,filesystem pnpm dev
```

## Adding a custom module

### Option A: Scaffold a plugin

```bash
pnpm create-module my-service
# Enable with MCP_MODULES=meta,my-service
```

### Option B: Manual plugin

1. Create `plugins/my-service/index.ts` implementing `McpModule`
2. Register tools that call your backend via `ctx.http` or `ctx.secrets`
3. Add the plugin id to `MCP_MODULES`

See `plugins/example/index.ts` and `docs/build-plan.md` for the full extension guide.

## Scripts

```bash
pnpm dev        # stdio server (tsx)
pnpm build      # compile to dist/
pnpm start      # run built bin
pnpm test       # unit + integration tests
pnpm inspect    # MCP Inspector against stdio
pnpm docker:build
pnpm metrics:up   # local Prometheus + Grafana stack
pnpm create-module my-service
pnpm lint       # ESLint (no console.log in src/)
```

## npm

```bash
npm publish --access public
```

Consumers:

```bash
npx @zuupee/mcp-server --transport http --port 3100 --auth api_key
```

## Architecture

```
src/
├── index.ts          # CLI entry
├── server.ts         # McpServer factory + instructions
├── config.ts         # env + CLI parsing
├── context.ts        # per-request context
├── registry/         # module registration
├── transport/        # stdio + Streamable HTTP (Hono)
├── middleware/       # auth, read-only, audit logging
├── resources/        # docs + config schema resources
├── prompts/          # reusable prompt templates
├── modules/          # built-in modules
├── plugins/          # plugin loader
└── lib/              # errors, format, schema, result, fs, tool, metrics, openapi
```

## License

MIT
