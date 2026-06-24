# Deploy Runbook — @zuupee/mcp-server

Guide for running the MCP server remotely over Streamable HTTP.

## Prerequisites

- Node.js 22+ or Docker
- `MCP_TRANSPORT=http`
- API key configured for production (`MCP_AUTH_MODE=api_key`)

## Quick start (Node)

```bash
pnpm install
pnpm build

export MCP_TRANSPORT=http
export MCP_HTTP_HOST=0.0.0.0
export MCP_HTTP_PORT=3100
export MCP_HTTP_ALLOWED_HOSTS=localhost,127.0.0.1,your-hostname.example.com
export MCP_AUTH_MODE=api_key
export MCP_API_KEY=your-secret-key
export MCP_MODULES=meta,http,json,datetime,docs

pnpm start
```

## Docker

```bash
docker build -t zuupee/mcp-server:0.1.0 .

docker run --rm -p 3100:3100 \
  -e MCP_AUTH_MODE=api_key \
  -e MCP_API_KEY=your-secret-key \
  -e MCP_MODULES=meta,docs,json \
  -e READ_ONLY=true \
  zuupee/mcp-server:0.1.0
```

## Health check

```bash
curl -s http://localhost:3100/health | jq
```

Expected response:

```json
{
  "status": "ok",
  "server": "mcp-server",
  "version": "0.1.0",
  "transport": "http",
  "sessions": 0
}
```

## MCP endpoint

- **URL:** `POST http://host:3100/mcp` (configurable via `MCP_HTTP_PATH`)
- **Auth:** `X-API-Key: <MCP_API_KEY>` or `Authorization: Bearer <MCP_API_KEY>`
- **Session:** response includes `Mcp-Session-Id` header after `initialize`

### Initialize example

```bash
curl -s -X POST http://localhost:3100/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'X-API-Key: your-secret-key' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "1.0.0" }
    }
  }'
```

Subsequent requests must include the `Mcp-Session-Id` header returned from the initialize response.

## Graceful shutdown

The server handles `SIGTERM` and `SIGINT`:

1. Closes all active MCP HTTP sessions
2. Stops accepting new connections
3. Exits cleanly

In Kubernetes, set `terminationGracePeriodSeconds: 30` and use `preStop` hook if needed.

## Security checklist

| Item         | Recommendation                                            |
| ------------ | --------------------------------------------------------- |
| Auth         | Always set `MCP_AUTH_MODE=api_key` in production          |
| Bind address | Use `0.0.0.0` in containers; restrict with network policy |
| Host header  | Set `MCP_HTTP_ALLOWED_HOSTS` to your public hostname      |
| CORS         | Set `MCP_CORS_ORIGINS` only to trusted client origins     |
| HTTP tool    | Keep `HTTP_TOOL_ALLOWED_HOSTS` minimal                    |
| Secrets      | Inject `MCP_API_KEY` via secrets manager, not image       |

## npm publish

```bash
pnpm build
pnpm test
npm publish --access public
```

Package name: `@zuupee/mcp-server`

Consumers can run:

```bash
npx @zuupee/mcp-server --transport http --port 3100 --auth api_key
```

(with `MCP_API_KEY` in env)

## Troubleshooting

| Symptom                 | Fix                                                     |
| ----------------------- | ------------------------------------------------------- |
| `401 Unauthorized`      | Check `X-API-Key` or Bearer token matches `MCP_API_KEY` |
| `403` / host rejected   | Add hostname to `MCP_HTTP_ALLOWED_HOSTS`                |
| `404 Session not found` | Include `Mcp-Session-Id` from initialize response       |
| Health check fails      | Confirm `MCP_HTTP_PORT` matches exposed port            |
