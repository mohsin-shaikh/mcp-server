# Observability (Prometheus + Grafana)

Local stack for viewing MCP server OpenTelemetry metrics.

## What is collected

| Metric                     | Type      | Labels   |
| -------------------------- | --------- | -------- |
| `mcp.tool.calls`           | Counter   | `tool`   |
| `mcp.tool.errors`          | Counter   | `tool`   |
| `mcp.tool.duration_ms`     | Histogram | `tool`   |
| `mcp.module.registrations` | Counter   | `module` |

The server exports to OTLP every **15 seconds** when `OTEL_ENABLED=true`.

## Quick start

### 1. Start the observability stack

```bash
pnpm metrics:up
```

This starts:

| Service                 | URL                                | Purpose                               |
| ----------------------- | ---------------------------------- | ------------------------------------- |
| OpenTelemetry Collector | `http://localhost:4318/v1/metrics` | OTLP ingest (POST only)               |
| Prometheus              | http://localhost:9090              | Metrics store & query UI              |
| Grafana                 | http://localhost:3000              | Dashboards (login: `admin` / `admin`) |

### 2. Enable metrics export in the MCP server

In `.env.local`:

```env
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/metrics
```

### 3. Run the server and invoke tools

```bash
pnpm inspect
# or
pnpm dev
```

Call a few tools in MCP Inspector, then wait up to 15 seconds for the next export batch.

### 4. View metrics

- **Grafana:** http://localhost:3000 → Dashboards → MCP → **MCP Server Metrics**
- **Prometheus:** http://localhost:9090/graph — try `mcp_tool_calls_total`

## Stop the stack

```bash
pnpm metrics:down
```

## Troubleshooting

**No data in Grafana**

1. Confirm the collector is running: `docker compose -f docker-compose.observability.yml ps`
2. Check Prometheus targets: http://localhost:9090/targets — `otel-collector` should be **UP**
3. Confirm `OTEL_ENABLED=true` and the server started without OTEL init errors
4. Invoke at least one tool, then wait 15s
5. Search Prometheus for `{__name__=~"mcp_.*"}` to see exact metric names

**Port 4318 already in use**

Stop any other OTLP collector or change the host port in `docker-compose.observability.yml`.

## Architecture

```
MCP server (host)
    │ OTLP HTTP POST /v1/metrics
    ▼
otel-collector :4318
    │ Prometheus exporter :8889
    ▼
Prometheus :9090 (scrape)
    ▼
Grafana :3000 (dashboard)
```
